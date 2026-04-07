import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Result, Tournament } from '@/lib/types';
import { TEMPLATE_BASE64 } from '@/templates/inspection-report-template';
import ExcelJS from 'exceljs';

type Params = { params: Promise<{ id: string }> };

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

    // 主催協会名の取得
    const assocMap = new Map(assocRows.map(r => [Number(r.cd), r.name as string]));
    const organizerName = tournament.organizer_cd ? (assocMap.get(tournament.organizer_cd) ?? '') : '';

    // テンプレート読み込み
    const templateBuf = Buffer.from(TEMPLATE_BASE64, 'base64') as unknown as ArrayBuffer;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuf);
    const ws = wb.getWorksheet('TRAPAB');
    if (!ws) {
      return NextResponse.json({ success: false, error: 'テンプレートシートが見つかりません' }, { status: 500 });
    }

    // --- ヘッダー情報埋め込み ---
    // セルへの値セット用ヘルパー
    const setCell = (ref: string, value: string | number) => {
      const cell = ws.getCell(ref);
      cell.value = value === '' ? null : value;
    };

    // 日付 (Row 3): L3=年, O3=月, Q3=日
    const [year, month, day] = dateStr.split('-');
    setCell('L3', Number(year));
    setCell('O3', Number(month));
    setCell('Q3', Number(day));

    // 大会名 (C4)
    setCell('C4', tournament.name ?? '');

    // ルール (C5)
    setCell('C5', tournament.rule_type ?? '');

    // 種目 (G4): "T　トラップ" or "S　スキート"
    setCell('G4', tournament.event_type === 'trap' ? 'T　トラップ' : 'S　スキート');

    // クラス (J4)
    setCell('J4', classesParam ? classesParam.split(',').join('/') : '');

    // 主催協会 (C6)
    setCell('C6', organizerName);

    // 射撃場名 (C7)
    setCell('C7', tournament.venue ?? '');

    // 使用クレー名 (C8)
    setCell('C8', tournament.clay_name ?? '');

    // 天候 (I6)
    setCell('I6', tournament.weather ?? '');

    // 気温 (I7)
    setCell('I7', tournament.temperature ?? '');

    // 風速 (I8)
    setCell('I8', tournament.wind_speed ?? '');

    // 審査委員長 (O4)
    setCell('O4', tournament.chief_judge ?? '');

    // 大会運営責任者 (O5)
    setCell('O5', tournament.operation_manager ?? '');

    // 記録責任者 (O6)
    setCell('O6', tournament.record_manager ?? '');

    // セット確認者 (O7)
    setCell('O7', tournament.set_checker ?? '');

    // トラップセットNo. (P8)
    const setNoStr = [
      tournament.day1_set ? `1日目:${tournament.day1_set}` : '',
      tournament.day2_set ? `2日目:${tournament.day2_set}` : '',
    ].filter(Boolean).join(' / ');
    setCell('P8', setNoStr);

    // --- データ行 (Row 10〜) ---
    const DATA_START_ROW = 10;
    const ROWS_PER_PAGE = 36;

    // 36行以上の場合は行を追加（テンプレートの最終データ行をコピーして挿入）
    if (results.length > ROWS_PER_PAGE) {
      const extraRows = results.length - ROWS_PER_PAGE;
      // Row 46(フッター)の前に行を挿入
      for (let i = 0; i < extraRows; i++) {
        ws.insertRow(DATA_START_ROW + ROWS_PER_PAGE + i, []);
      }
    }

    // データ行を書き込み
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const row = DATA_START_ROW + i;

      setCell(`A${row}`, r.rank ?? '');
      setCell(`B${row}`, r.member_code ?? '');
      setCell(`C${row}`, r.name ?? '');
      setCell(`D${row}`, r.belong ?? '');
      setCell(`E${row}`, r.r1 ?? '');
      setCell(`F${row}`, r.r2 ?? '');
      setCell(`G${row}`, r.r3 ?? '');
      setCell(`H${row}`, r.r4 ?? '');

      // 計 (I) - 1日目合計
      const day1Total = Number(r.day1_total);
      setCell(`I${row}`, day1Total > 0 ? day1Total : '');

      setCell(`J${row}`, r.r5 ?? '');
      setCell(`K${row}`, r.r6 ?? '');
      setCell(`L${row}`, r.r7 ?? '');
      setCell(`M${row}`, r.r8 ?? '');

      // 計 (N) - 2日目合計
      const day2Total = Number(r.day2_total);
      setCell(`N${row}`, day2Total > 0 ? day2Total : '');

      // 総計 (O)
      const total = Number(r.total);
      setCell(`O${row}`, total > 0 ? total : '');

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
      setCell(`P${row}`, remarks);

      // クラス (S, hidden column)
      setCell(`S${row}`, r.class ?? '');
    }

    // 未使用のデータ行をクリア（36行より少ない場合）
    for (let i = results.length; i < ROWS_PER_PAGE; i++) {
      const row = DATA_START_ROW + i;
      setCell(`A${row}`, i + 1);
      for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'S']) {
        setCell(`${col}${row}`, '');
      }
    }

    // ページ設定をテンプレートと同一に復元（ExcelJSが属性を変更するのを防止）
    ws.pageSetup = {
      ...ws.pageSetup,
      paperSize: 9,
      orientation: 'portrait' as const,
      scale: 97,
      fitToPage: false,       // fitToPageを無効にしてscaleのみ有効
      fitToWidth: undefined,
      fitToHeight: undefined,
      printArea: 'A1:R46',
    };

    // ファイル名生成
    const safeName = (tournament.name ?? '大会').replace(/[\\/:*?"<>|]/g, '_');
    const classLabel = classesParam ? `_${classesParam.replace(/,/g, '-')}` : '';
    const fileName = `記録審査表_${safeName}${classLabel}_${dateStr}.xlsx`;

    // Excel出力
    const outBuf = await wb.xlsx.writeBuffer();

    return new NextResponse(outBuf, {
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
