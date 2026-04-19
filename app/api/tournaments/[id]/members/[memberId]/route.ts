import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import { toShortName } from '@/lib/affiliation';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string; memberId: string }> };

// DELETE /api/tournaments/[id]/members/[memberId]
// body: { deleteScope?: 'day1' | 'day2' | 'both' }
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id, memberId } = await params;
    const tournamentId = Number(id);
    const memberIdNum = Number(memberId);

    // bodyからdeleteScopeを取得（指定なしは'both'）
    let deleteScope: 'day1' | 'day2' | 'both' = 'both';
    try {
      const body = await req.json();
      if (body.deleteScope === 'day1' || body.deleteScope === 'day2') deleteScope = body.deleteScope;
    } catch { /* bodyなしの場合はboth */ }

    // Get member info first
    const members = await sql`SELECT * FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;
    if (members.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '選手が見つかりません' }, { status: 404 });
    }
    const member = members[0] as { member_code: string | null; name: string; day: number };

    // deleteScopeに応じてmembersを削除
    if (deleteScope === 'both') {
      // 同じmember_codeの両日を削除
      if (member.member_code) {
        await sql`DELETE FROM members WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code}`;
      } else {
        await sql`DELETE FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;
      }
    } else {
      const dayNum = deleteScope === 'day1' ? 1 : 2;
      if (member.member_code) {
        await sql`DELETE FROM members WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code} AND day = ${dayNum}`;
      } else {
        await sql`DELETE FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;
      }
    }

    // scoresを削除
    if (member.member_code) {
      await sql`DELETE FROM scores WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code}`;
    }

    // 対応する申込を処理
    let cancelledRegistration = false;
    let updatedParticipation = false;
    if (member.member_code) {
      // 現在のactive申込を取得
      const regRows = await sql`
        SELECT id, participation_day FROM registrations
        WHERE tournament_id = ${tournamentId}
          AND member_code = ${member.member_code}
          AND status = 'active'
      `;

      if (regRows.length > 0) {
        const reg = regRows[0] as { id: number; participation_day: string };

        if (deleteScope === 'both') {
          // 両日削除 → キャンセル
          await sql`
            UPDATE registrations
            SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'admin', cancelled_by_name = '選手管理から削除'
            WHERE id = ${reg.id}
          `;
          cancelledRegistration = true;
        } else if (reg.participation_day === 'both') {
          // 「両方」申込から片日だけ削除 → participation_dayを残りの日に変更
          const remainingDay = deleteScope === 'day1' ? 'day2' : 'day1';
          await sql`
            UPDATE registrations
            SET participation_day = ${remainingDay}
            WHERE id = ${reg.id}
          `;
          updatedParticipation = true;
        } else {
          // 片日申込で該当日削除 → キャンセル
          await sql`
            UPDATE registrations
            SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'admin', cancelled_by_name = '選手管理から削除'
            WHERE id = ${reg.id}
          `;
          cancelledRegistration = true;
        }
      }
    }

    // 操作ログ
    const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tournamentId}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;
    const scopeLabel = deleteScope === 'day1' ? '(1日目)' : deleteScope === 'day2' ? '(2日目)' : '';

    await writeOperationLog({
      tournamentId,
      tournamentName,
      adminName: (jwtToken?.name as string) ?? null,
      adminAffiliation: (jwtToken?.affiliation as string) ?? null,
      action: 'member_delete',
      detail: `${member.member_code ?? ''} ${member.name}${scopeLabel}`.trim(),
    });

    return NextResponse.json<ApiResponse<{ hadScores: boolean; cancelledRegistration: boolean; updatedParticipation: boolean; deletedName: string }>>({
      success: true,
      data: { hadScores: false, cancelledRegistration, updatedParticipation, deletedName: member.name },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '選手の削除に失敗しました' }, { status: 500 });
  }
}

// PATCH /api/tournaments/[id]/members/[memberId] — インライン編集（belong, class, is_judge）
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, memberId } = await params;
    const tournamentId = Number(id);
    const memberIdNum = Number(memberId);
    const body = await req.json();

    // Validate member exists
    const members = await sql`SELECT * FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;
    if (members.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '選手が見つかりません' }, { status: 404 });
    }

    const member = members[0] as { member_code: string | null; belong: string | null; class: string | null; is_judge: boolean; is_non_prize: boolean };

    // class と is_judge は選手管理からは変更不可（申込管理タブで変更 → members 両日分 + player_master に同期）
    // 防御的に body から無視する
    const newBelong = body.belong !== undefined
      ? (body.belong ? (toShortName(body.belong) || null) : null)
      : member.belong;
    const newClass = member.class;
    const newIsJudge = member.is_judge;
    const newIsNonPrize = body.is_non_prize !== undefined ? body.is_non_prize : member.is_non_prize;

    // 会員番号の変更（scores / registrations / 同一会員の両日分 members をまとめて同期）
    if (body.member_code !== undefined) {
      const raw = String(body.member_code ?? '').trim();
      const newCode = raw
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        .trim() || null;

      if (newCode && !/^\d+$/.test(newCode)) {
        return NextResponse.json<ApiResponse>({ success: false, error: '会員番号は半角数字のみで入力してください' }, { status: 400 });
      }

      const oldCode = member.member_code;
      if (newCode !== oldCode) {
        // 同一大会内の重複チェック（別の選手が既に使っている場合は拒否）
        if (newCode) {
          const dup = await sql`
            SELECT id FROM members
            WHERE tournament_id = ${tournamentId}
              AND member_code = ${newCode}
              AND (${oldCode}::text IS NULL OR member_code != ${oldCode})
            LIMIT 1
          `;
          if (dup.length > 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: `会員番号 ${newCode} は同一大会内で既に使用されています` }, { status: 409 });
          }
        }

        if (oldCode) {
          // 両日分の members を一括更新
          await sql`
            UPDATE members SET member_code = ${newCode}
            WHERE tournament_id = ${tournamentId} AND member_code = ${oldCode}
          `;
          // scores も同期（点数の紐付けを維持）
          await sql`
            UPDATE scores SET member_code = ${newCode}
            WHERE tournament_id = ${tournamentId} AND member_code = ${oldCode}
          `;
          // registrations も同期
          await sql`
            UPDATE registrations SET member_code = ${newCode}
            WHERE tournament_id = ${tournamentId} AND member_code = ${oldCode}
          `;
        } else {
          // 旧コードが NULL の場合は当該行のみ更新
          await sql`
            UPDATE members SET member_code = ${newCode}
            WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}
          `;
        }
        member.member_code = newCode;
      }
    }

    await sql`
      UPDATE members
      SET belong = ${newBelong}, class = ${newClass}, is_judge = ${newIsJudge}, is_non_prize = ${newIsNonPrize}
      WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}
    `;

    // 賞典外フラグは同一 member_code の他日にも同期（両方参加者対策）
    if (body.is_non_prize !== undefined && member.member_code) {
      await sql`
        UPDATE members
        SET is_non_prize = ${newIsNonPrize}
        WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code}
      `;
    }

    // class / is_judge の player_master 同期は選手管理からは行わない
    // （申込管理タブから変更すると registrations/[regId] ルートで同期される）

    // Return updated member
    const updated = await sql`SELECT * FROM members WHERE id = ${memberIdNum}`;
    return NextResponse.json<ApiResponse>({ success: true, data: updated[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '更新に失敗しました' }, { status: 500 });
  }
}

// GET - check if member has scores
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id, memberId } = await params;
    const tournamentId = Number(id);
    const memberIdNum = Number(memberId);

    const members = await sql`SELECT * FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;
    if (members.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '選手が見つかりません' }, { status: 404 });
    }
    const member = members[0] as { member_code: string | null };

    let hasScores = false;
    if (member.member_code) {
      const scores = await sql`SELECT id FROM scores WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code}`;
      hasScores = scores.length > 0;
    }

    return NextResponse.json<ApiResponse<{ hasScores: boolean }>>({ success: true, data: { hasScores } });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '確認に失敗しました' }, { status: 500 });
  }
}
