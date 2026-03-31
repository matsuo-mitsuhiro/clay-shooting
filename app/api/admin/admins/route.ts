import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);

function unauthorized() {
  return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
}

// GET: 大会管理者一覧取得
// システム管理者: 全件、大会管理者: 自所属のみ（player_master経由）
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    if (session.user.role === 'system') {
      // 全件 + player_masterから現在の所属を結合
      const rows = await sql`
        SELECT
          ta.id, ta.member_code, ta.name, ta.email, ta.is_active, ta.created_at,
          pm.affiliation AS current_affiliation
        FROM tournament_admins ta
        LEFT JOIN player_master pm ON pm.member_code = ta.member_code
        ORDER BY ta.created_at DESC
      `;
      return NextResponse.json({ success: true, data: rows });
    } else {
      // 自所属のみ
      const myAffiliation = session.user.affiliation;
      const rows = await sql`
        SELECT
          ta.id, ta.member_code, ta.name, ta.email, ta.is_active, ta.created_at,
          pm.affiliation AS current_affiliation
        FROM tournament_admins ta
        LEFT JOIN player_master pm ON pm.member_code = ta.member_code
        WHERE pm.affiliation = ${myAffiliation}
        ORDER BY ta.created_at DESC
      `;
      return NextResponse.json({ success: true, data: rows });
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// POST: 大会管理者新規作成（システム管理者のみ）
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  if (session.user.role !== 'system') return forbidden();

  try {
    const { member_code, name, email, password } = await req.json();
    if (!member_code || !name || !email || !password) {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'パスワードは8文字以上で設定してください' }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO tournament_admins (member_code, name, email, password_hash)
      VALUES (${member_code}, ${name}, ${email}, ${hash})
      RETURNING id, member_code, name, email, is_active, created_at
    `;
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ success: false, error: '会員番号またはメールアドレスが既に登録されています' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT: 大会管理者更新
// システム管理者: 全フィールド、大会管理者: 自分のemail/passwordのみ
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const { id, email, password, is_active } = body;

    if (session.user.role === 'system') {
      // システム管理者: email, is_active, パスワードリセット可
      if (password) {
        if (password.length < 8) {
          return NextResponse.json({ success: false, error: 'パスワードは8文字以上で設定してください' }, { status: 400 });
        }
        const hash = await bcrypt.hash(password, 12);
        await sql`
          UPDATE tournament_admins
          SET email = ${email}, password_hash = ${hash}, is_active = ${is_active ?? true}
          WHERE id = ${id}
        `;
      } else {
        await sql`
          UPDATE tournament_admins
          SET email = ${email}, is_active = ${is_active ?? true}
          WHERE id = ${id}
        `;
      }
    } else {
      // 大会管理者: 自分のレコードのみ変更可
      const myCode = session.user.member_code;
      const check = await sql`SELECT id FROM tournament_admins WHERE id = ${id} AND member_code = ${myCode}`;
      if (check.length === 0) return forbidden();

      if (password) {
        if (password.length < 8) {
          return NextResponse.json({ success: false, error: 'パスワードは8文字以上で設定してください' }, { status: 400 });
        }
        const hash = await bcrypt.hash(password, 12);
        await sql`UPDATE tournament_admins SET email = ${email}, password_hash = ${hash} WHERE id = ${id}`;
      } else {
        await sql`UPDATE tournament_admins SET email = ${email} WHERE id = ${id}`;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// DELETE: 大会管理者削除（システム管理者のみ）
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  if (session.user.role !== 'system') return forbidden();

  try {
    const { id } = await req.json();
    await sql`DELETE FROM tournament_admins WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
