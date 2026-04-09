import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import type { Tournament, TournamentInput, ApiResponse } from '@/lib/types';

// GET /api/tournaments — 大会一覧取得（member_count / score_count 付き）
export async function GET() {
  try {
    const rows = await sql`
      SELECT
        t.*,
        COALESCE(m.member_count, 0)::int AS member_count,
        COALESCE(s.score_count, 0)::int  AS score_count
      FROM tournaments t
      LEFT JOIN (
        SELECT tournament_id, COUNT(*) AS member_count
        FROM members
        GROUP BY tournament_id
      ) m ON m.tournament_id = t.id
      LEFT JOIN (
        SELECT tournament_id, COUNT(*) AS score_count
        FROM scores
        WHERE COALESCE(r1,0)+COALESCE(r2,0)+COALESCE(r3,0)+COALESCE(r4,0)+COALESCE(r5,0)+COALESCE(r6,0)+COALESCE(r7,0)+COALESCE(r8,0) > 0
        GROUP BY tournament_id
      ) s ON s.tournament_id = t.id
      ORDER BY t.created_at DESC
    `;
    return NextResponse.json<ApiResponse<Tournament[]>>({ success: true, data: rows as Tournament[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/tournaments — 大会新規作成
export async function POST(req: NextRequest) {
  try {
    const body: TournamentInput = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会名は必須です' }, { status: 400 });
    }

    // 大会名の同年重複チェック（day1_dateの年で判定）
    const targetYear = body.day1_date ? body.day1_date.slice(0, 4) : new Date().getFullYear().toString();
    const dupCheck = await sql`
      SELECT id FROM tournaments
      WHERE TRIM(name) = ${body.name.trim()}
        AND EXTRACT(YEAR FROM day1_date)::text = ${targetYear}
    `;
    if (dupCheck.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '同じ大会名が登録されていますので、この大会名では登録できません。' },
        { status: 409 }
      );
    }

    const session = await getServerSession(authOptions);
    const adminName = session?.user?.name ?? session?.user?.email ?? null;
    const adminAffiliation = session?.user?.affiliation ?? null;

    const rows = await sql`
      INSERT INTO tournaments (
        name, venue, day1_date, day2_date, event_type, day1_set, day2_set, organizer_cd,
        max_participants, competition_start_time, gate_open_time, reception_start_time, practice_clay_time,
        cancellation_notice, notes,
        rule_type, chief_judge, operation_manager, record_manager, set_checker, clay_name, class_division,
        squad_comment
      )
      VALUES (
        ${body.name.trim()},
        ${body.venue ?? null},
        ${body.day1_date ?? null},
        ${body.day2_date ?? null},
        ${body.event_type ?? 'trap'},
        ${body.day1_set ?? null},
        ${body.day2_set ?? null},
        ${body.organizer_cd ?? 27},
        ${body.max_participants ?? null},
        ${body.competition_start_time ?? null},
        ${body.gate_open_time ?? null},
        ${body.reception_start_time ?? null},
        ${body.practice_clay_time ?? null},
        ${body.cancellation_notice ?? null},
        ${body.notes ?? null},
        ${body.rule_type ?? null},
        ${body.chief_judge ?? null},
        ${body.operation_manager ?? null},
        ${body.record_manager ?? null},
        ${body.set_checker ?? null},
        ${body.clay_name ?? null},
        ${body.class_division ?? 'none'},
        ${body.squad_comment ?? null}
      )
      RETURNING *
    `;
    const created = rows[0] as Tournament;

    await writeOperationLog({
      tournamentId: created.id,
      tournamentName: created.name,
      adminName,
      adminAffiliation,
      action: 'tournament_create',
    });

    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会の作成に失敗しました' }, { status: 500 });
  }
}
