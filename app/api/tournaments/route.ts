import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Tournament, TournamentInput, ApiResponse } from '@/lib/types';

// GET /api/tournaments — 大会一覧取得
export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM tournaments ORDER BY created_at DESC
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
      INSERT INTO tournaments (name, venue, day1_date, day2_date, event_type, day1_set, day2_set)
      VALUES (
        ${body.name.trim()},
        ${body.venue ?? null},
        ${body.day1_date ?? null},
        ${body.day2_date ?? null},
        ${body.event_type ?? 'trap'},
        ${body.day1_set ?? null},
        ${body.day2_set ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json<ApiResponse<Tournament>>({ success: true, data: rows[0] as Tournament }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '大会の作成に失敗しました' }, { status: 500 });
  }
}
