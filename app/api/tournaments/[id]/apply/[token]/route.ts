import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse, Tournament } from '@/lib/types';

type Params = { params: Promise<{ id: string; token: string }> };

// GET /api/tournaments/[id]/apply/[token] — 申込トークンから大会情報を取得（認証不要）
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, token } = await params;
    const tid = Number(id);

    const tokenRows = await sql`
      SELECT * FROM registration_tokens
      WHERE token = ${token} AND purpose = 'apply' AND tournament_id = ${tid}
    `;
    if (!tokenRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'URLが無効です' }, { status: 400 });
    }
    const tok = tokenRows[0];

    if (tok.used_at) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'このURLは既に使用済みです' }, { status: 400 });
    }
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'URLの有効期限が切れています' }, { status: 400 });
    }

    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: rows[0] as Tournament });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
