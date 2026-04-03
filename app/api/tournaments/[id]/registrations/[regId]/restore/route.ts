import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string; regId: string }> };

// POST /api/tournaments/[id]/registrations/[regId]/restore — キャンセル済み申込を未移行に戻す
export async function POST(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id, regId } = await params;
    const tid = Number(id);
    const rid = Number(regId);

    const rows = await sql`
      UPDATE registrations
      SET status = 'active',
          transferred_at = NULL,
          cancelled_at = NULL,
          cancelled_by = NULL,
          cancelled_by_name = NULL
      WHERE id = ${rid} AND tournament_id = ${tid} AND status = 'cancelled'
      RETURNING id
    `;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '対象の申込が見つかりません' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '復元に失敗しました' }, { status: 500 });
  }
}
