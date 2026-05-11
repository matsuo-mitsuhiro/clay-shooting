import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { sendPasswordReset } from '@/lib/email';

const RATE_LIMIT_WINDOW_SEC = 60 * 60; // 1時間
const RATE_LIMIT_MAX = 5;

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// POST: リセットメール送信
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json(
      { success: false, error: 'メールアドレスを入力してください' },
      { status: 400 },
    );
  }

  const sql = getDb();
  const ip = getClientIp(req);

  // 1時間以内の試行回数を集計（スライディングウィンドウ）
  const limitRows = await sql`
    SELECT
      COUNT(*)::int AS attempts,
      EXTRACT(EPOCH FROM (MIN(created_at) + INTERVAL '1 hour' - NOW()))::int AS retry_after
    FROM password_reset_attempts
    WHERE ip = ${ip}
      AND created_at > NOW() - INTERVAL '1 hour'
  `;
  const attempts = (limitRows[0]?.attempts as number) ?? 0;
  const retryAfter = Math.max(1, (limitRows[0]?.retry_after as number) ?? RATE_LIMIT_WINDOW_SEC);

  if (attempts >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { success: false, error: 'rate_limited', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // 試行を記録（成功/失敗にかかわらず1カウント）
  await sql`INSERT INTO password_reset_attempts (ip) VALUES (${ip})`;

  const rows = await sql`
    SELECT id, name FROM tournament_admins
    WHERE email = ${email} AND is_active = true
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'not_registered' },
      { status: 404 },
    );
  }

  const admin = rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

  await sql`
    INSERT INTO password_reset_tokens (token, admin_id, expires_at)
    VALUES (${token}, ${admin.id as number}, ${expiresAt.toISOString()})
  `;

  try {
    await sendPasswordReset(email, admin.name as string, token);
  } catch {
    /* メール送信失敗は無視（ログイン UI からはわからない方が安全） */
  }

  return NextResponse.json({ success: true });
}
