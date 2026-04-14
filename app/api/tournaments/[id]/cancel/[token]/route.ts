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

    // 大会情報を取得
    const tRows = await sql`
      SELECT name, day1_date, day2_date, venue FROM tournaments WHERE id = ${tid}
    `;
    const tournament = tRows.length
      ? { name: tRows[0].name as string, day1_date: tRows[0].day1_date as string | null, day2_date: tRows[0].day2_date as string | null, venue: tRows[0].venue as string | null }
      : null;

    return NextResponse.json({ success: true, data: { registration: regRows[0] as Registration, tournament } });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
