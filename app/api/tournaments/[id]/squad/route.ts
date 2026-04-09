import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

const DEFAULT_COMMENT = 'Aクラスの人数が6名未満につき、本公式はクラス分けなしとして順位を決定致します';

// GET /api/tournaments/[id]/squad
// 公開中の場合: squad_published_at, squad_comment, members を返す
// 常に: previous_comment（前回同会場同協会のコメント）を返す
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);

    const rows = await sql`
      SELECT squad_published_at, squad_comment, organizer_cd, venue
      FROM tournaments WHERE id = ${tid}
    `;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = rows[0];

    // 前回コメント取得（同協会・同射撃場・squad_comment設定済み・最新）
    let previous_comment: string | null = null;
    if (t.organizer_cd && t.venue) {
      const prevRows = await sql`
        SELECT squad_comment FROM tournaments
        WHERE organizer_cd = ${t.organizer_cd}
          AND venue = ${t.venue}
          AND id != ${tid}
          AND squad_comment IS NOT NULL
          AND squad_comment != ''
        ORDER BY day1_date DESC NULLS LAST
        LIMIT 1
      `;
      previous_comment = prevRows[0]?.squad_comment ?? null;
    }

    // 公開中の場合のみ選手データを返す
    let members: unknown[] = [];
    if (t.squad_published_at) {
      members = await sql`
        SELECT id, day, group_number, position, name, belong, class, is_judge
        FROM members
        WHERE tournament_id = ${tid}
        ORDER BY day, group_number, position
      `;
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        squad_published_at: t.squad_published_at ?? null,
        squad_comment: t.squad_comment ?? null,
        previous_comment,
        members,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/tournaments/[id]/squad
// body: { action: 'publish' | 'unpublish', comment: string }
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();
    const action: 'publish' | 'unpublish' = body.action ?? 'publish';
    const comment: string = (body.comment ?? '').trim() || DEFAULT_COMMENT;

    if (action === 'publish') {
      await sql`
        UPDATE tournaments
        SET squad_published_at = NOW(), squad_comment = ${comment}
        WHERE id = ${tid}
      `;
    } else {
      await sql`
        UPDATE tournaments
        SET squad_published_at = NULL, squad_comment = ${comment}
        WHERE id = ${tid}
      `;
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '保存に失敗しました' }, { status: 500 });
  }
}
