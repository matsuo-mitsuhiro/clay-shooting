import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendApplyCode } from '@/lib/email';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/apply/request-token
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

    // 申込期間チェック（apply_end_at + 5分）
    const now = Date.now();
    if (!t.apply_start_at || !t.apply_end_at) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込受付が設定されていません' }, { status: 400 });
    }
    if (now < new Date(t.apply_start_at).getTime()) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'まだ申込受付期間ではありません' }, { status: 400 });
    }
    if (now > new Date(t.apply_end_at).getTime() + 5 * 60 * 1000) {
      return NextResponse.json<ApiResponse>({ success: false, error: '募集終了日時を過ぎました。' }, { status: 400 });
    }

    // 6桁コード生成・10分有効期限
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      INSERT INTO registration_tokens (tournament_id, email, token, purpose, expires_at)
      VALUES (${tid}, ${email}, ${code}, 'apply', ${expiresAt.toISOString()})
    `;

    await sendApplyCode(email, t.name, code);

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'メール送信に失敗しました' }, { status: 500 });
  }
}
