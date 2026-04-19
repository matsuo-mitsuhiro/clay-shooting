import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import { toShortName } from '@/lib/affiliation';
import type { ApiResponse, ParticipationDay } from '@/lib/types';

type Params = { params: Promise<{ id: string; regId: string }> };

const POSITIONS_PER_GROUP = 6;

// DELETE /api/tournaments/[id]/registrations/[regId] — 手動登録の削除（source='manual'のみ）
export async function DELETE(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id, regId } = await params;
    const tid = Number(id);
    const rid = Number(regId);

    // 削除前に情報を取得（ログ用・members削除用）
    const regRows = await sql`
      SELECT member_code, name, participation_day, transferred_at FROM registrations
      WHERE id = ${rid} AND tournament_id = ${tid} AND source = 'manual'
    `;
    if (!regRows.length) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '削除対象が見つかりません（手動登録のみ削除可能です）',
      }, { status: 404 });
    }
    const reg = regRows[0] as { member_code: string; name: string; participation_day: string; transferred_at: string | null };

    // 移行済みの場合、membersテーブルからも削除
    let deletedFromMembers = false;
    if (reg.transferred_at && reg.member_code) {
      const pday = reg.participation_day ?? 'day1';
      if (pday === 'both') {
        const del = await sql`DELETE FROM members WHERE tournament_id = ${tid} AND member_code = ${reg.member_code} RETURNING id`;
        if (del.length > 0) deletedFromMembers = true;
      } else {
        const dayNum = pday === 'day2' ? 2 : 1;
        const del = await sql`DELETE FROM members WHERE tournament_id = ${tid} AND member_code = ${reg.member_code} AND day = ${dayNum} RETURNING id`;
        if (del.length > 0) deletedFromMembers = true;
      }
      // scoresも削除
      if (deletedFromMembers) {
        await sql`DELETE FROM scores WHERE tournament_id = ${tid} AND member_code = ${reg.member_code}`;
      }
    }

    await sql`
      DELETE FROM registrations
      WHERE id = ${rid} AND tournament_id = ${tid} AND source = 'manual'
    `;

    // 操作ログ
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;

    await writeOperationLog({
      tournamentId: tid,
      tournamentName,
      adminName: (jwtToken.name as string) ?? null,
      adminAffiliation: (jwtToken.affiliation as string) ?? null,
      action: 'registration_delete',
      detail: `${reg.member_code} ${reg.name}`,
    });

    return NextResponse.json<ApiResponse<{ deletedFromMembers: boolean }>>({ success: true, data: { deletedFromMembers } });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '削除に失敗しました' }, { status: 500 });
  }
}

// 空きスロットを検索（day内）
async function allocateSlot(tid: number, day: number): Promise<{ group: number; pos: number }> {
  const rows = await sql`
    SELECT group_number, position FROM members
    WHERE tournament_id = ${tid} AND day = ${day}
  `;
  const occupied = new Set(
    (rows as { group_number: number; position: number }[]).map(m => `${m.group_number}_${m.position}`)
  );
  let group = 1;
  let pos = 1;
  while (occupied.has(`${group}_${pos}`)) {
    pos++;
    if (pos > POSITIONS_PER_GROUP) {
      pos = 1;
      group++;
    }
  }
  return { group, pos };
}

