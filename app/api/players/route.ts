import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { normalizeKanji } from '@/lib/kanji-normalize';

export interface PlayerMaster {
  member_code: string;
  name: string;
  affiliation: string | null;
  is_judge: boolean;
  class: string | null;
  updated_at: string | null;
}

// スペース正規化（半角・全角スペースを除去）
function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u3000]/g, '');
}

// GET /api/players?code=xxxxx       — 1件検索（自動補完用）
// GET /api/players?q_name=松尾&q_belong=大阪 — 氏名+所属スペース正規化検索（一括登録用）
// GET /api/players                  — 全件一覧（管理画面用）
// GET /api/players?affiliation=大阪&class=A&is_judge=true  — フィルタ
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 所属一覧取得
    if (searchParams.get('affiliations') === '1') {
      const rows = await sql`
        SELECT DISTINCT affiliation FROM player_master
        WHERE affiliation IS NOT NULL AND affiliation != ''
        ORDER BY affiliation
      `;
      return NextResponse.json({ affiliations: rows.map(r => r.affiliation as string) });
    }

    const code = searchParams.get('code');

    // 1件検索（会員番号完全一致）
    if (code) {
      const rows = await sql`
        SELECT * FROM player_master WHERE member_code = ${code} LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: rows[0] as PlayerMaster });
    }

    // 氏名スペース正規化検索（一括登録用）— 旧字体→新字体変換も適用
    const qName = searchParams.get('q_name');
    if (qName) {
      const normName = normalizeSpaces(qName);
      const kanjiNormName = normalizeKanji(normName);
      const pattern = '%' + normName + '%';
      const kanjiPattern = '%' + kanjiNormName + '%';
      const qBelong = searchParams.get('q_belong');
      let rows;
      if (qBelong) {
        rows = await sql`
          SELECT * FROM player_master
          WHERE (
            REPLACE(REPLACE(name, ' ', ''), '　', '') ILIKE ${pattern}
            OR REPLACE(REPLACE(name, ' ', ''), '　', '') ILIKE ${kanjiPattern}
          )
            AND affiliation = ${qBelong}
          ORDER BY member_code
        `;
      } else {
        rows = await sql`
          SELECT * FROM player_master
          WHERE REPLACE(REPLACE(name, ' ', ''), '　', '') ILIKE ${pattern}
            OR REPLACE(REPLACE(name, ' ', ''), '　', '') ILIKE ${kanjiPattern}
          ORDER BY member_code
        `;
      }
      return NextResponse.json({ success: true, data: rows as PlayerMaster[] });
    }

    // フィルタ条件（neonはnullの型推論ができないため条件分岐で組み立て）
    const affiliation = searchParams.get('affiliation');
    const classFilter = searchParams.get('class');
    const isJudge = searchParams.get('is_judge');
    const q = searchParams.get('q');

    let rows;
    if (affiliation && classFilter && isJudge !== null && q) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND class=${classFilter} AND is_judge=${isJudge==='true'} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (affiliation && classFilter && isJudge !== null) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND class=${classFilter} AND is_judge=${isJudge==='true'} ORDER BY member_code`;
    } else if (affiliation && classFilter && q) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND class=${classFilter} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (affiliation && isJudge !== null && q) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND is_judge=${isJudge==='true'} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (classFilter && isJudge !== null && q) {
      rows = await sql`SELECT * FROM player_master WHERE class=${classFilter} AND is_judge=${isJudge==='true'} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (affiliation && classFilter) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND class=${classFilter} ORDER BY member_code`;
    } else if (affiliation && isJudge !== null) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND is_judge=${isJudge==='true'} ORDER BY member_code`;
    } else if (affiliation && q) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (classFilter && isJudge !== null) {
      rows = await sql`SELECT * FROM player_master WHERE class=${classFilter} AND is_judge=${isJudge==='true'} ORDER BY member_code`;
    } else if (classFilter && q) {
      rows = await sql`SELECT * FROM player_master WHERE class=${classFilter} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (isJudge !== null && q) {
      rows = await sql`SELECT * FROM player_master WHERE is_judge=${isJudge==='true'} AND (member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'}) ORDER BY member_code`;
    } else if (affiliation) {
      rows = await sql`SELECT * FROM player_master WHERE affiliation=${affiliation} ORDER BY member_code`;
    } else if (classFilter) {
      rows = await sql`SELECT * FROM player_master WHERE class=${classFilter} ORDER BY member_code`;
    } else if (isJudge !== null) {
      rows = await sql`SELECT * FROM player_master WHERE is_judge=${isJudge==='true'} ORDER BY member_code`;
    } else if (q) {
      rows = await sql`SELECT * FROM player_master WHERE member_code ILIKE ${'%'+q+'%'} OR name ILIKE ${'%'+q+'%'} ORDER BY member_code`;
    } else {
      rows = await sql`SELECT * FROM player_master ORDER BY member_code`;
    }
    return NextResponse.json({ success: true, data: rows as PlayerMaster[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/players — 新規登録（または全項目更新）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_code, name, affiliation, is_judge, class: cls } = body;
    if (!member_code?.trim() || !name?.trim()) {
      return NextResponse.json({ success: false, error: '会員番号と氏名は必須です' }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO player_master (member_code, name, affiliation, is_judge, class, updated_at)
      VALUES (
        ${member_code.trim()},
        ${name.trim()},
        ${affiliation ?? null},
        ${is_judge ?? false},
        ${cls ?? null},
        NOW()
      )
      ON CONFLICT (member_code) DO UPDATE SET
        name       = EXCLUDED.name,
        affiliation= EXCLUDED.affiliation,
        is_judge   = EXCLUDED.is_judge,
        class      = EXCLUDED.class,
        updated_at = NOW()
      RETURNING *
    `;
    return NextResponse.json({ success: true, data: rows[0] as PlayerMaster }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: '保存に失敗しました' }, { status: 500 });
  }
}
