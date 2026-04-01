import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

function unauth() { return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 }); }
function forbidden() { return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 }); }

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
