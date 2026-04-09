import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendApplyConfirmation } from '@/lib/email';
import type { ApiResponse, Registration, ParticipationDay, ClassType } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://clay-shooting.vercel.app';

// POST /api/tournaments/[id]/apply/submit
// body: { code, member_code, name, belong, class, participation_day, is_judge }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();

    // code（新フロー）またはtoken（旧URLフロー）を受け付ける
    const tokenOrCode: string = (body.code ?? body.token ?? '').trim();
    const member_code: string = (body.member_code ?? '').trim();
    const name: string = (body.name ?? '').trim();
    const belong: string | null = body.belong?.trim() || null;
    const classVal: ClassType | null = body.class || null;
    const is_judge: boolean = body.is_judge === true;
    const participation_day: ParticipationDay = body.participation_day ?? 'day1';

    if (!tokenOrCode || !member_code || !name) {
      return NextResponse.json<ApiResponse>({ success: false, error: '必須項目を入力してください' }, { status: 400 });
    }

    // トークン/コード検証
    const tokenRows = await sql`
      SELECT * FROM registration_tokens
      WHERE token = ${tokenOrCode} AND purpose = 'apply'
    `;
    if (!tokenRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込コードが無効です' }, { status: 400 });
    }
    const tok = tokenRows[0];

    if (tok.used_at) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'この申込コードは既に使用済みです' }, { status: 400 });
    }
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込コードの有効期限が切れています' }, { status: 400 });
    }
    if (tok.tournament_id !== tid) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込コードが無効です' }, { status: 400 });
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
        VALUES (${tid}, 'duplicate_error', ${member_code}, ${tok.email}, '重複申込')
      `;
      return NextResponse.json<ApiResponse>({ success: false, error: '既に申込がされています。' }, { status: 400 });
    }

    // 申込登録
    const regRows = await sql`
      INSERT INTO registrations
        (tournament_id, member_code, name, belong, email, event_type, participation_day, class, is_judge)
      VALUES
        (${tid}, ${member_code}, ${name}, ${belong}, ${tok.email}, ${t.event_type}, ${participation_day}, ${classVal}, ${is_judge})
      RETURNING *
    `;
    const registration = regRows[0] as Registration;

    // トークンを使用済みにする
    await sql`
      UPDATE registration_tokens
      SET used_at = NOW(), registration_id = ${registration.id}
      WHERE id = ${tok.id}
    `;

    // 申込完了メール送信（キャンセルURL付き）
    const cancelUrl = `${BASE_URL}/tournaments/${tid}/cancel`;
    await sendApplyConfirmation(tok.email, name, {
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
