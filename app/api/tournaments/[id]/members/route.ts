import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Member, MemberInput, ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/tournaments/[id]/members?day=1|2
// day 未指定 → 全日程取得
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const dayParam = req.nextUrl.searchParams.get('day');
    const tournamentId = Number(id);

    const rows = dayParam
      ? await sql`
          SELECT * FROM members
          WHERE tournament_id = ${tournamentId} AND day = ${Number(dayParam)}
          ORDER BY group_number, position
        `
      : await sql`
          SELECT * FROM members
          WHERE tournament_id = ${tournamentId}
          ORDER BY day, group_number, position
        `;

    return NextResponse.json<ApiResponse<Member[]>>({ success: true, data: rows as Member[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'メンバー取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/members
// body: { day, members: MemberInput[] }
// 指定日程のメンバーを全件置換（DELETE + INSERT）
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const body: { day: 1 | 2; members: MemberInput[] } = await req.json();

    if (![1, 2].includes(body.day)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'day は 1 または 2 です' }, { status: 400 });
    }

    // 会員番号の全角→半角変換 & バリデーション
    const members = body.members.map((m) => ({
      ...m,
      member_code: m.member_code
        ? m.member_code.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim()
        : null,
    }));

    // 会員番号の数字チェック
    for (const m of members) {
      if (m.member_code && !/^\d+$/.test(m.member_code)) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `会員番号「${m.member_code}」は数字のみ入力してください`,
        }, { status: 400 });
      }
    }

    // 日程内の会員番号重複チェック
    const codes = members.map((m) => m.member_code).filter(Boolean);
    if (new Set(codes).size !== codes.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '同日程内に会員番号の重複があります' }, { status: 400 });
    }

    // 指定日程の既存データ削除 → 新規挿入
    await sql`DELETE FROM members WHERE tournament_id = ${tournamentId} AND day = ${body.day}`;

    if (members.length > 0) {
      for (const m of members) {
        if (!m.name?.trim()) continue; // 氏名なしはスキップ
        await sql`
          INSERT INTO members (tournament_id, day, group_number, position, member_code, name, belong, class, is_judge)
          VALUES (
            ${tournamentId},
            ${body.day},
            ${m.group_number},
            ${m.position},
            ${m.member_code ?? null},
            ${m.name.trim()},
            ${m.belong ?? null},
            ${m.class ?? null},
            ${m.is_judge ?? false}
          )
        `;
      }
    }

    const saved = await sql`
      SELECT * FROM members WHERE tournament_id = ${tournamentId} AND day = ${body.day}
      ORDER BY group_number, position
    `;
    return NextResponse.json<ApiResponse<Member[]>>({ success: true, data: saved as Member[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'メンバーの保存に失敗しました' }, { status: 500 });
  }
}

// PUT /api/tournaments/[id]/members/copy-day1-to-day2
// 1日目メンバーを2日目にコピー（別ルートで対応）
