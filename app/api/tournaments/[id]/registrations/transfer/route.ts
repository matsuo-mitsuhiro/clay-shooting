import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse, Registration, Member, ClassType } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

const POSITIONS_PER_GROUP = 6;

// POST /api/tournaments/[id]/registrations/transfer — 未移行の申込者を選手登録に移行（要認証）
export async function POST(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tid = Number(id);

    // 大会情報取得（募集終了チェック）
    const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!tRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = tRows[0];

    // 未移行かつactiveな申込者一覧
    const regRows = await sql`
      SELECT * FROM registrations
      WHERE tournament_id = ${tid}
        AND status = 'active'
        AND transferred_at IS NULL
      ORDER BY applied_at ASC
    `;

    const registrations = regRows as Registration[];

    if (registrations.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '移行対象の申込者がいません',
      }, { status: 400 });
    }

    // 既存のmembersを取得して空きスロットを特定
    const memberRows = await sql`
      SELECT * FROM members WHERE tournament_id = ${tid}
    `;
    const existingMembers = memberRows as Member[];

    // day1 と day2 の occupied スロットを管理
    const occupiedByDay: { [day: number]: Set<string> } = { 1: new Set(), 2: new Set() };
    for (const m of existingMembers) {
      occupiedByDay[m.day]?.add(`${m.group_number}_${m.position}`);
    }

    // 各 day の次のスロットを管理
    const cursorByDay: { [day: number]: { group: number; pos: number } } = {
      1: { group: 1, pos: 1 },
      2: { group: 1, pos: 1 },
    };

    function findNextSlot(day: number) {
      const cursor = cursorByDay[day];
      const occupied = occupiedByDay[day];
      while (occupied.has(`${cursor.group}_${cursor.pos}`)) {
        cursor.pos++;
        if (cursor.pos > POSITIONS_PER_GROUP) {
          cursor.pos = 1;
          cursor.group++;
        }
      }
    }

    function allocateSlot(day: number): { group: number; pos: number } {
      findNextSlot(day);
      const cursor = cursorByDay[day];
      const group = cursor.group;
      const pos = cursor.pos;
      occupiedByDay[day].add(`${group}_${pos}`);
      cursor.pos++;
      if (cursor.pos > POSITIONS_PER_GROUP) {
        cursor.pos = 1;
        cursor.group++;
      }
      return { group, pos };
    }

    // 登録処理
    const membersToInsert: Array<{
      day: number;
      group_number: number;
      position: number;
      member_code: string;
      name: string;
      belong: string | null;
      class: ClassType | null;
      is_judge: boolean;
    }> = [];

    for (const reg of registrations) {
      const days: number[] = [];
      if (reg.participation_day === 'day1') days.push(1);
      else if (reg.participation_day === 'day2') days.push(2);
      else { days.push(1); days.push(2); }

      for (const day of days) {
        const slot = allocateSlot(day);
        membersToInsert.push({
          day,
          group_number: slot.group,
          position: slot.pos,
          member_code: reg.member_code,
          name: reg.name,
          belong: reg.belong,
          class: reg.class,
          is_judge: reg.is_judge,
        });
      }
    }

    // INSERT members（重複の場合はスキップ）
    for (const m of membersToInsert) {
      await sql`
        INSERT INTO members (tournament_id, day, group_number, position, member_code, name, belong, class, is_judge)
        VALUES (${tid}, ${m.day}, ${m.group_number}, ${m.position}, ${m.member_code}, ${m.name}, ${m.belong}, ${m.class}, ${m.is_judge})
        ON CONFLICT (tournament_id, day, member_code) DO NOTHING
      `;
    }

    // transferred_at を更新
    const regIds = registrations.map(r => r.id);
    for (const rid of regIds) {
      await sql`
        UPDATE registrations SET transferred_at = NOW() WHERE id = ${rid}
      `;
    }

    // player_master のクラス・審判フラグを更新
    await Promise.allSettled(
      membersToInsert
        .filter(m => m.member_code)
        .map(m =>
          fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/players/${m.member_code}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_judge: m.is_judge, class: m.class ?? null }),
          }).catch(() => {})
        )
    );

    return NextResponse.json<ApiResponse<{ count: number }>>({
      success: true,
      data: { count: registrations.length },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '移行に失敗しました' }, { status: 500 });
  }
}
