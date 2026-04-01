import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// PUT /api/tournaments/[id]/scores/ranking
// body: { rankings: { member_code: string; manual_rank: number | null }[] }
// manual_rank=null で自動計算に戻す
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const body: { rankings: { member_code: string; manual_rank: number | null }[] } = await req.json();

    for (const r of body.rankings) {
      await sql`
        UPDATE scores
        SET manual_rank = ${r.manual_rank}
        WHERE tournament_id = ${tournamentId} AND member_code = ${r.member_code}
      `;
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '順位の保存に失敗しました' }, { status: 500 });
  }
}
