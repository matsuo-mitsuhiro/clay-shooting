import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse } from '@/lib/types';

// GET /api/tournaments/[id]/members/by-code?member_code=xxx
// 指定の会員番号がmembersテーブルに登録されているか確認し、日目・組・番号を返す
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  const { id } = await params;
  const tournamentId = Number(id);
  const memberCode = req.nextUrl.searchParams.get('member_code');

  if (!memberCode) {
    return NextResponse.json<ApiResponse>({ success: true, data: [] });
  }

  try {
    const rows = await sql`
      SELECT day, group_number, position
      FROM members
      WHERE tournament_id = ${tournamentId}
        AND member_code = ${memberCode}
      ORDER BY day, group_number, position
    `;
    return NextResponse.json<ApiResponse>({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}
