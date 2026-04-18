import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import type { ApiResponse, ScoreStatus } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

function statusLabel(s: ScoreStatus): string {
  if (s === 'disqualified') return '失格';
  if (s === 'withdrawn') return '棄権';
  return '有効';
}

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

    // 操作ログ記録
    try {
      const memberRows = await sql`
        SELECT name, group_number FROM members
        WHERE tournament_id = ${tid} AND member_code = ${body.member_code}
        ORDER BY day ASC LIMIT 1
      `;
      if (memberRows.length > 0) {
        const m = memberRows[0] as { name: string; group_number: number };
        const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
        const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;
        await writeOperationLog({
          tournamentId: tid,
          tournamentName,
          adminName: (jwtToken.name as string) ?? null,
          adminAffiliation: (jwtToken.affiliation as string) ?? null,
          action: 'score_save',
          detail: `${m.group_number}組ステータス：${m.name} ${statusLabel(body.status)}`,
        });
      }
    } catch (e) {
      console.error('score_save log failed:', e);
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'ステータス更新に失敗しました' }, { status: 500 });
  }
}
