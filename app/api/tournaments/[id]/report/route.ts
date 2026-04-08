import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import type { ApiResponse } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

// ---------- ストレート自動検出 ----------
interface StraightHit {
  event_type: string;
  straight_type: number;
  player_name: string;
  member_code: string;
  belong: string;
  amount: number;
}

function detectStraights(
  scores: Array<{
    member_code: string;
    name: string;
    belong: string;
    r1: number | null; r2: number | null; r3: number | null; r4: number | null;
    r5: number | null; r6: number | null; r7: number | null; r8: number | null;
  }>,
  eventType: string,
): StraightHit[] {
  const hits: StraightHit[] = [];

  for (const s of scores) {
    // Day 1: r1-r4, Day 2: r5-r8
    const days: (number | null)[][] = [
      [s.r1, s.r2, s.r3, s.r4],
      [s.r5, s.r6, s.r7, s.r8],
    ];

    let bestStraight = 0; // Track the best across both days

    for (const rounds of days) {
      // Find longest consecutive 25s
      let maxConsec = 0;
      let consec = 0;
      for (const r of rounds) {
        if (r === 25) {
          consec++;
          if (consec > maxConsec) maxConsec = consec;
        } else {
          consec = 0;
        }
      }
      // Map consecutive count to straight type
      if (maxConsec >= 4 && 100 > bestStraight) bestStraight = 100;
      else if (maxConsec >= 3 && 75 > bestStraight) bestStraight = 75;
      else if (maxConsec >= 2 && 50 > bestStraight) bestStraight = 50;
    }

    if (bestStraight > 0) {
      const amountMap: Record<number, number> = { 50: 20000, 75: 40000, 100: 80000 };
      hits.push({
        event_type: eventType,
        straight_type: bestStraight,
        player_name: s.name ?? '',
        member_code: s.member_code ?? '',
        belong: s.belong ?? '',
        amount: amountMap[bestStraight] ?? 0,
      });
    }
  }

  return hits;
}

// ---------- 年度計算（4月始まり） ----------
function getFiscalYear(dateStr: string): number {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  return month >= 4 ? year : year - 1;
}

