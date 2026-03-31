import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ViewerLog } from '@/lib/types';

const PAGE_SIZE = 30;

// GET /api/tournaments/[id]/viewer-logs?page=1&belong=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const belong = searchParams.get('belong');
    const offset = (page - 1) * PAGE_SIZE;

    let logs;
    let countRows;
    let statsRows;

    if (belong) {
      logs = await sql`
        SELECT * FROM viewer_logs
        WHERE tournament_id = ${tournamentId} AND belong = ${belong}
        ORDER BY logged_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) AS total FROM viewer_logs
        WHERE tournament_id = ${tournamentId} AND belong = ${belong}
      `;
      statsRows = await sql`
        SELECT
          COUNT(*) AS total_logins,
          COUNT(DISTINCT LOWER(TRIM(name_input))) AS unique_users
        FROM viewer_logs
        WHERE tournament_id = ${tournamentId} AND belong = ${belong}
      `;
    } else {
      logs = await sql`
        SELECT * FROM viewer_logs
        WHERE tournament_id = ${tournamentId}
        ORDER BY logged_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) AS total FROM viewer_logs
        WHERE tournament_id = ${tournamentId}
      `;
      statsRows = await sql`
        SELECT
          COUNT(*) AS total_logins,
          COUNT(DISTINCT LOWER(TRIM(name_input))) AS unique_users
        FROM viewer_logs
        WHERE tournament_id = ${tournamentId}
      `;
    }

    // 所属フィルタ用に一覧取得
    const belongRows = await sql`
      SELECT DISTINCT belong FROM viewer_logs
      WHERE tournament_id = ${tournamentId} AND belong IS NOT NULL
      ORDER BY belong
    `;

    const total = Number(countRows[0]?.total ?? 0);
    const totalLogins = Number(statsRows[0]?.total_logins ?? 0);
    const uniqueUsers = Number(statsRows[0]?.unique_users ?? 0);
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const belongs = belongRows.map(r => r.belong as string);

    return NextResponse.json({
      success: true,
      data: {
        logs: logs as ViewerLog[],
        total,
        page,
        totalPages,
        totalLogins,
        uniqueUsers,
        belongs,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: '閲覧履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
