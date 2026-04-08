import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import { REPORT_TEMPLATE_BASE64 } from '@/templates/report-template';
import JSZip from 'jszip';

type Params = { params: Promise<{ id: string }> };

// --- XML helpers (same as inspection-report) ---

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setCellInXml(xml: string, ref: string, value: string | number | null): string {
  const marker = `<c r="${ref}"`;
  const pos = xml.indexOf(marker);
  if (pos === -1) return xml;

  let i = pos + marker.length;
  let isSelfClosing = false;
  while (i < xml.length) {
    if (xml[i] === '/' && xml[i + 1] === '>') { isSelfClosing = true; i += 2; break; }
    if (xml[i] === '>') { i++; break; }
    i++;
  }

  let endIdx: number;
  if (isSelfClosing) {
    endIdx = i;
  } else {
    endIdx = xml.indexOf('</c>', i) + 4;
  }

  const oldCell = xml.substring(pos, endIdx);
  const styleMatch = oldCell.match(/s="(\d+)"/);
  const style = styleMatch ? ` s="${styleMatch[1]}"` : '';

  let newCell: string;
  if (value === null || value === '') {
    newCell = `<c r="${ref}"${style}/>`;
  } else if (typeof value === 'number') {
    // NaN/Infinity protection — write as empty cell to prevent XML corruption
    if (isNaN(value) || !isFinite(value)) {
      newCell = `<c r="${ref}"${style}/>`;
    } else {
      newCell = `<c r="${ref}"${style}><v>${value}</v></c>`;
    }
  } else {
    newCell = `<c r="${ref}"${style} t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
  }

  return xml.substring(0, pos) + newCell + xml.substring(endIdx);
}

// Safely parse DB date value (handles Date objects, ISO strings, date strings)
function parseDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const s = String(val);
  // Extract YYYY-MM-DD from any format and create local date
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Fallback: try direct parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Excel serial date from JS Date
function dateToSerial(d: Date): number {
  const epoch = new Date(1899, 11, 30);
  const diff = d.getTime() - epoch.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

// Clear cached <v> from formula cells so Excel recalculates on open
function clearFormulaCache(xml: string): string {
  return xml.replace(
    /<c ([^>]*)><f>([\s\S]*?)<\/f>(?:<v\/>|<v>[^<]*<\/v>)<\/c>/g,
    (_match, attrs: string, formula: string) => {
      const cleanAttrs = attrs.replace(/ t="[^"]*"/, '');
      return `<c ${cleanAttrs}><f>${formula}</f></c>`;
    }
  );
}

// Fiscal year (April start)
function getFiscalYear(val: unknown): number {
  const d = parseDate(val);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 4 ? y : y - 1;
}

// GET /api/tournaments/[id]/report-excel
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tid = Number(id);

    // 1. Get tournament + report
    const [tRows] = await Promise.all([
      sql`SELECT * FROM tournaments WHERE id = ${tid}`,
    ]);
    if (!tRows.length) {
      return NextResponse.json({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }
    const t = tRows[0] as Record<string, unknown>;

    // 2. Find paired tournament
    let paired: Record<string, unknown> | null = null;
    if (t.day1_date && t.organizer_cd) {
      const pRows = await sql`
        SELECT * FROM tournaments
        WHERE day1_date = ${t.day1_date} AND organizer_cd = ${t.organizer_cd}
          AND event_type != ${t.event_type} AND id != ${tid}
        LIMIT 1
      `;
      if (pRows.length) paired = pRows[0] as Record<string, unknown>;
    }

    // 3. Get report data
    const pairedId = paired ? Number(paired.id) : null;
    let reportRows;
    if (pairedId) {
      reportRows = await sql`
        SELECT * FROM tournament_reports
        WHERE tournament_id = ${tid} OR paired_tournament_id = ${tid}
           OR tournament_id = ${pairedId} OR paired_tournament_id = ${pairedId}
        LIMIT 1
      `;
    } else {
      reportRows = await sql`
        SELECT * FROM tournament_reports
        WHERE tournament_id = ${tid} OR paired_tournament_id = ${tid}
        LIMIT 1
      `;
    }
    const report = reportRows.length ? reportRows[0] as Record<string, unknown> : null;

    // 4. Get incentives
    let incentives: Array<Record<string, unknown>> = [];
    if (report) {
      incentives = await sql`
        SELECT * FROM report_incentives WHERE report_id = ${report.id} ORDER BY sort_order, id
      ` as Array<Record<string, unknown>>;
    }

    // 5. Get association
    let association: Record<string, unknown> | null = null;
    if (t.organizer_cd) {
      const aRows = await sql`SELECT * FROM associations WHERE cd = ${t.organizer_cd}`;
      if (aRows.length) association = aRows[0] as Record<string, unknown>;
    }

    // 6. Determine trap/skeet
    const trapT = String(t.event_type) === 'trap' ? t : paired;
    const skeetT = String(t.event_type) === 'skeet' ? t : paired;
    const trapId = trapT ? Number(trapT.id) : null;
    const skeetId = skeetT ? Number(skeetT.id) : null;

    // 7. Count participants by class
    const countByClass = async (tournamentId: number | null) => {
      if (!tournamentId) return { AA: 0, A: 0, B: 0, C: 0, none: 0, total: 0 };
      const rows = await sql`
        SELECT COALESCE(class, 'none') AS cls, COUNT(DISTINCT member_code) AS cnt
        FROM members WHERE tournament_id = ${tournamentId} AND member_code IS NOT NULL
        GROUP BY COALESCE(class, 'none')
      `;
      const map: Record<string, number> = { AA: 0, A: 0, B: 0, C: 0, none: 0 };
      for (const r of rows) {
        const cls = String(r.cls);
        if (cls in map) map[cls] = Number(r.cnt); else map['none'] += Number(r.cnt);
      }
      return { ...map, total: Object.values(map).reduce((a, b) => a + b, 0) };
    };
    const [trapCounts, skeetCounts] = await Promise.all([countByClass(trapId), countByClass(skeetId)]);

    // --- Build Excel ---
    const zip = await JSZip.loadAsync(REPORT_TEMPLATE_BASE64, { base64: true });
    const sheetFile = zip.file('xl/worksheets/sheet1.xml');
    if (!sheetFile) {
      return NextResponse.json({ success: false, error: 'テンプレートシートが見つかりません' }, { status: 500 });
    }
    let xml = await sheetFile.async('string');

    // Fiscal year
    const fiscalYear = t.day1_date ? getFiscalYear(t.day1_date) : new Date().getFullYear();

    // A1: Title with fiscal year
    xml = setCellInXml(xml, 'A1', `\u226A　${fiscalYear}年度　地方公式大会報告書　\u226B`);

    // P6: Report date (P6:T6 merged, overwrite template formula with actual date)
    const reportDate = report?.report_date ? parseDate(report.report_date) : new Date();
    xml = setCellInXml(xml, 'P6', dateToSerial(reportDate));

    // C7: Tournament name (strip event type suffix)
    const tName = String(t.name ?? '');
    xml = setCellInXml(xml, 'C7', tName);

    // N7: Prefecture name
    const assocName = association ? String(association.name ?? '') : '';
    xml = setCellInXml(xml, 'N7', assocName);

    // D8: Opening date (D8:M8 merged)
    if (t.day1_date) {
      xml = setCellInXml(xml, 'D8', dateToSerial(parseDate(t.day1_date)));
    }

    // P8: President name
    const presName = association ? String(association.president_name ?? '') : '';
    xml = setCellInXml(xml, 'P8', presName || '');

    // C9: Venue
    xml = setCellInXml(xml, 'C9', String(t.venue ?? ''));

    // Q9: Clay name
    xml = setCellInXml(xml, 'Q9', String(t.clay_name ?? ''));

    // C10: Rule type — use current tournament's rule_type directly
    xml = setCellInXml(xml, 'C10', String(t.rule_type ?? ''));

    // Q10: Chief judge
    xml = setCellInXml(xml, 'Q10', String(t.chief_judge ?? ''));

    // C11: Event type
    const hasTraps = !!trapId;
    const hasSkeet = !!skeetId;
    const eventText = hasTraps && hasSkeet ? 'トラップ　・　スキート' : hasTraps ? 'トラップ' : 'スキート';
    xml = setCellInXml(xml, 'C11', eventText);

    // Q11: Record manager
    xml = setCellInXml(xml, 'Q11', String(t.record_manager ?? ''));

    // C12: Class division
    const trapClassDiv = trapT ? String(trapT.class_division ?? 'none') : 'none';
    const skeetClassDiv = skeetT ? String(skeetT.class_division ?? 'none') : 'none';
    let classDivText = 'なし';
    if (trapClassDiv === 'divided' && skeetClassDiv === 'divided') classDivText = 'あり';
    else if (trapClassDiv === 'divided') classDivText = 'トラップ＝あり、スキート＝なし';
    else if (skeetClassDiv === 'divided') classDivText = 'トラップ＝なし、スキート＝あり';
    xml = setCellInXml(xml, 'C12', classDivText);

    // Q12: Set checker
    xml = setCellInXml(xml, 'Q12', String(t.set_checker ?? ''));

    // Participant counts — G=trap, K=skeet (rows 14-17: A,B,C,none)
    const classRows = [
      { row: 14, cls: 'A' },
      { row: 15, cls: 'B' },
      { row: 16, cls: 'C' },
      { row: 17, cls: 'none' },
    ];
    for (const { row, cls } of classRows) {
      const trapN = (trapCounts as Record<string, number>)[cls] ?? 0;
      const skeetN = (skeetCounts as Record<string, number>)[cls] ?? 0;
      xml = setCellInXml(xml, `G${row}`, trapN || null);
      xml = setCellInXml(xml, `K${row}`, skeetN || null);
    }

    // Incentive rows (rows 23-27, max 5)
    for (let i = 0; i < 5; i++) {
      const row = 23 + i;
      if (i < incentives.length) {
        const inc = incentives[i];
        const evtType = String(inc.event_type) === 'trap' ? 'T' : 'S';
        xml = setCellInXml(xml, `B${row}`, evtType);
        xml = setCellInXml(xml, `C${row}`, Number(inc.straight_type));
        xml = setCellInXml(xml, `G${row}`, String(inc.player_name ?? ''));
        xml = setCellInXml(xml, `K${row}`, String(inc.member_code ?? ''));
        xml = setCellInXml(xml, `N${row}`, String(inc.belong ?? ''));
        xml = setCellInXml(xml, `P${row}`, Number(inc.amount ?? 0));
      } else {
        // Clear empty rows
        xml = setCellInXml(xml, `B${row}`, null);
        xml = setCellInXml(xml, `C${row}`, null);
        xml = setCellInXml(xml, `G${row}`, null);
        xml = setCellInXml(xml, `K${row}`, null);
        xml = setCellInXml(xml, `N${row}`, null);
        xml = setCellInXml(xml, `P${row}`, null);
      }
    }

    // Fee cells
    const certFee = report ? Number(report.certification_fee ?? 50000) : 50000;
    const adFee = report ? Number(report.advertising_fee ?? 5000) : 5000;
    xml = setCellInXml(xml, 'J29', certFee);
    xml = setCellInXml(xml, 'J30', adFee);

    // Q33: incentive payment total (number of people x amount - manual)
    const incentiveTotal = incentives.reduce((sum, inc) => sum + Number(inc.amount ?? 0), 0);
    xml = setCellInXml(xml, 'Q33', incentiveTotal || null);
    // O33: incentive count
    xml = setCellInXml(xml, 'O33', incentives.length || null);

    // Remarks (C37 area - merged A37+)
    const remarksText = report ? String(report.remarks ?? '') : '';
    if (remarksText) {
      xml = setCellInXml(xml, 'C37', remarksText);
    }

    // Clear cached formula values so Excel recalculates on open
    xml = clearFormulaCache(xml);

    // Save XML back
    zip.file('xl/worksheets/sheet1.xml', xml);

    // Force Excel to recalculate all formulas on open
    const wbFile = zip.file('xl/workbook.xml');
    if (wbFile) {
      let wbXml = await wbFile.async('string');
      wbXml = wbXml.replace(
        /<calcPr([^/]*)\/?>/,
        '<calcPr$1 fullCalcOnLoad="1"/>'
      );
      zip.file('xl/workbook.xml', wbXml);
    }

    // Generate output
    const outBuf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const fileName = `大会報告書_${tName}.xlsx`;

    // Operation log
    const session = await getServerSession(authOptions);
    await writeOperationLog({
      tournamentId: tid,
      tournamentName: tName,
      adminName: session?.user?.name ?? session?.user?.email ?? null,
      adminAffiliation: session?.user?.affiliation ?? null,
      action: 'report_download',
    });

    return new NextResponse(new Uint8Array(outBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error('GET /api/tournaments/[id]/report-excel error:', e);
    return NextResponse.json({ success: false, error: 'Excel生成に失敗しました' }, { status: 500 });
  }
}
