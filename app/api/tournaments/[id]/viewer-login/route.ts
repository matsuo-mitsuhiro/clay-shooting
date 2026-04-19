import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { normalizeKanji } from '@/lib/kanji-normalize';

function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u3000]/g, '');
}

// POST /api/tournaments/[id]/viewer-login
// body: { belong?: string, name: string }
// 閲覧者ログイン（自分の行ハイライト用）— ログ記録は廃止
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const body = await req.json();
    const { belong, name } = body as {
      belong?: string;
      name: string;
    };

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: '氏名を入力してください' },
        { status: 400 }
      );
    }

    // この大会の登録選手を取得
    const members = await sql`
      SELECT DISTINCT name, belong FROM members
      WHERE tournament_id = ${tournamentId}
      ORDER BY name
    `;

    // スペース正規化 + 旧字体→新字体変換して部分一致チェック
    const normInput = normalizeKanji(normalizeSpaces(name.trim()));
    const matches = members.filter(m => {
      const normMember = normalizeKanji(normalizeSpaces(m.name as string));
      if (!normMember.includes(normInput) && !normInput.includes(normMember)) return false;
      if (belong && m.belong !== belong) return false;
      return true;
    });

    if (matches.length === 0) {
      return NextResponse.json(
        { success: false, error: 'not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { matchedName: (matches[0].name as string) ?? null },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: 'ログイン処理に失敗しました' },
      { status: 500 }
    );
  }
}
