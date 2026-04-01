import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { sendRegistrationComplete } from '@/lib/email';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// GET: トークン検証
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ success: false, error: 'トークンがありません' }, { status: 400 });

  const sql = getDb();
  const rows = await sql`
    SELECT id, affiliation, expires_at, used_at FROM admin_invitations WHERE token = ${token}
  `;

  if (rows.length === 0) return NextResponse.json({ success: false, error: 'このリンクは無効です' }, { status: 404 });
  const inv = rows[0];
  if (inv.used_at) return NextResponse.json({ success: false, error: 'このリンクは使用済みです' }, { status: 410 });
  if (new Date(inv.expires_at as string) < new Date()) return NextResponse.json({ success: false, error: 'このリンクは有効期限切れです' }, { status: 410 });

  return NextResponse.json({ success: true, affiliation: inv.affiliation });
}

// POST: 新規登録
export async function POST(req: NextRequest) {
  const { token, member_code, name, email, password } = await req.json();

  if (!token || !member_code || !name || !email || !password) {
    return NextResponse.json({ success: false, error: '必須項目を入力してください' }, { status: 400 });
  }

  // パスワード強度チェック
  if (password.length < 8 || password.length > 32) {
    return NextResponse.json({ success: false, error: 'パスワードは8〜32文字で入力してください' }, { status: 400 });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ success: false, error: 'パスワードは英字と数字を各1文字以上含めてください' }, { status: 400 });
  }

  const sql = getDb();

  // トークン検証
  const invRows = await sql`
    SELECT id, expires_at, used_at FROM admin_invitations WHERE token = ${token}
  `;
  if (invRows.length === 0) return NextResponse.json({ success: false, error: 'このリンクは無効です' }, { status: 404 });
  const inv = invRows[0];
  if (inv.used_at) return NextResponse.json({ success: false, error: 'このリンクは使用済みです' }, { status: 410 });
  if (new Date(inv.expires_at as string) < new Date()) return NextResponse.json({ success: false, error: 'このリンクは有効期限切れです' }, { status: 410 });

  // 選手マスター存在チェック
  const playerRows = await sql`
    SELECT member_code FROM player_master WHERE member_code = ${member_code}
  `;
  if (playerRows.length === 0) {
    return NextResponse.json({
      success: false,
      error: '登録された会員番号は選手マスターに登録されていないため、誠に申し訳ございませんが、登録できません。システム管理者にご相談ください。'
    }, { status: 400 });
  }

  // 重複チェック
  const dupRows = await sql`
    SELECT id FROM tournament_admins WHERE member_code = ${member_code} OR email = ${email}
  `;
  if (dupRows.length > 0) {
    return NextResponse.json({ success: false, error: 'この会員番号またはメールアドレスは既に登録されています。' }, { status: 409 });
  }

  // 登録
  const passwordHash = await bcrypt.hash(password, 12);
  await sql`
    INSERT INTO tournament_admins (member_code, name, email, password_hash)
    VALUES (${member_code}, ${name}, ${email}, ${passwordHash})
  `;

  // トークンを使用済みにする
  await sql`
    UPDATE admin_invitations SET used_at = NOW() WHERE token = ${token}
  `;

  // 登録完了メール送信
  try {
    await sendRegistrationComplete(email, name);
  } catch { /* メール失敗は無視 */ }

  return NextResponse.json({ success: true });
}
