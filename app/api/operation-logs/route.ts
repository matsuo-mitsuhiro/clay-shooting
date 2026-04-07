import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { ApiResponse, OperationLog } from '@/lib/types';

type QueryFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  (query: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
};

function getDb(): QueryFn {
  return neon(process.env.DATABASE_URL!) as unknown as QueryFn;
}

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
    const sql = getDb();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const tournamentId = url.searchParams.get('tournament_id');
    const action = url.searchParams.get('action');
    const affiliation = url.searchParams.get('affiliation');

    // 運営管理者は自所属で強制フィルター
    const effectiveAffiliation = isSystem ? (affiliation || null) : userAffiliation;

    // 動的クエリ構築（パラメータ付き文字列）
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (tournamentId) {
      params.push(Number(tournamentId));
      conditions.push(`tournament_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }
    if (effectiveAffiliation) {
      params.push(effectiveAffiliation);
      conditions.push(`admin_affiliation = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // データ取得
    const dataParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const rows = await sql(
      `SELECT * FROM operation_logs ${where} ORDER BY logged_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParams
    );

    // 総件数
    const countRows = await sql(
      `SELECT COUNT(*)::int AS total FROM operation_logs ${where}`,
      params
    );
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
