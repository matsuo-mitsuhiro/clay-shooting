import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/members/copy
// 1日目メンバーを2日目にコピー
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);

    // 1日目データ存在チェック
    const day1 = await sql`
      SELECT COUNT(*) AS cnt FROM members WHERE tournament_id = ${tournamentId} AND day = 1
    `;
    if (Number(day1[0].cnt) === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '1日目のメンバーが登録されていません' }, { status: 400 });
    }

    // 2日目データ既存チェック
    const day2 = await sql`
      SELECT COUNT(*) AS cnt FROM members WHERE tournament_id = ${tournamentId} AND day = 2
    `;
    if (Number(day2[0].cnt) > 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '2日目のメンバーがすでに登録されています' }, { status: 400 });
    }

    // コピー実行
    await sql`
      INSERT INTO members (tournament_id, day, group_number, position, member_code, name, belong, class, is_judge)
      SELECT tournament_id, 2, group_number, position, member_code, name, belong, class, is_judge
      FROM members
      WHERE tournament_id = ${tournamentId} AND day = 1
    `;

    const copied = await sql`
      SELECT COUNT(*) AS cnt FROM members WHERE tournament_id = ${tournamentId} AND day = 2
    `;
    return NextResponse.json<ApiResponse<{ count: number }>>({
      success: true,
      data: { count: Number(copied[0].cnt) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'コピーに失敗しました' }, { status: 500 });
  }
}
