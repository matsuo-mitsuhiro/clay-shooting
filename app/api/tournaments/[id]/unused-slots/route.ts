import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { UnusedSlot, ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// PUT /api/tournaments/[id]/unused-slots
// 空席指定スロットの保存（同時に members の再配置も受け取って書き換え可能）
//
// body: {
//   unused_slots: UnusedSlot[],
//   members?: { day:1|2; group_number:number; position:number; member_code?:string;
//               name:string; belong?:string; class?:string; is_judge:boolean }[]
//   day?: 1|2  // members 指定時は対象日も指定
// }
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const body = await req.json();
    const unusedSlots: UnusedSlot[] = Array.isArray(body.unused_slots) ? body.unused_slots : [];
    const members = Array.isArray(body.members) ? body.members : null;
    const day: 1 | 2 | null = body.day === 1 || body.day === 2 ? body.day : null;

    // unused_slots の妥当性チェック（最低限）
    for (const s of unusedSlots) {
      if (typeof s.day !== 'number' || typeof s.group !== 'number' || typeof s.position !== 'number') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'unused_slots の形式が不正です' }, { status: 400 });
      }
    }

    // 1) unused_slots を更新
    await sql`
      UPDATE tournaments
      SET unused_slots = ${JSON.stringify(unusedSlots)}::jsonb,
          updated_at = NOW()
      WHERE id = ${tournamentId}
    `;

    // 2) members 指定があれば、その日の members を入れ替え
    if (members && day) {
      // 既存の同日 members を全削除（scores の member_code 参照は member_code ベースなので member 削除しても OK）
      await sql`DELETE FROM members WHERE tournament_id = ${tournamentId} AND day = ${day}`;
      for (const m of members) {
        await sql`
          INSERT INTO members
            (tournament_id, day, group_number, position, member_code, name, belong, class, is_judge, is_non_prize)
          VALUES (
            ${tournamentId},
            ${day},
            ${m.group_number},
            ${m.position},
            ${m.member_code ?? null},
            ${m.name},
            ${m.belong ?? null},
            ${m.class ?? null},
            ${!!m.is_judge},
            ${!!m.is_non_prize}
          )
        `;
      }
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '保存に失敗しました' }, { status: 500 });
  }
}
