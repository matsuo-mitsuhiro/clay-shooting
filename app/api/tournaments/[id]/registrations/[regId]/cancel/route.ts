import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string; regId: string }> };

// POST /api/tournaments/[id]/registrations/[regId]/cancel — 管理者によるキャンセル（要認証）
export async function POST(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id, regId } = await params;
    const tid = Number(id);
    const rid = Number(regId);
    const body = await req.json();
    const adminName: string = body.admin_name ?? jwtToken.name ?? 'admin';

    const rows = await sql`
      UPDATE registrations
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by = 'admin',
          cancelled_by_name = ${adminName}
      WHERE id = ${rid} AND tournament_id = ${tid} AND status = 'active'
      RETURNING *
    `;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル対象の申込が見つかりません' }, { status: 404 });
    }

    const reg = rows[0];

    // ログ記録（既存）
    await sql`
      INSERT INTO registration_logs (tournament_id, log_type, member_code, email, note, admin_name)
      VALUES (${tid}, 'cancel_by_admin', ${reg.member_code}, ${reg.email}, '管理者によるキャンセル', ${adminName})
    `;

    // 操作ログ
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;

    await writeOperationLog({
      tournamentId: tid,
      tournamentName,
      adminName,
      adminAffiliation: (jwtToken.affiliation as string) ?? null,
      action: 'registration_cancel',
      detail: `${reg.member_code} ${reg.name}`,
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'キャンセル処理に失敗しました' }, { status: 500 });
  }
}
