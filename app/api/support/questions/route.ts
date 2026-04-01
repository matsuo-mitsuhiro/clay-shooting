import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sendQuestionConfirmation, sendQuestionNotification } from '@/lib/email';

// POST /api/support/questions — 質問送信
export async function POST(req: NextRequest) {
  try {
    const { token, member_code, name, affiliation, email, body } = await req.json();

    if (!token || !member_code || !name || !email || !body) {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // トークン検証
    const rows = await sql`
      SELECT id, expires_at, used_at FROM support_tokens WHERE token = ${token}
    `;
    if (rows.length === 0) return NextResponse.json({ success: false, error: 'URLが無効です' }, { status: 400 });
    const t = rows[0];
    if (t.used_at) return NextResponse.json({ success: false, error: 'このURLはすでに使用済みです' }, { status: 400 });
    if (new Date(t.expires_at) < new Date()) return NextResponse.json({ success: false, error: 'URLの有効期限が切れています' }, { status: 400 });

    // 質問保存
    await sql`
      INSERT INTO support_questions (token, member_code, name, affiliation, email, body)
      VALUES (${token}, ${member_code}, ${name}, ${affiliation ?? null}, ${email}, ${body})
    `;

    // トークン使用済みにする
    await sql`UPDATE support_tokens SET used_at = NOW() WHERE token = ${token}`;

    // メール送信（失敗しても質問は保存済み）
    try {
      await sendQuestionConfirmation(email, name, body);
      await sendQuestionNotification(member_code, name, affiliation ?? null, email, body);
    } catch (mailErr) {
      console.error('Mail error:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
