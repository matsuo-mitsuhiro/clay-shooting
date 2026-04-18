import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { ApiResponse, Tournament } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export interface ApplyInfoData {
  tournament: Tournament;
  day1_count: number;
  day2_count: number;
  organizer_formal_name: string | null;
}

// GET /api/tournaments/[id]/apply-info — 大会情報 + 申込カウント（認証不要）
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);

    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const tournament = rows[0] as Tournament;

    // 1日目参加者数（day1 + both）
    const reg1 = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM registrations
      WHERE tournament_id = ${tid}
        AND status = 'active'
        AND participation_day IN ('day1', 'both')
    `;
    // 2日目参加者数（day2 + both）
    const reg2 = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM registrations
      WHERE tournament_id = ${tid}
        AND status = 'active'
        AND participation_day IN ('day2', 'both')
    `;

    const day1_count = Number(reg1[0]?.cnt ?? 0);
    const day2_count = Number(reg2[0]?.cnt ?? 0);

    // 主催協会の正式名称（例: "大阪府クレー射撃協会"）を取得
    let organizer_formal_name: string | null = null;
    if (tournament.organizer_cd != null) {
      const assoc = await sql`
        SELECT formal_name FROM associations WHERE cd = ${tournament.organizer_cd}
      `;
      organizer_formal_name = (assoc[0]?.formal_name as string | null) ?? null;
    }

    return NextResponse.json<ApiResponse<ApplyInfoData>>({
      success: true,
      data: { tournament, day1_count, day2_count, organizer_formal_name },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
