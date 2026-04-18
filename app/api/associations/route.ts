import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// GET /api/associations - 全協会一覧（cd昇順、99は末尾）
export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT cd, name, formal_name, cancellation_notice, notes, president_name
      FROM associations
      ORDER BY CASE WHEN cd = 99 THEN 999 ELSE cd END
    `;
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error('GET /api/associations error:', e);
    return NextResponse.json(
      { success: false, error: '協会一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
