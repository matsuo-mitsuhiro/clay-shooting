import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { sendSupportInvitation } from '@/lib/email';

// POST /api/support/request-token — 認証不要・誰でも質問URLをリクエスト可能
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

    await sql`
      INSERT INTO support_tokens (token, email, expires_at)
      VALUES (${token}, ${email.trim()}, ${expiresAt.toISOString()})
    `;

    await sendSupportInvitation(email.trim(), token);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: '送信に失敗しました。しばらく経ってから再度お試しください。' }, { status: 500 });
  }
}
