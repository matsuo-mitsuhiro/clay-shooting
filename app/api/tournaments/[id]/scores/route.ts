import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import type { Score, ScoreInput, ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

type RoundField = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8' | 'cb' | 'fr' | 'status';

function fieldLabel(f: RoundField): string {
  if (f === 'cb') return 'CB';
  if (f === 'fr') return 'FR';
  if (f === 'status') return 'ステータス';
  return f.toUpperCase(); // r1 -> R1
}

function statusLabel(s: string | null | undefined): string {
  if (s === 'disqualified') return '失格';
  if (s === 'withdrawn') return '棄権';
  return '有効';
}

// GET /api/tournaments/[id]/scores — 点数一覧取得
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT * FROM scores WHERE tournament_id = ${Number(id)} ORDER BY member_code
    `;
    return NextResponse.json<ApiResponse<Score[]>>({ success: true, data: rows as Score[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '点数取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/scores
// body: { scores: ScoreInput[], group_number?: number, round?: RoundField }
// 各メンバーを UPSERT（存在すれば更新、なければ挿入）
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const body: { scores: ScoreInput[]; group_number?: number; round?: RoundField } = await req.json();

    // バリデーション：0〜25の範囲チェック
    const roundKeys = ['r1','r2','r3','r4','r5','r6','r7','r8'] as const;
    for (const s of body.scores) {
      for (const key of roundKeys) {
        const v = s[key];
        if (v !== null && v !== undefined && (v < 0 || v > 25)) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: `${s.name ?? s.member_code} の ${key.toUpperCase()} は 0〜25 の範囲で入力してください`,
          }, { status: 400 });
        }
      }
    }

    // UPSERT（ON CONFLICT で更新）
    for (const s of body.scores) {
      await sql`
        INSERT INTO scores (tournament_id, member_code, name, r1, r2, r3, r4, r5, r6, r7, r8, cb, fr, status, updated_at)
        VALUES (
          ${tournamentId},
          ${s.member_code},
          ${s.name ?? null},
          ${s.r1 ?? null}, ${s.r2 ?? null}, ${s.r3 ?? null}, ${s.r4 ?? null},
          ${s.r5 ?? null}, ${s.r6 ?? null}, ${s.r7 ?? null}, ${s.r8 ?? null},
          ${s.cb ?? null}, ${s.fr ?? null},
          ${s.status ?? 'valid'},
          NOW()
        )
        ON CONFLICT (tournament_id, member_code)
        DO UPDATE SET
          name       = EXCLUDED.name,
          r1         = EXCLUDED.r1,
          r2         = EXCLUDED.r2,
          r3         = EXCLUDED.r3,
          r4         = EXCLUDED.r4,
          r5         = EXCLUDED.r5,
          r6         = EXCLUDED.r6,
          r7         = EXCLUDED.r7,
          r8         = EXCLUDED.r8,
          cb         = EXCLUDED.cb,
          fr         = EXCLUDED.fr,
          status     = EXCLUDED.status,
          updated_at = NOW()
      `;
    }

    // 操作ログ記録
    try {
      const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (jwtToken && body.group_number && body.round) {
        const round = body.round;
        const entries: string[] = [];
        for (const s of body.scores) {
          let val: number | string | null | undefined;
          if (round === 'status') {
            val = statusLabel(s.status);
          } else {
            val = s[round];
          }
          if (val === null || val === undefined || val === '') continue;
          entries.push(`${s.name ?? s.member_code} ${val}`);
        }
        if (entries.length > 0) {
          const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tournamentId}`;
          const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;
          await writeOperationLog({
            tournamentId,
            tournamentName,
            adminName: (jwtToken.name as string) ?? null,
            adminAffiliation: (jwtToken.affiliation as string) ?? null,
            action: 'score_save',
            detail: `${body.group_number}組${fieldLabel(round)}：${entries.join('、')}`,
          });
        }
      }
    } catch (e) {
      console.error('score_save log failed:', e);
    }

    const saved = await sql`
      SELECT * FROM scores WHERE tournament_id = ${tournamentId} ORDER BY member_code
    `;
    return NextResponse.json<ApiResponse<Score[]>>({ success: true, data: saved as Score[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '点数の保存に失敗しました' }, { status: 500 });
  }
}
