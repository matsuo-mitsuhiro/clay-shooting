import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/cancel/submit
// body: { token: string }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();
    const token: string = (body.token ?? '').trim();

    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'URLが無効です' }, { status: 400 });
    }

    // トークン検証
    const tokenRows = await sql`
      SELECT * FROM registration_tokens
      WHERE token = ${token} AND purpose = 'cancel'
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
    if (tok.tournament_id !== tid) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'URLが無効です' }, { status: 400 });
    }

    // 大会情報取得・キャンセル期限チェック
    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = rows[0];
    if (!t.cancel_end_at || Date.now() > new Date(t.cancel_end_at).getTime() + 5 * 60 * 1000) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル期限を超えたためキャンセルできません' }, { status: 400 });
    }

    // 申込をキャンセルに変更
    const updRows = await sql`
      UPDATE registrations
      SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'user'
      WHERE tournament_id = ${tid}
        AND email = ${tok.email}
        AND status = 'active'
      RETURNING *
    `;
    if (!updRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル対象の申込が見つかりません' }, { status: 400 });
    }

    // ログ記録
    const reg = updRows[0];
    await sql`
      INSERT INTO registration_logs (tournament_id, log_type, member_code, email, note)
      VALUES (${tid}, 'cancel_by_user', ${reg.member_code}, ${tok.email}, 'ユーザーによるキャンセル')
    `;

    // トークンを使用済みにする
    await sql`UPDATE registration_tokens SET used_at = NOW() WHERE id = ${tok.id}`;

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル処理に失敗しました' }, { status: 500 });
  }
}
