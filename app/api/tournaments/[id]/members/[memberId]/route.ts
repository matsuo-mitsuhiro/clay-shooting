import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string; memberId: string }> };

// DELETE /api/tournaments/[id]/members/[memberId]
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id, memberId } = await params;
    const tournamentId = Number(id);
    const memberIdNum = Number(memberId);

    // Get member info first
    const members = await sql`SELECT * FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;
    if (members.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '選手が見つかりません' }, { status: 404 });
    }
    const member = members[0] as { member_code: string | null; name: string };

    // Check if scores exist
    let hasScores = false;
    if (member.member_code) {
      const scores = await sql`SELECT id FROM scores WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code}`;
      hasScores = scores.length > 0;
    }

    // Delete member
    await sql`DELETE FROM members WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}`;

    // If scores exist, delete them too
    if (hasScores && member.member_code) {
      await sql`DELETE FROM scores WHERE tournament_id = ${tournamentId} AND member_code = ${member.member_code}`;
    }

    // 対応する申込をキャンセルにする
    let cancelledRegistration = false;
    if (member.member_code) {
      const cancelledRows = await sql`
        UPDATE registrations
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = 'admin',
            cancelled_by_name = '選手管理から削除'
        WHERE tournament_id = ${tournamentId}
          AND member_code = ${member.member_code}
          AND status = 'active'
        RETURNING id
      `;
      if (cancelledRows.length > 0) cancelledRegistration = true;
    }

    // 操作ログ
    const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tournamentId}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;

    await writeOperationLog({
      tournamentId,
      tournamentName,
      adminName: (jwtToken?.name as string) ?? null,
      adminAffiliation: (jwtToken?.affiliation as string) ?? null,
      action: 'member_delete',
      detail: `${member.member_code ?? ''} ${member.name}`.trim(),
    });

    return NextResponse.json<ApiResponse<{ hadScores: boolean; cancelledRegistration: boolean }>>({ success: true, data: { hadScores: hasScores, cancelledRegistration } });
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

    const member = members[0] as { member_code: string | null; belong: string | null; class: string | null; is_judge: boolean };

    const newBelong = body.belong !== undefined ? body.belong : member.belong;
    const newClass = body.class !== undefined ? body.class : member.class;
    const newIsJudge = body.is_judge !== undefined ? body.is_judge : member.is_judge;

    await sql`
      UPDATE members
      SET belong = ${newBelong}, class = ${newClass}, is_judge = ${newIsJudge}
      WHERE id = ${memberIdNum} AND tournament_id = ${tournamentId}
    `;

    // Also update player_master if member_code exists
    if (member.member_code && (body.class !== undefined || body.is_judge !== undefined)) {
      try {
        const tRows = await sql`SELECT event_type FROM tournaments WHERE id = ${tournamentId}`;
        const isSkeet = tRows.length > 0 && tRows[0].event_type === 'skeet';
        if (isSkeet) {
          await sql`
            UPDATE player_master
            SET skeet_class = ${newClass}, is_judge = ${newIsJudge}, updated_at = NOW()
            WHERE member_code = ${member.member_code}
          `;
        } else {
          await sql`
            UPDATE player_master
            SET trap_class = ${newClass}, is_judge = ${newIsJudge}, updated_at = NOW()
            WHERE member_code = ${member.member_code}
          `;
        }
      } catch {
        // player_master update failure is non-critical
      }
    }

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
