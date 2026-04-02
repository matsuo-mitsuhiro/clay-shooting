import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse, Registration } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/tournaments/[id]/registrations — 申込一覧（要認証）
export async function GET(req: NextRequest, { params }: Params) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tid = Number(id);

    const rows = await sql`
      SELECT * FROM registrations
      WHERE tournament_id = ${tid}
      ORDER BY applied_at ASC
    `;

    return NextResponse.json<ApiResponse<Registration[]>>({ success: true, data: rows as Registration[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
