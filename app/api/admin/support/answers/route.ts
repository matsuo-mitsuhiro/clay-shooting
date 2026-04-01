import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { sendAnswerNotification } from '@/lib/email';

function unauth() { return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 }); }
function forbidden() { return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 }); }

// POST /api/admin/support/answers — 回答送信（システム管理者のみ）
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauth();
  if (session.user.role !== 'system') return forbidden();

  try {
    const { question_id, body } = await req.json();
    if (!question_id || !body) {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // 質問取得
    const qs = await sql`SELECT * FROM support_questions WHERE id = ${question_id}`;
    if (qs.length === 0) return NextResponse.json({ success: false, error: '質問が見つかりません' }, { status: 404 });
    const q = qs[0];

    // 既存回答があれば更新、なければ挿入
    const existing = await sql`SELECT id FROM support_answers WHERE question_id = ${question_id}`;
    if (existing.length > 0) {
      await sql`UPDATE support_answers SET body = ${body}, answered_at = NOW() WHERE question_id = ${question_id}`;
    } else {
      await sql`INSERT INTO support_answers (question_id, body) VALUES (${question_id}, ${body})`;
    }

    // 質問ステータスを回答済みに
    await sql`UPDATE support_questions SET status = 'answered' WHERE id = ${question_id}`;

    // 回答メール送信
    try {
      await sendAnswerNotification(q.email, q.name, q.body, body);
    } catch (mailErr) {
      console.error('Mail error:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
