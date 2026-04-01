import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// GET /api/faq?q=検索語&category=カテゴリ — 公開Q&A一覧
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category')?.trim() ?? '';

  const sql = neon(process.env.DATABASE_URL!);

  let rows;
  if (q && category) {
    rows = await sql`
      SELECT id, category, title, question, answer, published_at
      FROM faq_items
      WHERE category = ${category}
        AND (title ILIKE ${'%' + q + '%'} OR question ILIKE ${'%' + q + '%'} OR answer ILIKE ${'%' + q + '%'})
      ORDER BY sort_order, published_at DESC
    `;
  } else if (q) {
    rows = await sql`
      SELECT id, category, title, question, answer, published_at
      FROM faq_items
      WHERE title ILIKE ${'%' + q + '%'} OR question ILIKE ${'%' + q + '%'} OR answer ILIKE ${'%' + q + '%'}
      ORDER BY sort_order, published_at DESC
    `;
  } else if (category) {
    rows = await sql`
      SELECT id, category, title, question, answer, published_at
      FROM faq_items
      WHERE category = ${category}
      ORDER BY sort_order, published_at DESC
    `;
  } else {
    rows = await sql`
      SELECT id, category, title, question, answer, published_at
      FROM faq_items
      ORDER BY sort_order, published_at DESC
    `;
  }

  return NextResponse.json({ success: true, data: rows });
}
