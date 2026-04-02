import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// DELETE /api/shooting-ranges/[id] - 削除（system adminのみ）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'system') {
      return NextResponse.json(
        { success: false, error: 'システム管理者のみ実行できます' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const idNum = Number(id);
    if (isNaN(idNum)) {
      return NextResponse.json({ success: false, error: '無効なID値です' }, { status: 400 });
    }

    const sql = getDb();
    const result = await sql`
      DELETE FROM shooting_ranges WHERE id = ${idNum} RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: '射撃場が見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/shooting-ranges/[id] error:', e);
    return NextResponse.json(
      { success: false, error: '射撃場の削除に失敗しました' },
      { status: 500 }
    );
  }
}
