import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendApplyConfirmation } from '@/lib/email';
import { toShortName } from '@/lib/affiliation';
import type { ApiResponse, Registration, ParticipationDay, ClassType } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://clay-shooting.vercel.app';

function formatJST(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '/');
}

// POST /api/tournaments/[id]/apply/continuous
// 連続申込用 — 初回申込で認証済みのセッション内で、トークン不要で申込む
// body: { member_code, email, name, belong, class, is_judge, participation_day, prev_registration_id }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();

    const member_code: string = (body.member_code ?? '').trim();
    const email: string = (body.email ?? '').trim().toLowerCase();
    const name: string = (body.name ?? '').trim();
    const belong: string | null = body.belong ? (toShortName(body.belong) || null) : null;
    const classVal: ClassType | null = body.class || null;
    const is_judge: boolean = body.is_judge === true;
    const participation_day: ParticipationDay = body.participation_day ?? 'day1';
    const prevRegistrationId: number | null = body.prev_registration_id ?? null;

    if (!member_code || !email || !name) {
      return NextResponse.json<ApiResponse>({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    // 前回の申込が実在するか検証（連続申込の正当性チェック）
    if (!prevRegistrationId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '連続申込の情報が不正です' }, { status: 400 });
    }
    const prevRows = await sql`
      SELECT id, member_code, email FROM registrations
      WHERE id = ${prevRegistrationId}
        AND member_code = ${member_code}
        AND email = ${email}
        AND status = 'active'
    `;
    if (!prevRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '前回の申込情報を確認できません。通常の申込フォームからお申込みください。' }, { status: 400 });
    }

    // 大会情報取得・申込期間チェック
    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = rows[0];
    if (!t.apply_end_at || Date.now() > new Date(t.apply_end_at).getTime() + 5 * 60 * 1000) {
      return NextResponse.json<ApiResponse>({ success: false, error: '募集終了日時を過ぎました。' }, { status: 400 });
    }

    // 定員チェック
    if (t.max_participants) {
      const daysToCheck: { day: 'day1' | 'day2'; label: string }[] =
        participation_day === 'both'
          ? [{ day: 'day1', label: '1日目' }, { day: 'day2', label: '2日目' }]
          : participation_day === 'day2'
          ? [{ day: 'day2', label: '2日目' }]
          : [{ day: 'day1', label: '1日目' }];

      for (const { day, label } of daysToCheck) {
        const countRows = day === 'day1'
          ? await sql`
              SELECT COUNT(*)::int AS cnt
              FROM registrations
              WHERE tournament_id = ${tid}
                AND status = 'active'
                AND participation_day IN ('day1', 'both')
            `
          : await sql`
              SELECT COUNT(*)::int AS cnt
              FROM registrations
              WHERE tournament_id = ${tid}
                AND status = 'active'
                AND participation_day IN ('day2', 'both')
            `;
        const cnt = Number(countRows[0]?.cnt ?? 0);
        if (cnt >= t.max_participants) {
          return NextResponse.json<ApiResponse>({ success: false, error: `${label}の定員に達しています` }, { status: 400 });
        }
      }
    }

    // 重複申込チェック
    const dupRows = await sql`
      SELECT id FROM registrations
      WHERE tournament_id = ${tid}
        AND member_code = ${member_code}
        AND status = 'active'
    `;
    if (dupRows.length) {
      await sql`
        INSERT INTO registration_logs (tournament_id, log_type, member_code, email, note)
        VALUES (${tid}, 'duplicate_error', ${member_code}, ${email}, '重複申込（連続申込）')
      `;
      return NextResponse.json<ApiResponse>({ success: false, error: '既に申込がされています。' }, { status: 400 });
    }

    // player_master 照合 → change_history 更新
    const playerRows = await sql`SELECT * FROM player_master WHERE member_code = ${member_code}`;
    if (playerRows.length > 0) {
      const player = playerRows[0];
      const today = formatJST(new Date());
      const changes: string[] = [];

      const isSkeet = t.event_type === 'skeet';
      const prevClass = isSkeet ? (player.skeet_class ?? null) : (player.trap_class ?? null);
      const classPrefix = isSkeet ? 'Sクラス' : 'Tクラス';

      if (classVal && prevClass !== classVal) {
        changes.push(`${classPrefix} ${prevClass ?? '未設定'}→${classVal}`);
      }
      if (belong && (player.affiliation ?? null) !== belong) {
        changes.push(`所属 ${player.affiliation ?? '未設定'}→${belong}`);
      }

      if (changes.length > 0) {
        const entry = `${today} 申込時：${changes.join('、')}`;
        const newHistory = player.change_history ? `${player.change_history}\n${entry}` : entry;

        if (isSkeet) {
          await sql`
            UPDATE player_master SET
              skeet_class    = ${classVal ?? player.skeet_class},
              affiliation    = ${belong ?? player.affiliation},
              change_history = ${newHistory},
              updated_at     = NOW()
            WHERE member_code = ${member_code}
          `;
        } else {
          await sql`
            UPDATE player_master SET
              trap_class     = ${classVal ?? player.trap_class},
              affiliation    = ${belong ?? player.affiliation},
              change_history = ${newHistory},
              updated_at     = NOW()
            WHERE member_code = ${member_code}
          `;
        }
      }
    }

    // 申込登録
    const regRows = await sql`
      INSERT INTO registrations
        (tournament_id, member_code, name, belong, email, event_type, participation_day, class, is_judge)
      VALUES
        (${tid}, ${member_code}, ${name}, ${belong}, ${email}, ${t.event_type}, ${participation_day}, ${classVal}, ${is_judge})
      RETURNING *
    `;
    const registration = regRows[0] as Registration;

    // キャンセルトークン生成（30日有効）
    const cancelToken = randomBytes(32).toString('hex');
    const cancelExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sql`
      INSERT INTO registration_tokens (tournament_id, email, token, purpose, expires_at, registration_id)
      VALUES (${tid}, ${email}, ${cancelToken}, 'cancel', ${cancelExpiresAt.toISOString()}, ${registration.id})
    `;
    const cancelUrl = `${BASE_URL}/tournaments/${tid}/cancel/${cancelToken}`;

    // 申込完了メール送信
    await sendApplyConfirmation(email, name, {
      name: t.name,
      venue: t.venue,
      day1_date: t.day1_date,
      day2_date: t.day2_date,
      event_type: t.event_type,
      competition_start_time: t.competition_start_time,
      gate_open_time: t.gate_open_time,
      reception_start_time: t.reception_start_time,
      practice_clay_time: t.practice_clay_time,
      cancellation_notice: t.cancellation_notice,
      notes: t.notes,
    }, cancelUrl);

    return NextResponse.json<ApiResponse<Registration>>({ success: true, data: registration });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '申込処理に失敗しました' }, { status: 500 });
  }
}
