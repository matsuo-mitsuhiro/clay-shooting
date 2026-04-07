import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import type { Tournament, TournamentInput, ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// HH:MM:SS → HH:MM（秒を除去）
function stripSeconds(time: string | null | undefined): string | null | undefined {
  if (time == null) return time;
  // "HH:MM:SS" or "HH:MM" → "HH:MM"
  return time.slice(0, 5);
}

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
    const body: Partial<TournamentInput> & {
    _save_type?: string;
    rule_type?: string;
    weather?: string;
    temperature?: string;
    wind_speed?: string;
    chief_judge?: string;
    operation_manager?: string;
    record_manager?: string;
    set_checker?: string;
    clay_name?: string;
    class_division?: string;
  } = await req.json();

    // セッションからユーザー名を取得
    const session = await getServerSession(authOptions);
    const userName = session?.user?.name ?? session?.user?.email ?? null;

    // _save_type: 'info' = 大会情報保存, 'apply' = 申込設定保存, 'inspection' = 記録審査保存
    const saveType = body._save_type;

    // 時間フィールドの秒を除去（HH:MM形式に統一）
    const gateOpenTime = stripSeconds(body.gate_open_time);
    const receptionStartTime = stripSeconds(body.reception_start_time);
    const practiceClayTime = stripSeconds(body.practice_clay_time);
    const competitionStartTime = stripSeconds(body.competition_start_time);

    const rows = await sql`
      UPDATE tournaments SET
        name                 = COALESCE(${body.name         ?? null}, name),
        venue                = COALESCE(${body.venue        ?? null}, venue),
        day1_date            = COALESCE(${body.day1_date    ?? null}::date, day1_date),
        day2_date            = ${body.day2_date !== undefined ? (body.day2_date || null) : sql`day2_date`},
        event_type           = COALESCE(${body.event_type   ?? null}, event_type),
        day1_set             = COALESCE(${body.day1_set     ?? null}, day1_set),
        day2_set             = COALESCE(${body.day2_set     ?? null}, day2_set),
        organizer_cd         = COALESCE(${body.organizer_cd ?? null}, organizer_cd),
        admin_qr             = COALESCE(${body.admin_qr     ?? null}, admin_qr),
        viewer_qr            = COALESCE(${body.viewer_qr    ?? null}, viewer_qr),
        max_participants     = ${body.max_participants     !== undefined ? (body.max_participants ?? null) : sql`max_participants`},
        apply_start_at       = ${body.apply_start_at       !== undefined ? (body.apply_start_at ? sql`${body.apply_start_at}::timestamptz` : null) : sql`apply_start_at`},
        apply_end_at         = ${body.apply_end_at         !== undefined ? (body.apply_end_at ? sql`${body.apply_end_at}::timestamptz` : null) : sql`apply_end_at`},
        cancel_end_at        = ${body.cancel_end_at        !== undefined ? (body.cancel_end_at ? sql`${body.cancel_end_at}::timestamptz` : null) : sql`cancel_end_at`},
        competition_start_time = ${competitionStartTime !== undefined ? (competitionStartTime || null) : sql`competition_start_time`},
        gate_open_time       = ${gateOpenTime       !== undefined ? (gateOpenTime || null) : sql`gate_open_time`},
        reception_start_time = ${receptionStartTime !== undefined ? (receptionStartTime || null) : sql`reception_start_time`},
        practice_clay_time   = ${practiceClayTime   !== undefined ? (practiceClayTime || null) : sql`practice_clay_time`},
        cancellation_notice  = ${body.cancellation_notice  !== undefined ? (body.cancellation_notice || null) : sql`cancellation_notice`},
        notes                = ${body.notes                !== undefined ? (body.notes || null) : sql`notes`},
        apply_qr             = ${body.apply_qr             !== undefined ? (body.apply_qr || null) : sql`apply_qr`},
        info_saved_at        = ${saveType === 'info' ? sql`NOW()` : sql`info_saved_at`},
        info_saved_by        = ${saveType === 'info' ? (userName ?? sql`info_saved_by`) : sql`info_saved_by`},
        apply_saved_at       = ${saveType === 'apply' ? sql`NOW()` : sql`apply_saved_at`},
        apply_saved_by       = ${saveType === 'apply' ? (userName ?? sql`apply_saved_by`) : sql`apply_saved_by`},
        rule_type            = ${body.rule_type !== undefined ? (body.rule_type || null) : sql`rule_type`},
        weather              = ${body.weather !== undefined ? (body.weather || null) : sql`weather`},
        temperature          = ${body.temperature !== undefined ? (body.temperature || null) : sql`temperature`},
        wind_speed           = ${body.wind_speed !== undefined ? (body.wind_speed || null) : sql`wind_speed`},
        chief_judge          = ${body.chief_judge !== undefined ? (body.chief_judge || null) : sql`chief_judge`},
        operation_manager    = ${body.operation_manager !== undefined ? (body.operation_manager || null) : sql`operation_manager`},
        record_manager       = ${body.record_manager !== undefined ? (body.record_manager || null) : sql`record_manager`},
        set_checker          = ${body.set_checker !== undefined ? (body.set_checker || null) : sql`set_checker`},
        clay_name            = ${body.clay_name !== undefined ? (body.clay_name || null) : sql`clay_name`},
        class_division       = ${body.class_division !== undefined ? (body.class_division || null) : sql`class_division`},
        updated_at           = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const updated = rows[0] as Tournament;
    const actionType = saveType === 'apply' ? 'apply_settings' as const
      : saveType === 'inspection' ? 'inspection_save' as const
      : 'tournament_update' as const;

    await writeOperationLog({
      tournamentId: updated.id,
      tournamentName: updated.name,
      adminName: userName,
      adminAffiliation: session?.user?.affiliation ?? null,
      action: actionType,
    });

    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会情報の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/tournaments/[id] — 大会削除
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);

    // 削除前に大会名を取得（ログ用）
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tournamentId}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;

    const session = await getServerSession(authOptions);
    const adminName = session?.user?.name ?? session?.user?.email ?? null;
    const adminAffiliation = session?.user?.affiliation ?? null;

    await sql`DELETE FROM tournaments WHERE id = ${tournamentId}`;

    await writeOperationLog({
      tournamentId,
      tournamentName,
      adminName,
      adminAffiliation,
      action: 'tournament_delete',
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会の削除に失敗しました' }, { status: 500 });
  }
}
