import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
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
        WHERE total > 0
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

    const rows = await sql`
      INSERT INTO tournaments (name, venue, day1_date, day2_date, event_type, day1_set, day2_set, organizer_cd)
      VALUES (
        ${body.name.trim()},
        ${body.venue ?? null},
        ${body.day1_date ?? null},
        ${body.day2_date ?? null},
        ${body.event_type ?? 'trap'},
        ${body.day1_set ?? null},
        ${body.day2_set ?? null},
        ${body.organizer_cd ?? 27}
      )
      RETURNING *
    `;
    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: rows[0] as Tournament }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会の作成に失敗しました' }, { status: 500 });
  }
}
