import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { toShortName } from '@/lib/affiliation';
import type { PlayerMaster } from '../route';

function formatJST(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '/');
}

// PUT /api/players/[code] — 更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { name, affiliation, is_judge, trap_class, skeet_class, new_member_code } = body;
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: '氏名は必須です' }, { status: 400 });
    }
    const newCode = new_member_code?.trim() || code;
    const normalizedAffiliation = affiliation ? (toShortName(affiliation) || null) : null;

    // 既存データを取得してchange_historyの差分を計算
    const existing = await sql`SELECT * FROM player_master WHERE member_code = ${code}`;
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '選手が見つかりません' }, { status: 404 });
    }
    const prev = existing[0];
    const changes: string[] = [];
    const today = formatJST(new Date());

    if ((trap_class ?? null) !== (prev.trap_class ?? null)) {
      changes.push(`Tクラス ${prev.trap_class ?? '未設定'}→${trap_class ?? '未設定'}`);
    }
    if ((skeet_class ?? null) !== (prev.skeet_class ?? null)) {
      changes.push(`Sクラス ${prev.skeet_class ?? '未設定'}→${skeet_class ?? '未設定'}`);
    }
    if ((normalizedAffiliation ?? null) !== (prev.affiliation ?? null)) {
      changes.push(`所属 ${prev.affiliation ?? '未設定'}→${normalizedAffiliation ?? '未設定'}`);
    }

    let newHistory = prev.change_history ?? null;
    if (changes.length > 0) {
      const entry = `${today} システム管理者：${changes.join('、')}`;
      newHistory = newHistory ? `${newHistory}\n${entry}` : entry;
    }

    const rows = await sql`
      UPDATE player_master SET
        member_code    = ${newCode},
        name           = ${name.trim()},
        affiliation    = ${normalizedAffiliation},
        is_judge       = ${is_judge ?? false},
        trap_class     = ${trap_class ?? null},
        skeet_class    = ${skeet_class ?? null},
        change_history = ${newHistory},
        updated_at     = NOW()
      WHERE member_code = ${code}
      RETURNING *
    `;
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '選手が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: rows[0] as PlayerMaster });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: '更新に失敗しました' }, { status: 500 });
  }
}

// PATCH /api/players/[code] — クラス・審判フラグのみ更新（組保存時）
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { is_judge, trap_class, skeet_class } = body;
    // レコードが存在する場合のみ更新（新規作成はしない）
    const rows = await sql`
      UPDATE player_master SET
        is_judge    = ${is_judge ?? false},
        trap_class  = ${trap_class ?? null},
        skeet_class = ${skeet_class ?? null},
        updated_at  = NOW()
      WHERE member_code = ${code}
      RETURNING *
    `;
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: rows[0] as PlayerMaster });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: '更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/players/[code] — 削除
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    await sql`DELETE FROM player_master WHERE member_code = ${code}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: '削除に失敗しました' }, { status: 500 });
  }
}
