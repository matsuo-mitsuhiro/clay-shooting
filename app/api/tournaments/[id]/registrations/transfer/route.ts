import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse, Registration } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/registrations/transfer — 申込者を一括登録形式で返す（要認証）
export async function POST(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tid = Number(id);

    // 大会情報取得（募集終了チェック）
    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = rows[0];

    // 募集終了前はNG
    if (!t.apply_end_at || Date.now() <= new Date(t.apply_end_at).getTime() + 5 * 60 * 1000) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'まだ申込期間中のため、一括登録への移行はできません',
      }, { status: 400 });
    }

    // active な申込者一覧
    const regRows = await sql`
      SELECT * FROM registrations
      WHERE tournament_id = ${tid} AND status = 'active'
      ORDER BY applied_at ASC
    `;

    const registrations = regRows as Registration[];

    return NextResponse.json<ApiResponse<Registration[]>>({ success: true, data: registrations });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
