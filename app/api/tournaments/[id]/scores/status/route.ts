import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse, ScoreStatus } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/tournaments/[id]/scores/status — 成績ステータスを更新
export async function PATCH(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tid = Number(id);
    const body: { member_code: string; status: ScoreStatus } = await req.json();

    if (!body.member_code || !body.status) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'member_codeとstatusは必須です' }, { status: 400 });
    }

    // scoresレコードが存在するか確認
    const existing = await sql`
      SELECT id FROM scores WHERE tournament_id = ${tid} AND member_code = ${body.member_code}
    `;

    if (existing.length === 0) {
      // scoresレコードが無い場合は新規作成（statusのみ）
      await sql`
        INSERT INTO scores (tournament_id, member_code, status, updated_at)
        VALUES (${tid}, ${body.member_code}, ${body.status}, NOW())
        ON CONFLICT (tournament_id, member_code) DO UPDATE SET status = ${body.status}, updated_at = NOW()
      `;
    } else {
      await sql`
        UPDATE scores SET status = ${body.status}, updated_at = NOW()
        WHERE tournament_id = ${tid} AND member_code = ${body.member_code}
      `;
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'ステータス更新に失敗しました' }, { status: 500 });
  }
}