// PATCH /api/tournaments/[id]/registrations/[regId] — 申込情報のインライン編集
export async function PATCH(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id, regId } = await params;
    const tid = Number(id);
    const rid = Number(regId);
    const body = await req.json();

    // 現在の申込情報を取得
    const curRows = await sql`
      SELECT member_code, name, belong, class, is_judge, participation_day, status, transferred_at
      FROM registrations
      WHERE id = ${rid} AND tournament_id = ${tid}
    `;
    if (!curRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込が見つかりません' }, { status: 404 });
    }
    const cur = curRows[0] as {
      member_code: string;
      name: string;
      belong: string | null;
      class: string | null;
      is_judge: boolean;
      participation_day: ParticipationDay;
      status: 'active' | 'cancelled';
      transferred_at: string | null;
    };

    if (cur.status === 'cancelled') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル済の申込は編集できません' }, { status: 400 });
    }

    const isTransferred = !!cur.transferred_at;
    const newPday: ParticipationDay | undefined = body.participation_day;

    // 所属名を短縮形に正規化（「大阪府クレー射撃協会」→「大阪」）
    if (body.belong !== undefined) {
      body.belong = body.belong ? (toShortName(body.belong) || null) : null;
    }

    // 参加日変更のバリデーション（移行済のみ）
    if (newPday !== undefined && newPday !== cur.participation_day && isTransferred) {
      const from = cur.participation_day;
      const to = newPday;
      const allowed =
        (from === 'both' && (to === 'day1' || to === 'day2')) ||
        ((from === 'day1' || from === 'day2') && to === 'both');
      if (!allowed) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '登録済の申込では 1日目↔2日目 の直接変更はできません。キャンセルして再登録してください。',
        }, { status: 400 });
      }

      // 両方→片日 の場合、削除される日の点数をチェック
      if (from === 'both' && (to === 'day1' || to === 'day2')) {
        const removedDay = to === 'day1' ? 2 : 1;
        const scoreRows = await sql`
          SELECT r1, r2, r3, r4, r5, r6, r7, r8 FROM scores
          WHERE tournament_id = ${tid} AND member_code = ${cur.member_code}
        `;
        if (scoreRows.length > 0) {
          const s = scoreRows[0] as Record<string, number | null>;
          const fields = removedDay === 2 ? ['r5', 'r6', 'r7', 'r8'] : ['r1', 'r2', 'r3', 'r4'];
          const hasScore = fields.some(f => s[f] !== null && s[f] !== undefined);
          if (hasScore) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: `${removedDay}日目に点数が入力されているため、参加日を変更できません。`,
            }, { status: 400 });
          }
        }
      }
    }

    // registrations 更新
    if (body.name !== undefined) {
      await sql`UPDATE registrations SET name = ${body.name as string} WHERE id = ${rid} AND tournament_id = ${tid}`;
    }
    if (body.belong !== undefined) {
      await sql`UPDATE registrations SET belong = ${(body.belong ?? null) as string | null} WHERE id = ${rid} AND tournament_id = ${tid}`;
    }
    if (body.class !== undefined) {
      await sql`UPDATE registrations SET class = ${(body.class ?? null) as string | null} WHERE id = ${rid} AND tournament_id = ${tid}`;
    }
    if (body.is_judge !== undefined) {
      await sql`UPDATE registrations SET is_judge = ${body.is_judge as boolean} WHERE id = ${rid} AND tournament_id = ${tid}`;
    }
    if (body.member_code !== undefined) {
      await sql`UPDATE registrations SET member_code = ${body.member_code as string} WHERE id = ${rid} AND tournament_id = ${tid}`;
    }
    if (newPday !== undefined) {
      await sql`UPDATE registrations SET participation_day = ${newPday} WHERE id = ${rid} AND tournament_id = ${tid}`;
    }

    // 移行済の場合は members / player_master にも同期
    if (isTransferred && cur.member_code) {
      // 氏名・所属・クラス・審判 → members 両日分を更新
      if (body.name !== undefined) {
        await sql`UPDATE members SET name = ${body.name as string} WHERE tournament_id = ${tid} AND member_code = ${cur.member_code}`;
      }
      if (body.belong !== undefined) {
        await sql`UPDATE members SET belong = ${(body.belong ?? null) as string | null} WHERE tournament_id = ${tid} AND member_code = ${cur.member_code}`;
      }
      if (body.class !== undefined) {
        await sql`UPDATE members SET class = ${(body.class ?? null) as string | null} WHERE tournament_id = ${tid} AND member_code = ${cur.member_code}`;
      }
      if (body.is_judge !== undefined) {
        await sql`UPDATE members SET is_judge = ${body.is_judge as boolean} WHERE tournament_id = ${tid} AND member_code = ${cur.member_code}`;
      }

      // 参加日の変更に応じて members 行を追加／削除
      if (newPday !== undefined && newPday !== cur.participation_day) {
        const from = cur.participation_day;
        const to = newPday;
        if (from === 'both' && to === 'day1') {
          await sql`DELETE FROM members WHERE tournament_id = ${tid} AND member_code = ${cur.member_code} AND day = 2`;
        } else if (from === 'both' && to === 'day2') {
          await sql`DELETE FROM members WHERE tournament_id = ${tid} AND member_code = ${cur.member_code} AND day = 1`;
        } else if ((from === 'day1' || from === 'day2') && to === 'both') {
          const addDay = from === 'day1' ? 2 : 1;
          const slot = await allocateSlot(tid, addDay);
          const name = (body.name ?? cur.name) as string;
          const belong = (body.belong !== undefined ? body.belong : cur.belong) as string | null;
          const cls = (body.class !== undefined ? body.class : cur.class) as string | null;
          const isJudge = (body.is_judge !== undefined ? body.is_judge : cur.is_judge) as boolean;
          await sql`
            INSERT INTO members (tournament_id, day, group_number, position, member_code, name, belong, class, is_judge)
            VALUES (${tid}, ${addDay}, ${slot.group}, ${slot.pos}, ${cur.member_code}, ${name}, ${belong}, ${cls}, ${isJudge})
            ON CONFLICT (tournament_id, day, member_code) DO NOTHING
          `;
        }
      }

      // player_master も更新（class / is_judge）
      // class は event_type に応じて trap_class / skeet_class を切り替え
      if (body.class !== undefined || body.is_judge !== undefined) {
        try {
          const playerRows = await sql`SELECT member_code FROM player_master WHERE member_code = ${cur.member_code}`;
          if (playerRows.length > 0) {
            if (body.class !== undefined) {
              const tRows = await sql`SELECT event_type FROM tournaments WHERE id = ${tid}`;
              const isSkeet = tRows.length > 0 && tRows[0].event_type === 'skeet';
              const newCls = (body.class ?? null) as string | null;
              if (isSkeet) {
                await sql`UPDATE player_master SET skeet_class = ${newCls}, updated_at = NOW() WHERE member_code = ${cur.member_code}`;
              } else {
                await sql`UPDATE player_master SET trap_class = ${newCls}, updated_at = NOW() WHERE member_code = ${cur.member_code}`;
              }
            }
            if (body.is_judge !== undefined) {
              await sql`UPDATE player_master SET is_judge = ${body.is_judge as boolean}, updated_at = NOW() WHERE member_code = ${cur.member_code}`;
            }
          }
        } catch (e) {
          console.error('player_master sync failed:', e);
          // player_master 更新失敗は致命的ではないので無視
        }
      }
    }

    // 操作ログ
    const changedFields: string[] = [];
    if (body.name !== undefined && body.name !== cur.name) changedFields.push('氏名');
    if (body.belong !== undefined && body.belong !== cur.belong) changedFields.push('所属');
    if (body.class !== undefined && body.class !== cur.class) changedFields.push('クラス');
    if (body.is_judge !== undefined && body.is_judge !== cur.is_judge) changedFields.push('審判');
    if (newPday !== undefined && newPday !== cur.participation_day) changedFields.push('参加日');
    if (body.member_code !== undefined && body.member_code !== cur.member_code) changedFields.push('会員番号');
    if (changedFields.length > 0) {
      const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
      const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;
      await writeOperationLog({
        tournamentId: tid,
        tournamentName,
        adminName: (jwtToken.name as string) ?? null,
        adminAffiliation: (jwtToken.affiliation as string) ?? null,
        action: 'registration_edit',
        detail: `${cur.member_code} ${cur.name}: ${changedFields.join('・')}`,
      });
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '更新に失敗しました' }, { status: 500 });
  }
}
