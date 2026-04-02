import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendCancelToken } from '@/lib/email';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/cancel/request-token
// body: { email: string }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();
    const email: string = (body.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'メールアドレスを入力してください' }, { status: 400 });
    }

    // 大会情報取得
    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = rows[0];

    // キャンセル期限チェック（cancel_end_at + 5分）
    if (!t.cancel_end_at) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル受付が設定されていません' }, { status: 400 });
    }
    if (Date.now() > new Date(t.cancel_end_at).getTime() + 5 * 60 * 1000) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル期限を超えたためキャンセルできません' }, { status: 400 });
    }

    // 申込確認（同一メールのactive申込）
    const regRows = await sql`
      SELECT id FROM registrations
      WHERE tournament_id = ${tid}
        AND email = ${email}
        AND status = 'active'
    `;
    if (!regRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込が見つかりません' }, { status: 400 });
    }

    // トークン生成
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await sql`
      INSERT INTO registration_tokens (tournament_id, email, token, purpose, expires_at)
      VALUES (${tid}, ${email}, ${token}, 'cancel', ${expiresAt.toISOString()})
    `;

    const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://clay-shooting.vercel.app';
    const cancelUrl = `${BASE_URL}/tournaments/${tid}/cancel/${token}`;
    await sendCancelToken(email, t.name, cancelUrl);

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'メール送信に失敗しました' }, { status: 500 });
  }
}
