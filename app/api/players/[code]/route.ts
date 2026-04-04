import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { PlayerMaster } from '../route';

// PUT /api/players/[code] — 更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { name, affiliation, is_judge, class: cls, new_member_code } = body;
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: '氏名は必須です' }, { status: 400 });
    }
    const newCode = new_member_code?.trim() || code;
    const rows = await sql`
      UPDATE player_master SET
        member_code = ${newCode},
        name        = ${name.trim()},
        affiliation = ${affiliation ?? null},
        is_judge    = ${is_judge ?? false},
        class       = ${cls ?? null},
        updated_at  = NOW()
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
    const { is_judge, class: cls } = body;
    // レコードが存在する場合のみ更新（新規作成はしない）
    const rows = await sql`
      UPDATE player_master SET
        is_judge   = ${is_judge ?? false},
        class      = ${cls ?? null},
        updated_at = NOW()
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
