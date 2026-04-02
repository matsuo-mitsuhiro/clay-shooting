import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// GET /api/shooting-ranges - 全射撃場一覧（id順）
export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, prefecture, name
      FROM shooting_ranges
      ORDER BY id
    `;
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error('GET /api/shooting-ranges error:', e);
    return NextResponse.json(
      { success: false, error: '射撃場一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST /api/shooting-ranges - 新規作成（system adminのみ）
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'system') {
      return NextResponse.json(
        { success: false, error: 'システム管理者のみ実行できます' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { prefecture, name } = body as { prefecture?: string; name?: string };

    if (!prefecture?.trim() || !name?.trim()) {
      return NextResponse.json(
        { success: false, error: '都道府県名と射撃場名は必須です' },
        { status: 400 }
      );
    }

    const sql = getDb();
    const rows = await sql`
      INSERT INTO shooting_ranges (prefecture, name)
      VALUES (${prefecture.trim()}, ${name.trim()})
      RETURNING id, prefecture, name
    `;

    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (e) {
    console.error('POST /api/shooting-ranges error:', e);
    return NextResponse.json(
      { success: false, error: '射撃場の作成に失敗しました' },
      { status: 500 }
    );
  }
}
