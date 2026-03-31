import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// GET: トークン検証
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sql = getDb();
  const rows = await sql`
    SELECT id, expires_at, used_at FROM password_reset_tokens WHERE token = ${token}
  `;
  if (rows.length === 0) return NextResponse.json({ success: false, error: 'このリンクは無効です' }, { status: 404 });
  const row = rows[0];
  if (row.used_at) return NextResponse.json({ success: false, error: 'このリンクは使用済みです' }, { status: 410 });
  if (new Date(row.expires_at as string) < new Date()) return NextResponse.json({ success: false, error: 'このリンクは有効期限切れです（1時間以内に使用してください）' }, { status: 410 });

  return NextResponse.json({ success: true });
}

// POST: パスワード更新
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { password } = await req.json();

  if (!password) return NextResponse.json({ success: false, error: 'パスワードを入力してください' }, { status: 400 });
  if (password.length < 8 || password.length > 32) return NextResponse.json({ success: false, error: 'パスワードは8〜32文字で入力してください' }, { status: 400 });
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return NextResponse.json({ success: false, error: 'パスワードは英字と数字を各1文字以上含めてください' }, { status: 400 });

  const sql = getDb();
  const rows = await sql`
    SELECT id, admin_id, expires_at, used_at FROM password_reset_tokens WHERE token = ${token}
  `;
  if (rows.length === 0) return NextResponse.json({ success: false, error: 'このリンクは無効です' }, { status: 404 });
  const row = rows[0];
  if (row.used_at) return NextResponse.json({ success: false, error: 'このリンクは使用済みです' }, { status: 410 });
  if (new Date(row.expires_at as string) < new Date()) return NextResponse.json({ success: false, error: 'このリンクは有効期限切れです' }, { status: 410 });

  const passwordHash = await bcrypt.hash(password, 12);
  await sql`UPDATE tournament_admins SET password_hash = ${passwordHash} WHERE id = ${row.admin_id as number}`;
  await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ${token}`;

  return NextResponse.json({ success: true });
}
