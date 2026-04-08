import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// GET /api/associations/[cd] - 1件取得（射撃場リスト含む）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cd: string }> }
) {
  try {
    const { cd } = await params;
    const cdNum = Number(cd);
    if (isNaN(cdNum)) {
      return NextResponse.json({ success: false, error: '無効なcd値です' }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT cd, name, cancellation_notice, notes, president_name
      FROM associations
      WHERE cd = ${cdNum}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '協会が見つかりません' }, { status: 404 });
    }

    const assoc = rows[0];

    // 紐づく射撃場IDリストを取得
    const rangeRows = await sql`
      SELECT shooting_range_id
      FROM association_shooting_ranges
      WHERE association_cd = ${cdNum}
      ORDER BY shooting_range_id
    `;
    const shooting_range_ids = rangeRows.map((r) => Number(r.shooting_range_id));

    return NextResponse.json({
      success: true,
      data: { ...assoc, shooting_range_ids },
    });
  } catch (e) {
    console.error('GET /api/associations/[cd] error:', e);
    return NextResponse.json(
      { success: false, error: '協会情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PUT /api/associations/[cd] - 更新（cancellation_notice, notes, shooting_range_ids[]）
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cd: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { cd } = await params;
    const cdNum = Number(cd);
    if (isNaN(cdNum)) {
      return NextResponse.json({ success: false, error: '無効なcd値です' }, { status: 400 });
    }

    // tournament admin は自分の協会のみ編集可
    if (session.user.role !== 'system') {
      // affiliation から協会cdを確認
      const sql = getDb();
      const assocRows = await sql`
        SELECT cd FROM associations WHERE name = ${session.user.affiliation ?? ''}
      `;
      if (assocRows.length === 0 || Number(assocRows[0].cd) !== cdNum) {
        return NextResponse.json(
          { success: false, error: 'この協会を編集する権限がありません' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const { cancellation_notice, notes, president_name, shooting_range_ids } = body as {
      cancellation_notice?: string | null;
      notes?: string | null;
      president_name?: string | null;
      shooting_range_ids?: number[];
    };

    const sql = getDb();

    // 基本情報更新
    await sql`
      UPDATE associations
      SET cancellation_notice = ${cancellation_notice ?? null},
          notes = ${notes ?? null},
          president_name = ${president_name ?? null},
          updated_at = NOW()
      WHERE cd = ${cdNum}
    `;

    // 射撃場紐付けを全削除→再挿入
    await sql`DELETE FROM association_shooting_ranges WHERE association_cd = ${cdNum}`;

    if (shooting_range_ids && shooting_range_ids.length > 0) {
      for (const rid of shooting_range_ids) {
        await sql`
          INSERT INTO association_shooting_ranges (association_cd, shooting_range_id)
          VALUES (${cdNum}, ${rid})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PUT /api/associations/[cd] error:', e);
    return NextResponse.json(
      { success: false, error: '協会情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}
