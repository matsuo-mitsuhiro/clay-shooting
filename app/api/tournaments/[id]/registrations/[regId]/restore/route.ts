import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
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

    // 復元前に情報取得（ログ用）
    const regRows = await sql`
      SELECT member_code, name FROM registrations
      WHERE id = ${rid} AND tournament_id = ${tid} AND status = 'cancelled'
    `;

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

    // 操作ログ
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;
    const reg = regRows.length ? (regRows[0] as { member_code: string; name: string }) : null;

    await writeOperationLog({
      tournamentId: tid,
      tournamentName,
      adminName: (jwtToken.name as string) ?? null,
      adminAffiliation: (jwtToken.affiliation as string) ?? null,
      action: 'registration_restore',
      detail: reg ? `${reg.member_code} ${reg.name}` : null,
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '復元に失敗しました' }, { status: 500 });
  }
}
