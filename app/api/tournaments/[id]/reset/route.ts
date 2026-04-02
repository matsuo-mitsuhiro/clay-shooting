import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/reset
// メンバー・点数を全削除（大会情報・QRは保持）
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);

    // セッションからユーザー名を取得
    const session = await getServerSession(authOptions);
    const userName = session?.user?.name ?? session?.user?.email ?? null;

    // 大会存在チェック
    const rows = await sql`SELECT id FROM tournaments WHERE id = ${tournamentId}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }

    // メンバー・点数を削除（QR・大会情報は保持）
    await sql`DELETE FROM members WHERE tournament_id = ${tournamentId}`;
    await sql`DELETE FROM scores  WHERE tournament_id = ${tournamentId}`;

    // リセット実行者・日時を記録
    await sql`
      UPDATE tournaments
      SET reset_at = NOW(), reset_by = ${userName}
      WHERE id = ${tournamentId}
    `;

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'リセットに失敗しました' }, { status: 500 });
  }
}
