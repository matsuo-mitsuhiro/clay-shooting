import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendApplyToken } from '@/lib/email';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tournaments/[id]/apply/request-token
// body: { email: string; participation_day: 'day1' | 'day2' | 'both' }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();
    const email: string = (body.email ?? '').trim().toLowerCase();
    const participation_day: string = body.participation_day ?? 'day1';

    if (!email) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'メールアドレスを入力してください' }, { status: 400 });
    }

    // 大会情報取得
    const rows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!rows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = rows[0];

    // 申込期間チェック（apply_end_at + 5分）
    const now = Date.now();
    if (!t.apply_start_at || !t.apply_end_at) {
      return NextResponse.json<ApiResponse>({ success: false, error: '申込受付が設定されていません' }, { status: 400 });
    }
    if (now < new Date(t.apply_start_at).getTime()) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'まだ申込受付期間ではありません' }, { status: 400 });
    }
    if (now > new Date(t.apply_end_at).getTime() + 5 * 60 * 1000) {
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

    // トークン生成
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間

    await sql`
      INSERT INTO registration_tokens (tournament_id, email, token, purpose, expires_at)
      VALUES (${tid}, ${email}, ${token}, 'apply', ${expiresAt.toISOString()})
    `;

    const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://clay-shooting.vercel.app';
    const applyUrl = `${BASE_URL}/tournaments/${tid}/apply/${token}`;
    await sendApplyToken(email, t.name, applyUrl);

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'メール送信に失敗しました' }, { status: 500 });
  }
}
