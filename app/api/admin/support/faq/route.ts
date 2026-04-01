import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

function unauth() { return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 }); }
function forbidden() { return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 }); }

// GET /api/admin/support/faq — Q&A一覧取得（管理者用・全件）
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauth();
  if (session.user.role !== 'system') return forbidden();

  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT id, category, title, question, answer, published_at, sort_order
    FROM faq_items
    ORDER BY sort_order, published_at DESC
  `;
  return NextResponse.json({ success: true, data: rows });
}

// POST /api/admin/support/faq — Q&Aに掲載
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauth();
  if (session.user.role !== 'system') return forbidden();

  try {
    const { question, answer, category, title } = await req.json();
    if (!question || !answer || !category) {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      INSERT INTO faq_items (category, title, question, answer)
      VALUES (${category}, ${title ?? ''}, ${question}, ${answer})
      RETURNING id
    `;
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// PUT /api/admin/support/faq — Q&A更新
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauth();
  if (session.user.role !== 'system') return forbidden();

  try {
    const { id, category, title, question, answer } = await req.json();
    if (!id || !category || !question || !answer) {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE faq_items
      SET category = ${category}, title = ${title ?? ''}, question = ${question}, answer = ${answer}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// DELETE /api/admin/support/faq — Q&A削除
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauth();
  if (session.user.role !== 'system') return forbidden();

  try {
    const { id } = await req.json();
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM faq_items WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
