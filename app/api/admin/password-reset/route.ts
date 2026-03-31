import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { sendPasswordReset } from '@/lib/email';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// POST: リセットメール送信
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ success: false, error: 'メールアドレスを入力してください' }, { status: 400 });

  const sql = getDb();
  const rows = await sql`SELECT id, name FROM tournament_admins WHERE email = ${email} AND is_active = true`;

  // セキュリティのため存在しなくても成功を返す
  if (rows.length > 0) {
    const admin = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

    await sql`
      INSERT INTO password_reset_tokens (token, admin_id, expires_at)
      VALUES (${token}, ${admin.id as number}, ${expiresAt.toISOString()})
    `;

    try {
      await sendPasswordReset(email, admin.name as string, token);
    } catch { /* ignore */ }
  }

  return NextResponse.json({ success: true });
}
