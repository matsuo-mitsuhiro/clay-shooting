import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Result, Tournament, ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/tournaments/[id]/results
// 成績一覧（v_results ビュー）＋大会情報＋has2ndDay フラグ
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);

    // 並列取得
    const [tournamentRows, resultRows, day2Rows, scoreUpdatedRows] = await Promise.all([
      sql`SELECT * FROM tournaments WHERE id = ${tournamentId}`,
      sql`SELECT * FROM v_results WHERE tournament_id = ${tournamentId} ORDER BY is_non_prize ASC, rank NULLS LAST, name`,
      sql`SELECT COUNT(*) AS cnt FROM members WHERE tournament_id = ${tournamentId} AND day = 2`,
      sql`SELECT MAX(updated_at) AS last_updated FROM scores WHERE tournament_id = ${tournamentId}`,
    ]);

    if (!tournamentRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<{
      tournament: Tournament;
      results: Result[];
      has2ndDay: boolean;
      lastScoreUpdated: string | null;
    }>>({
      success: true,
      data: {
        tournament: tournamentRows[0] as Tournament,
        results: resultRows as Result[],
        has2ndDay: Number(day2Rows[0].cnt) > 0,
        lastScoreUpdated: (scoreUpdatedRows[0].last_updated as string | null) ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '成績取得に失敗しました' }, { status: 500 });
  }
}
