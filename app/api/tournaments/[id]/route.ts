import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Tournament, TournamentInput, ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/tournaments/[id] — 大会情報取得
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const rows = await sql`SELECT * FROM tournaments WHERE id = ${Number(id)}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: rows[0] as Tournament });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/tournaments/[id] — 大会情報更新
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body: Partial<TournamentInput> = await req.json();

    const rows = await sql`
      UPDATE tournaments SET
        name         = COALESCE(${body.name         ?? null}, name),
        venue        = COALESCE(${body.venue        ?? null}, venue),
        day1_date    = COALESCE(${body.day1_date    ?? null}::date, day1_date),
        day2_date    = ${body.day2_date !== undefined ? (body.day2_date || null) : sql`day2_date`},
        event_type   = COALESCE(${body.event_type   ?? null}, event_type),
        day1_set     = COALESCE(${body.day1_set     ?? null}, day1_set),
        day2_set     = COALESCE(${body.day2_set     ?? null}, day2_set),
        organizer_cd = COALESCE(${body.organizer_cd ?? null}, organizer_cd),
        admin_qr     = COALESCE(${body.admin_qr     ?? null}, admin_qr),
        viewer_qr    = COALESCE(${body.viewer_qr    ?? null}, viewer_qr),
        updated_at   = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: rows[0] as Tournament });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会情報の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/tournaments/[id] — 大会削除
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await sql`DELETE FROM tournaments WHERE id = ${Number(id)}`;
    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会の削除に失敗しました' }, { status: 500 });
  }
}
