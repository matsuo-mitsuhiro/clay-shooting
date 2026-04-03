import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { ApiResponse, OperationLog } from '@/lib/types';

// GET /api/operation-logs — 操作ログ一覧（システム管理者のみ）
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'system') {
    return NextResponse.json<ApiResponse>({ success: false, error: 'システム管理者のみ閲覧可能です' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const tournamentId = url.searchParams.get('tournament_id');
    const action = url.searchParams.get('action');

    let rows;
    if (tournamentId && action) {
      rows = await sql`
        SELECT * FROM operation_logs
        WHERE tournament_id = ${Number(tournamentId)} AND action = ${action}
        ORDER BY logged_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (tournamentId) {
      rows = await sql`
        SELECT * FROM operation_logs
        WHERE tournament_id = ${Number(tournamentId)}
        ORDER BY logged_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (action) {
      rows = await sql`
        SELECT * FROM operation_logs
        WHERE action = ${action}
        ORDER BY logged_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = await sql`
        SELECT * FROM operation_logs
        ORDER BY logged_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // 総件数
    let countRows;
    if (tournamentId && action) {
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE tournament_id = ${Number(tournamentId)} AND action = ${action}`;
    } else if (tournamentId) {
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE tournament_id = ${Number(tournamentId)}`;
    } else if (action) {
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE action = ${action}`;
    } else {
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs`;
    }
    const total = Number((countRows[0] as { total: number }).total);

    return NextResponse.json<ApiResponse<{ logs: OperationLog[]; total: number }>>({
      success: true,
      data: { logs: rows as OperationLog[], total },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'ログ取得に失敗しました' }, { status: 500 });
  }
}
