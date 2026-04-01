import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// GET /api/support/validate?token=xxx — トークン検証
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ valid: false, error: 'トークンがありません' });

  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT id, email, expires_at, used_at FROM support_tokens WHERE token = ${token}
  `;

  if (rows.length === 0) return NextResponse.json({ valid: false, error: 'URLが無効です' });

  const t = rows[0];
  if (t.used_at) return NextResponse.json({ valid: false, error: 'このURLはすでに使用済みです' });
  if (new Date(t.expires_at) < new Date()) return NextResponse.json({ valid: false, error: 'URLの有効期限が切れています' });

  return NextResponse.json({ valid: true, email: t.email ?? '' });
}