// GET /api/tournaments/[id]/report
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);

    // 1. Get current tournament
    const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
    if (!tRows.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const tournament = tRows[0] as Record<string, unknown>;

    // 2. Find paired tournament (same day1_date + organizer_cd, different event_type)
    let pairedTournament: Record<string, unknown> | null = null;
    if (tournament.day1_date && tournament.organizer_cd) {
      const pRows = await sql`
        SELECT * FROM tournaments
        WHERE day1_date = ${tournament.day1_date}
          AND organizer_cd = ${tournament.organizer_cd}
          AND event_type != ${tournament.event_type}
          AND id != ${tid}
        LIMIT 1
      `;
      if (pRows.length) pairedTournament = pRows[0] as Record<string, unknown>;
    }

    // 3. Check existing report (either side)
    const pairedId = pairedTournament ? Number(pairedTournament.id) : null;
    let reportRows;
    if (pairedId) {
      reportRows = await sql`
        SELECT * FROM tournament_reports
        WHERE (tournament_id = ${tid} OR paired_tournament_id = ${tid}
           OR tournament_id = ${pairedId} OR paired_tournament_id = ${pairedId})
        LIMIT 1
      `;
    } else {
      reportRows = await sql`
        SELECT * FROM tournament_reports
        WHERE tournament_id = ${tid} OR paired_tournament_id = ${tid}
        LIMIT 1
      `;
    }
    const report = reportRows.length ? reportRows[0] : null;

    // 4. Get incentives if report exists
    let incentives: unknown[] = [];
    if (report) {
      incentives = await sql`
        SELECT * FROM report_incentives
        WHERE report_id = ${report.id}
        ORDER BY sort_order, id
      `;
    }

    // 5. Get association info (for president_name)
    let association: Record<string, unknown> | null = null;
    if (tournament.organizer_cd) {
      const aRows = await sql`
        SELECT cd, name, president_name FROM associations WHERE cd = ${tournament.organizer_cd}
      `;
      if (aRows.length) association = aRows[0] as Record<string, unknown>;
    }

    // 6. Determine trap/skeet tournaments
    const trapTournament = String(tournament.event_type) === 'trap' ? tournament : pairedTournament;
    const skeetTournament = String(tournament.event_type) === 'skeet' ? tournament : pairedTournament;

    // 7. Count participants by class (DISTINCT member_code)
    const countByClass = async (tournamentId: number | null) => {
      if (!tournamentId) return { AA: 0, A: 0, B: 0, C: 0, none: 0, total: 0 };
      const rows = await sql`
        SELECT
          COALESCE(class, 'none') AS cls,
          COUNT(DISTINCT member_code) AS cnt
        FROM members
        WHERE tournament_id = ${tournamentId} AND member_code IS NOT NULL
        GROUP BY COALESCE(class, 'none')
      `;
      const map: Record<string, number> = { AA: 0, A: 0, B: 0, C: 0, none: 0 };
      for (const r of rows) {
        const cls = String(r.cls);
        if (cls in map) map[cls] = Number(r.cnt);
        else map['none'] += Number(r.cnt); // fallback
      }
      const total = Object.values(map).reduce((a, b) => a + b, 0);
      return { ...map, total };
    };

    const trapId = trapTournament ? Number(trapTournament.id) : null;
    const skeetId = skeetTournament ? Number(skeetTournament.id) : null;
    const [trapCounts, skeetCounts] = await Promise.all([
      countByClass(trapId),
      countByClass(skeetId),
    ]);

    // 8. Auto-detect straights (if no saved incentives)
    let autoStraights: StraightHit[] = [];
    if (!report || incentives.length === 0) {
      const detectForTournament = async (tId: number | null, evtType: string) => {
        if (!tId) return [];
        const scoreRows = await sql`
          SELECT s.member_code, s.name, m.belong,
                 s.r1, s.r2, s.r3, s.r4, s.r5, s.r6, s.r7, s.r8
          FROM scores s
          LEFT JOIN (
            SELECT DISTINCT ON (tournament_id, member_code)
              tournament_id, member_code, belong
            FROM members
            ORDER BY tournament_id, member_code, day
          ) m ON m.tournament_id = s.tournament_id AND m.member_code = s.member_code
          WHERE s.tournament_id = ${tId}
            AND s.status = 'valid'
        `;
        return detectStraights(scoreRows as Array<{
          member_code: string; name: string; belong: string;
          r1: number|null; r2: number|null; r3: number|null; r4: number|null;
          r5: number|null; r6: number|null; r7: number|null; r8: number|null;
        }>, evtType);
      };

      const [trapHits, skeetHits] = await Promise.all([
        detectForTournament(trapId, 'trap'),
        detectForTournament(skeetId, 'skeet'),
      ]);
      autoStraights = [...trapHits, ...skeetHits];
    }

    // 9. Fiscal year
    const fiscalYear = tournament.day1_date ? getFiscalYear(String(tournament.day1_date)) : null;

    // 10. Class division description
    const trapClassDiv = trapTournament ? String(trapTournament.class_division ?? 'none') : 'none';
    const skeetClassDiv = skeetTournament ? String(skeetTournament.class_division ?? 'none') : 'none';
    let classDivisionText = 'なし';
    if (trapClassDiv === 'divided' && skeetClassDiv === 'divided') {
      classDivisionText = 'あり';
    } else if (trapClassDiv === 'divided') {
      classDivisionText = 'トラップ＝クラス分けあり、スキート＝クラス分けなし';
    } else if (skeetClassDiv === 'divided') {
      classDivisionText = 'トラップ＝クラス分けなし、スキート＝クラス分けあり';
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        tournament,
        pairedTournament,
        report,
        incentives: report && incentives.length > 0 ? incentives : autoStraights.map((s, i) => ({ ...s, sort_order: i })),
        incentivesAreAuto: !report || incentives.length === 0,
        association,
        trapCounts,
        skeetCounts,
        fiscalYear,
        classDivisionText,
        trapTournamentId: trapId,
        skeetTournamentId: skeetId,
      },
    });
  } catch (e) {
    console.error('GET /api/tournaments/[id]/report error:', e);
    return NextResponse.json<ApiResponse>({ success: false, error: '報告データの取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/tournaments/[id]/report
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);
    const body = await req.json();

    const session = await getServerSession(authOptions);
    const userName = session?.user?.name ?? session?.user?.email ?? null;

    const {
      paired_tournament_id,
      report_date,
      certification_fee,
      advertising_fee,
      remarks,
      incentives,
      president_name,
      organizer_cd,
    } = body;

    // 1. Upsert report - find existing first
    let reportRows;
    const pairedId = paired_tournament_id ? Number(paired_tournament_id) : null;
    if (pairedId) {
      reportRows = await sql`
        SELECT id FROM tournament_reports
        WHERE (tournament_id = ${tid} OR paired_tournament_id = ${tid}
           OR tournament_id = ${pairedId} OR paired_tournament_id = ${pairedId})
        LIMIT 1
      `;
    } else {
      reportRows = await sql`
        SELECT id FROM tournament_reports
        WHERE tournament_id = ${tid} OR paired_tournament_id = ${tid}
        LIMIT 1
      `;
    }

    let reportId: number;
    if (reportRows.length) {
      // Update existing
      reportId = Number(reportRows[0].id);
      await sql`
        UPDATE tournament_reports SET
          tournament_id = ${tid},
          paired_tournament_id = ${pairedId},
          report_date = ${report_date || null},
          certification_fee = ${certification_fee ?? 50000},
          advertising_fee = ${advertising_fee ?? 5000},
          remarks = ${remarks || null}
        WHERE id = ${reportId}
      `;
    } else {
      // Insert new
      const insertRows = await sql`
        INSERT INTO tournament_reports (tournament_id, paired_tournament_id, report_date, certification_fee, advertising_fee, remarks)
        VALUES (${tid}, ${pairedId}, ${report_date || null}, ${certification_fee ?? 50000}, ${advertising_fee ?? 5000}, ${remarks || null})
        RETURNING id
      `;
      reportId = Number(insertRows[0].id);
    }

    // 2. Replace incentives
    await sql`DELETE FROM report_incentives WHERE report_id = ${reportId}`;
    if (Array.isArray(incentives) && incentives.length > 0) {
      for (let i = 0; i < incentives.length; i++) {
        const inc = incentives[i];
        await sql`
          INSERT INTO report_incentives (report_id, event_type, straight_type, player_name, member_code, belong, amount, sort_order)
          VALUES (${reportId}, ${inc.event_type}, ${inc.straight_type}, ${inc.player_name || ''}, ${inc.member_code || ''}, ${inc.belong || ''}, ${inc.amount ?? 0}, ${i})
        `;
      }
    }

    // 3. Update association president_name
    if (organizer_cd && president_name !== undefined) {
      await sql`
        UPDATE associations SET president_name = ${president_name || null}
        WHERE cd = ${organizer_cd}
      `;
    }

    // 4. Operation log
    const tRows = await sql`SELECT name FROM tournaments WHERE id = ${tid}`;
    const tournamentName = tRows.length ? String(tRows[0].name) : null;
    await writeOperationLog({
      tournamentId: tid,
      tournamentName,
      adminName: userName,
      adminAffiliation: session?.user?.affiliation ?? null,
      action: 'report_save',
    });

    return NextResponse.json<ApiResponse>({ success: true, data: { reportId } });
  } catch (e) {
    console.error('PUT /api/tournaments/[id]/report error:', e);
    return NextResponse.json<ApiResponse>({ success: false, error: '報告データの保存に失敗しました' }, { status: 500 });
  }
}
