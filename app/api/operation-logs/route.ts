import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { ApiResponse, OperationLog } from '@/lib/types';

// GET /api/operation-logs — 操作ログ一覧（システム管理者 + 運営管理者）
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'ログインが必要です' }, { status: 401 });
  }

  const isSystem = session.user?.role === 'system';
  const userAffiliation = session.user?.affiliation ?? null;

  // 運営管理者は自所属のログのみ閲覧可能
  if (!isSystem && !userAffiliation) {
    return NextResponse.json<ApiResponse>({ success: false, error: '所属協会が設定されていません' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const tournamentId = url.searchParams.get('tournament_id');
    const action = url.searchParams.get('action');
    const affiliationParam = url.searchParams.get('affiliation');

    // 運営管理者は自所属で強制フィルター
    const aff = isSystem ? (affiliationParam || null) : userAffiliation;
    const tid = tournamentId ? Number(tournamentId) : null;

    // tagged template literal で条件分岐（neonの関数呼び出し構文は不安定なため）
    let rows: Record<string, unknown>[];
    let countRows: Record<string, unknown>[];

    if (tid && action && aff) {
      rows = await sql`SELECT * FROM operation_logs WHERE tournament_id=${tid} AND action=${action} AND admin_affiliation=${aff} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE tournament_id=${tid} AND action=${action} AND admin_affiliation=${aff}`;
    } else if (tid && action) {
      rows = await sql`SELECT * FROM operation_logs WHERE tournament_id=${tid} AND action=${action} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE tournament_id=${tid} AND action=${action}`;
    } else if (tid && aff) {
      rows = await sql`SELECT * FROM operation_logs WHERE tournament_id=${tid} AND admin_affiliation=${aff} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE tournament_id=${tid} AND admin_affiliation=${aff}`;
    } else if (action && aff) {
      rows = await sql`SELECT * FROM operation_logs WHERE action=${action} AND admin_affiliation=${aff} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE action=${action} AND admin_affiliation=${aff}`;
    } else if (tid) {
      rows = await sql`SELECT * FROM operation_logs WHERE tournament_id=${tid} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE tournament_id=${tid}`;
    } else if (action) {
      rows = await sql`SELECT * FROM operation_logs WHERE action=${action} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE action=${action}`;
    } else if (aff) {
      rows = await sql`SELECT * FROM operation_logs WHERE admin_affiliation=${aff} ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs WHERE admin_affiliation=${aff}`;
    } else {
      rows = await sql`SELECT * FROM operation_logs ORDER BY logged_at DESC LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM operation_logs`;
    }

    const total = Number((countRows[0] as { total: number }).total);

    return NextResponse.json<ApiResponse<{ logs: OperationLog[]; total: number }>>({
      success: true,
      data: { logs: rows as unknown as OperationLog[], total },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'ログ取得に失敗しました' }, { status: 500 });
  }
}
