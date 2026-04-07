import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Result, Tournament } from '@/lib/types';
import { TEMPLATE_BASE64 } from '@/templates/inspection-report-template';
import JSZip from 'jszip';

type Params = { params: Promise<{ id: string }> };

// --- XML操作ヘルパー ---

/** XML特殊文字のエスケープ */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * シートXML内の指定セルの値を置換する。
 * テンプレートの書式(style)は保持し、printerSettings等のXML構造は一切変更しない。
 *
 * @param xml  sheet1.xml の文字列
 * @param ref  セル参照 (例: "C4", "A10")
 * @param value  null/'' → 空セル, number → 数値, string → インライン文字列
 */
function setCellInXml(xml: string, ref: string, value: string | number | null): string {
  const marker = `<c r="${ref}"`;
  const pos = xml.indexOf(marker);
  if (pos === -1) return xml;

  // セル要素の終端を探す
  let i = pos + marker.length;
  let isSelfClosing = false;
  while (i < xml.length) {
    if (xml[i] === '/' && xml[i + 1] === '>') {
      isSelfClosing = true;
      i += 2;
      break;
    }
    if (xml[i] === '>') {
      i++;
      break;
    }
    i++;
  }

  let endIdx: number;
  if (isSelfClosing) {
    endIdx = i;
  } else {
    endIdx = xml.indexOf('</c>', i) + 4;
  }

  // 既存セルからstyle属性を抽出
  const oldCell = xml.substring(pos, endIdx);
  const styleMatch = oldCell.match(/s="(\d+)"/);
  const style = styleMatch ? ` s="${styleMatch[1]}"` : '';

  // 新しいセル要素を構築
  let newCell: string;
  if (value === null || value === '') {
    newCell = `<c r="${ref}"${style}/>`;
  } else if (typeof value === 'number') {
    newCell = `<c r="${ref}"${style}><v>${value}</v></c>`;
  } else {
    // インライン文字列 (sharedStrings.xml への追加不要)
    newCell = `<c r="${ref}"${style} t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
  }

  return xml.substring(0, pos) + newCell + xml.substring(endIdx);
}

// GET /api/tournaments/[id]/inspection-report?date=2026-04-07&classes=AA,A
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const tournamentId = Number(id);
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const classesParam = searchParams.get('classes'); // "AA,A" or null

    // データ取得（並列）
    const [tournamentRows, resultRows, assocRows] = await Promise.all([
      sql`SELECT * FROM tournaments WHERE id = ${tournamentId}`,
      sql`SELECT * FROM v_results WHERE tournament_id = ${tournamentId} ORDER BY rank NULLS LAST, total DESC, name`,
      sql`SELECT cd, name FROM associations`,
    ]);

    if (!tournamentRows.length) {
      return NextResponse.json({ success: false, error: '大会が見つかりません' }, { status: 404 });
    }

    const tournament = tournamentRows[0] as Tournament;
    let results = resultRows as Result[];

    // クラスフィルター
    if (classesParam) {
      const selectedClasses = classesParam.split(',');
      results = results.filter(r => r.class && selectedClasses.includes(r.class));
    }

    // 最大72名まで（テンプレートの行数制限）
    if (results.length > 72) {
      results = results.slice(0, 72);
    }

    // 主催協会名の取得
    const assocMap = new Map(assocRows.map(r => [Number(r.cd), r.name as string]));
    const organizerName = tournament.organizer_cd ? (assocMap.get(tournament.organizer_cd) ?? '') : '';

    // --- テンプレートをZIPとして読み込み（XML構造を完全保持）---
    const zip = await JSZip.loadAsync(TEMPLATE_BASE64, { base64: true });

    const sheetFile = zip.file('xl/worksheets/sheet1.xml');
    if (!sheetFile) {
      return NextResponse.json({ success: false, error: 'テンプレートシートが見つかりません' }, { status: 500 });
    }
    let sheetXml = await sheetFile.async('string');

    // --- ヘッダー情報埋め込み ---

    // 日付 (Row 3): L3=年, O3=月, Q3=日
    const [year, month, day] = dateStr.split('-');
    sheetXml = setCellInXml(sheetXml, 'L3', Number(year));
    sheetXml = setCellInXml(sheetXml, 'O3', Number(month));
    sheetXml = setCellInXml(sheetXml, 'Q3', Number(day));

    // 大会名 (C4)
    sheetXml = setCellInXml(sheetXml, 'C4', tournament.name ?? '');

    // ルール (C5)
    sheetXml = setCellInXml(sheetXml, 'C5', tournament.rule_type ?? '');

    // 種目 (G4): "T　トラップ" or "S　スキート"
    sheetXml = setCellInXml(sheetXml, 'G4', tournament.event_type === 'trap' ? 'T　トラップ' : 'S　スキート');

    // クラス (J4)
    sheetXml = setCellInXml(sheetXml, 'J4', classesParam ? classesParam.split(',').join('/') : '');

    // 主催協会 (C6)
    sheetXml = setCellInXml(sheetXml, 'C6', organizerName);

    // 射撃場名 (C7)
    sheetXml = setCellInXml(sheetXml, 'C7', tournament.venue ?? '');

    // 使用クレー名 (C8)
    sheetXml = setCellInXml(sheetXml, 'C8', tournament.clay_name ?? '');

    // 天候 (I6)
    sheetXml = setCellInXml(sheetXml, 'I6', tournament.weather ?? '');

    // 気温 (I7)
    sheetXml = setCellInXml(sheetXml, 'I7', tournament.temperature ?? '');

    // 風速 (I8)
    sheetXml = setCellInXml(sheetXml, 'I8', tournament.wind_speed ?? '');

    // 審査委員長 (O4)
    sheetXml = setCellInXml(sheetXml, 'O4', tournament.chief_judge ?? '');

    // 大会運営責任者 (O5)
    sheetXml = setCellInXml(sheetXml, 'O5', tournament.operation_manager ?? '');

    // 記録責任者 (O6)
    sheetXml = setCellInXml(sheetXml, 'O6', tournament.record_manager ?? '');

    // セット確認者 (O7)
    sheetXml = setCellInXml(sheetXml, 'O7', tournament.set_checker ?? '');

    // トラップセットNo. (P8)
    const setNoStr = [
      tournament.day1_set ? `1日目:${tournament.day1_set}` : '',
      tournament.day2_set ? `2日目:${tournament.day2_set}` : '',
    ].filter(Boolean).join(' / ');
    sheetXml = setCellInXml(sheetXml, 'P8', setNoStr);

    // --- データ行 (Row 10〜81, 最大72行) ---
    const DATA_START_ROW = 10;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const row = DATA_START_ROW + i;

      // 順位 (A)
      sheetXml = setCellInXml(sheetXml, `A${row}`, r.rank != null ? Number(r.rank) : '');

      // 会員番号 (B)
      sheetXml = setCellInXml(sheetXml, `B${row}`, r.member_code ?? '');

      // 氏名 (C)
      sheetXml = setCellInXml(sheetXml, `C${row}`, r.name ?? '');

      // 所属 (D)
      sheetXml = setCellInXml(sheetXml, `D${row}`, r.belong ?? '');

      // 1日目ラウンド (E-H) — 数値セル
      const r1 = r.r1 != null ? Number(r.r1) : null;
      const r2 = r.r2 != null ? Number(r.r2) : null;
      const r3 = r.r3 != null ? Number(r.r3) : null;
      const r4 = r.r4 != null ? Number(r.r4) : null;
      sheetXml = setCellInXml(sheetXml, `E${row}`, r1 ?? '');
      sheetXml = setCellInXml(sheetXml, `F${row}`, r2 ?? '');
      sheetXml = setCellInXml(sheetXml, `G${row}`, r3 ?? '');
      sheetXml = setCellInXml(sheetXml, `H${row}`, r4 ?? '');

      // I列 (計) — SUM数式を保持。入力セル(E-H)を設定すれば自動計算される

      // 2日目ラウンド (J-M)
      const r5 = r.r5 != null ? Number(r.r5) : null;
      const r6 = r.r6 != null ? Number(r.r6) : null;
      const r7 = r.r7 != null ? Number(r.r7) : null;
      const r8 = r.r8 != null ? Number(r.r8) : null;
      sheetXml = setCellInXml(sheetXml, `J${row}`, r5 ?? '');
      sheetXml = setCellInXml(sheetXml, `K${row}`, r6 ?? '');
      sheetXml = setCellInXml(sheetXml, `L${row}`, r7 ?? '');
      sheetXml = setCellInXml(sheetXml, `M${row}`, r8 ?? '');

      // N列 (2日目計) — 数式がないセルが大半なので直接値をセット
      const day2Total = Number(r.day2_total);
      sheetXml = setCellInXml(sheetXml, `N${row}`, day2Total > 0 ? day2Total : '');

      // O列 (総計) — IF数式を保持。I列とN列から自動計算される

      // 摘要 (P) — CB/FR/失格/棄権
      let remarks = '';
      if (r.status === 'disqualified') {
        remarks = '失格';
      } else if (r.status === 'withdrawn') {
        remarks = '棄権';
      } else {
        const parts: string[] = [];
        if (r.cb != null && Number(r.cb) > 0) parts.push(`CB${r.cb}`);
        if (r.fr != null && Number(r.fr) > 0) parts.push(`FR${r.fr}`);
        remarks = parts.join('');
      }
      sheetXml = setCellInXml(sheetXml, `P${row}`, remarks);
    }

    // calcChain.xmlを削除（数式の再計算をExcelに強制）
    zip.remove('xl/calcChain.xml');

    // 変更したシートXMLをZIPに書き戻し
    zip.file('xl/worksheets/sheet1.xml', sheetXml);

    // ZIP（xlsx）を出力
    const outBuf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // ファイル名生成
    const safeName = (tournament.name ?? '大会').replace(/[\\/:*?"<>|]/g, '_');
    const classLabel = classesParam ? `_${classesParam.replace(/,/g, '-')}` : '';
    const fileName = `記録審査表_${safeName}${classLabel}_${dateStr}.xlsx`;

    return new NextResponse(outBuf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error('inspection-report error:', e);
    return NextResponse.json({ success: false, error: 'レポート生成に失敗しました' }, { status: 500 });
  }
}
