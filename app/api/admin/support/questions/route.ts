import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

function unauth() { return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 }); }
function forbidden() { return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 }); }

// GET /api/admin/support/questions — 質問一覧（システム管理者のみ）
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauth();
  if (session.user.role !== 'system') return forbidden();

  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT
      q.id, q.member_code, q.name, q.affiliation, q.email, q.body, q.status, q.created_at,
      a.id AS answer_id, a.body AS answer_body, a.answered_at
    FROM support_questions q
    LEFT JOIN support_answers a ON a.question_id = q.id
    ORDER BY q.created_at DESC
  `;
  return NextResponse.json({ success: true, data: rows });
}
