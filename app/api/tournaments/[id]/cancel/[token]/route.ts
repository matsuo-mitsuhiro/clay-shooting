import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse, Registration } from '@/lib/types';

type Params = { params: Promise<{ id: string; token: string }> };

// GET /api/tournaments/[id]/cancel/[token] — キャンセルトークンから申込情報を取得（認証不要）
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, token } = await params;
    const tid = Number(id);

    const tokenRows = await sql`
      SELECT * FROM registration_tokens
      WHERE token = ${token} AND purpose = 'cancel' AND tournament_id = ${tid}
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

    const regRows = await sql`
      SELECT * FROM registrations
      WHERE tournament_id = ${tid}
        AND email = ${tok.email}
        AND status = 'active'
    `;
    if (!regRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込が見つかりません' }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<Registration>>({ success: true, data: regRows[0] as Registration });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
