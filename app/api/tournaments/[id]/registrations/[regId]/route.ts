import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import { writeOperationLog } from '@/lib/operation-log';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string; regId: string }> };

// DELETE /api/tournaments/[id]/registrations/[regId] — 手動登録の削除（source='manual'のみ）
export async function DELETE(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id, regId } = await params;
    const tid = Number(id);
    const rid = Number(regId);

    // 削除前に情報を取得（ログ用）
    const regRows = await sql`
      SELECT member_code, name FROM registrations
      WHERE id = ${rid} AND tournament_id = ${tid} AND source = 'manual'
    `;
    if (!regRows.length) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '削除対象が見つかりません（手動登録のみ削除可能です）',
      }, { status: 404 });
    }
    const reg = regRows[0] as { member_code: string; name: string };

    await sql`
      DELETE FROM registrations
      WHERE id = ${rid} AND tournament_id = ${tid} AND source = 'manual'
    `;

    // 操作ログ
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
    const tournamentName = tRows.length ? (tRows[0] as { name: string }).name : null;

    await writeOperationLog({
      tournamentId: tid,
      tournamentName,
      adminName: (jwtToken.name as string) ?? null,
      adminAffiliation: (jwtToken.affiliation as string) ?? null,
      action: 'registration_delete',
      detail: `${reg.member_code} ${reg.name}`,
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '削除に失敗しました' }, { status: 500 });
  }
}

// PATCH /api/tournaments/[id]/registrations/[regId] — 申込情報のインライン編集
export async function PATCH(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id, regId } = await params;
    const tid = Number(id);
    const rid = Number(regId);
    const body = await req.json();

    // Build SET clauses dynamically
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name');
      values.push(body.name);
    }
    if (body.belong !== undefined) {
      updates.push('belong');
      values.push(body.belong);
    }
    if (body.class !== undefined) {
      updates.push('class');
      values.push(body.class);
    }
    if (body.is_judge !== undefined) {
      updates.push('is_judge');
      values.push(body.is_judge);
    }
    if (body.member_code !== undefined) {
      updates.push('member_code');
      values.push(body.member_code);
    }

    if (updates.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '更新項目がありません' }, { status: 400 });
    }

    // Update one field at a time using tagged template (Neon driver limitation)
    for (let i = 0; i < updates.length; i++) {
      const field = updates[i];
      const val = values[i];
      if (field === 'name') {
        await sql`UPDATE registrations SET name = ${val as string} WHERE id = ${rid} AND tournament_id = ${tid}`;
      } else if (field === 'belong') {
        await sql`UPDATE registrations SET belong = ${val as string | null} WHERE id = ${rid} AND tournament_id = ${tid}`;
      } else if (field === 'class') {
        await sql`UPDATE registrations SET class = ${val as string | null} WHERE id = ${rid} AND tournament_id = ${tid}`;
      } else if (field === 'is_judge') {
        await sql`UPDATE registrations SET is_judge = ${val as boolean} WHERE id = ${rid} AND tournament_id = ${tid}`;
      } else if (field === 'member_code') {
        await sql`UPDATE registrations SET member_code = ${val as string} WHERE id = ${rid} AND tournament_id = ${tid}`;
      }
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '更新に失敗しました' }, { status: 500 });
  }
}
