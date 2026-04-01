import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { sendSupportInvitation } from '@/lib/email';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// POST: 質問用トークン発行＆メール送信（システム管理者のみ）
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  if (session.user.role !== 'system') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ success: false, error: 'メールアドレスが必要です' }, { status: 400 });

    const sql = getDb();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

    await sql`
      INSERT INTO support_tokens (token, created_by, email, expires_at)
      VALUES (${token}, ${session.user.member_code ?? null}, ${email}, ${expiresAt.toISOString()})
    `;

    await sendSupportInvitation(email, token);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
