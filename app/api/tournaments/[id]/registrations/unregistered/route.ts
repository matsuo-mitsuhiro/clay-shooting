import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

export interface UnregisteredEntry {
  member_code: string;
  name: string;
  belong: string | null;
  participation_day: string;
}

// GET /api/tournaments/[id]/registrations/unregistered
// 申込済み（active）だが members に登録されていない選手を返す
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = Number(id);

  try {
    const rows = await sql`
      SELECT r.member_code, r.name, r.belong, r.participation_day
      FROM registrations r
      WHERE r.tournament_id = ${tournamentId}
        AND r.status = 'active'
        AND r.member_code NOT IN (
          SELECT DISTINCT member_code
          FROM members
          WHERE tournament_id = ${tournamentId}
            AND member_code IS NOT NULL
            AND member_code <> ''
        )
      ORDER BY r.applied_at
    `;
    return NextResponse.json<ApiResponse<UnregisteredEntry[]>>({ success: true, data: rows as UnregisteredEntry[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
