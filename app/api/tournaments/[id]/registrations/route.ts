import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getToken } from 'next-auth/jwt';
import type { ApiResponse, Registration, ClassType, ParticipationDay } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/tournaments/[id]/registrations — 申込一覧（要認証）
export async function GET(req: NextRequest, { params }: Params) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tid = Number(id);

    const rows = await sql`
      SELECT * FROM registrations
      WHERE tournament_id = ${tid}
      ORDER BY applied_at ASC
    `;

    return NextResponse.json<ApiResponse<Registration[]>>({ success: true, data: rows as Registration[] });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: 'データ取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/tournaments/[id]/registrations — 手動登録（source='manual'）
export async function POST(req: NextRequest, { params }: Params) {
  const jwtToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwtToken) {
    return NextResponse.json<ApiResponse>({ success: false, error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();

    const source: string = body.source ?? 'manual';
    const member_code: string = (body.member_code ?? '').trim();
    const name: string = (body.name ?? '').trim();
    const belong: string | null = body.belong?.trim() || null;
    const classVal: ClassType | null = body.class || null;
    const is_judge: boolean = body.is_judge === true;
    const participation_day: ParticipationDay = body.participation_day ?? 'day1';

    if (!member_code || !name) {
      return NextResponse.json<ApiResponse>({ success: false, error: '会員番号と氏名は必須です' }, { status: 400 });
    }

    // 大会の event_type を取得
    const tRows = await sql`SELECT event_type FROM tournaments WHERE id = ${tid}`;
    if (!tRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const eventType = tRows[0].event_type;

    const rows = await sql`
      INSERT INTO registrations (
        tournament_id, member_code, name, belong, email, event_type,
        participation_day, class, is_judge, source, status
      ) VALUES (
        ${tid}, ${member_code}, ${name}, ${belong}, ${''}, ${eventType},
        ${participation_day}, ${classVal}, ${is_judge}, ${source}, 'active'
      )
      RETURNING *
    `;

    return NextResponse.json<ApiResponse<Registration>>({ success: true, data: rows[0] as Registration });
  } catch (e) {
    console.error(e);
    return NextResponse.json<ApiResponse>({ success: false, error: '登録に失敗しました' }, { status: 500 });
  }
}
