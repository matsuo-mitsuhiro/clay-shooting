import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
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
    const member = members[0] as { member_code: string | null };

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

    return NextResponse.json<ApiResponse<{ hadScores: boolean }>>({ success: true, data: { hadScores: hasScores } });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '選手の削除に失敗しました' }, { status: 500 });
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
