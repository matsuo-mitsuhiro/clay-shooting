import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Result, Tournament } from '@/lib/types';

// Node.jsランタイム明示
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // 動的import（ビルド時のバンドルエラー回避）
    const XLSX = await import('xlsx');
    const { TEMPLATE_BASE64 } = await import('@/templates/inspection-report-template');

    // テンプレート読み込み（Base64埋め込み）
    const templateBuf = Buffer.from(TEMPLATE_BASE64, 'base64');
    const wb = XLSX.read(templateBuf, { type: 'buffer' });
    const ws = wb.Sheets['TRAPAB'];
    if (!ws) {
      return NextResponse.json({ success: false, error: 'テンプレートシートが見つかりません' }, { status: 500 });
    }

    // --- ヘッダー情報埋め込み ---

    // 日付 (Row 3): L3=年, O3=月, Q3=日
    const [year, month, day] = dateStr.split('-');
    setCellValue(ws, 'L3', Number(year));
    setCellValue(ws, 'O3', Number(month));
    setCellValue(ws, 'Q3', Number(day));

    // 大会名 (C4)
    setCellValue(ws, 'C4', tournament.name ?? '');

    // ルール (C5)
    setCellValue(ws, 'C5', tournament.rule_type ?? '');

    // 種目 (G4): "T　トラップ" or "S　スキート"
    const eventLabel = tournament.event_type === 'trap' ? 'T　トラップ' : 'S　スキート';
    setCellValue(ws, 'G4', eventLabel);

    // クラス (J4)
    if (classesParam) {
      setCellValue(ws, 'J4', classesParam.split(',').join('/'));
    } else {
      setCellValue(ws, 'J4', '');
    }

    // 主催協会 (C6)
    setCellValue(ws, 'C6', organizerName);

    // 射撃場名 (C7)
    setCellValue(ws, 'C7', tournament.venue ?? '');

    // 使用クレー名 (C8)
    setCellValue(ws, 'C8', tournament.clay_name ?? '');

    // 天候 (I6)
    setCellValue(ws, 'I6', tournament.weather ?? '');

    // 気温 (I7)
    setCellValue(ws, 'I7', tournament.temperature ?? '');

    // 風速 (I8)
    setCellValue(ws, 'I8', tournament.wind_speed ?? '');

    // 審査委員長 (O4)
    setCellValue(ws, 'O4', tournament.chief_judge ?? '');

    // 大会運営責任者 (O5)
    setCellValue(ws, 'O5', tournament.operation_manager ?? '');

    // 記録責任者 (O6)
    setCellValue(ws, 'O6', tournament.record_manager ?? '');

    // セット確認者 (O7)
    setCellValue(ws, 'O7', tournament.set_checker ?? '');

    // トラップセットNo. (P8)
    const setNoStr = [
      tournament.day1_set ? `1日目:${tournament.day1_set}` : '',
      tournament.day2_set ? `2日目:${tournament.day2_set}` : '',
    ].filter(Boolean).join(' / ');
    setCellValue(ws, 'P8', setNoStr);

    // --- データ行 (Row 10〜) ---
    const DATA_START_ROW = 10;
    const ROWS_PER_PAGE = 36;
    const FOOTER_ROW_OFFSET = 46; // テンプレートのRow 46がフッター

    // 36行以上の場合は行を追加
    if (results.length > ROWS_PER_PAGE) {
      // テンプレートの行46(フッター)以降を拡張
      // 追加行数を計算
      const totalDataRows = results.length;
      const extraRows = totalDataRows - ROWS_PER_PAGE;

      // 行を挿入: Row 46(0-indexed: 45)の前に追加行を挿入
      // フッターを移動するため、データ行のフォーマットをコピーして追加
      const newFooterRow = DATA_START_ROW + totalDataRows; // 10 + totalDataRows

      // 既存の行46のフッターセルを新位置にコピー
      const footerRef = `A${FOOTER_ROW_OFFSET}`;
      const footerCell = ws[footerRef];
      if (footerCell) {
        setCellValue(ws, `A${newFooterRow}`, footerCell.v);
        // マージセルを更新
        if (ws['!merges']) {
          const newMerges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
          for (const merge of ws['!merges']) {
            if (merge.s.r === FOOTER_ROW_OFFSET - 1) {
              // フッター行のマージを新位置に移動
              newMerges.push({
                s: { r: newFooterRow - 1, c: merge.s.c },
                e: { r: newFooterRow - 1, c: merge.e.c },
              });
            } else {
              newMerges.push(merge);
            }
          }
          ws['!merges'] = newMerges;
        }
      }

      // 追加データ行のスタイルを設定（テンプレートの最終データ行からコピー）
      for (let i = ROWS_PER_PAGE; i < totalDataRows; i++) {
        const srcRow = DATA_START_ROW + ROWS_PER_PAGE - 1; // Row 45 (last template data row)
        const dstRow = DATA_START_ROW + i;
        const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
        for (const col of cols) {
          const srcCell = ws[`${col}${srcRow}`];
          if (srcCell && srcCell.s) {
            // スタイルだけコピー
            if (!ws[`${col}${dstRow}`]) {
              ws[`${col}${dstRow}`] = { t: 's', v: '' };
            }
            ws[`${col}${dstRow}`].s = srcCell.s;
          }
        }
        // P:R のマージを追加
        if (ws['!merges']) {
          ws['!merges'].push({
            s: { r: dstRow - 1, c: 15 }, // P = col 15
            e: { r: dstRow - 1, c: 17 }, // R = col 17
          });
        }
      }

      // ref を更新
      ws['!ref'] = `A1:S${newFooterRow + 5}`;
    }

    // データ行を書き込み
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const row = DATA_START_ROW + i;

      // 順位 (A)
      setCellValue(ws, `A${row}`, r.rank ?? '');

      // 会員番号 (B)
      setCellValue(ws, `B${row}`, r.member_code ?? '');

      // 氏名 (C)
      setCellValue(ws, `C${row}`, r.name ?? '');

      // 所属 (D)
      setCellValue(ws, `D${row}`, r.belong ?? '');

      // R1-R4 (E-H)
      setCellValue(ws, `E${row}`, r.r1 ?? '');
      setCellValue(ws, `F${row}`, r.r2 ?? '');
      setCellValue(ws, `G${row}`, r.r3 ?? '');
      setCellValue(ws, `H${row}`, r.r4 ?? '');

      // 計 (I) - 1日目合計
      const day1Total = r.day1_total;
      setCellValue(ws, `I${row}`, day1Total > 0 ? day1Total : '');

      // R5-R8 (J-M)
      setCellValue(ws, `J${row}`, r.r5 ?? '');
      setCellValue(ws, `K${row}`, r.r6 ?? '');
      setCellValue(ws, `L${row}`, r.r7 ?? '');
      setCellValue(ws, `M${row}`, r.r8 ?? '');

      // 計 (N) - 2日目合計
      const day2Total = r.day2_total;
      setCellValue(ws, `N${row}`, day2Total > 0 ? day2Total : '');

      // 総計 (O)
      setCellValue(ws, `O${row}`, r.total > 0 ? r.total : '');

      // 摘要 (P) — CB/FR/失格/棄権
      let remarks = '';
      if (r.status === 'disqualified') {
        remarks = '失格';
      } else if (r.status === 'withdrawn') {
        remarks = '棄権';
      } else {
        const parts: string[] = [];
        if (r.cb != null && r.cb > 0) parts.push(`CB${r.cb}`);
        if (r.fr != null && r.fr > 0) parts.push(`FR${r.fr}`);
        remarks = parts.join('');
      }
      setCellValue(ws, `P${row}`, remarks);

      // クラス (S, hidden column)
      setCellValue(ws, `S${row}`, r.class ?? '');
    }

    // 未使用のデータ行をクリア（36行より少ない場合）
    const totalDataRows = Math.max(results.length, ROWS_PER_PAGE);
    for (let i = results.length; i < ROWS_PER_PAGE; i++) {
      const row = DATA_START_ROW + i;
      // 順位番号はテンプレートにあるが、データがないならクリア
      setCellValue(ws, `A${row}`, i + 1); // 番号はそのまま残す
      const clearCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'S'];
      for (const col of clearCols) {
        setCellValue(ws, `${col}${row}`, '');
      }
    }

    // ファイル名生成
    const safeName = (tournament.name ?? '大会').replace(/[\\/:*?"<>|]/g, '_');
    const classLabel = classesParam ? `_${classesParam.replace(/,/g, '-')}` : '';
    const fileName = `記録審査表_${safeName}${classLabel}_${dateStr}.xlsx`;

    // Excel出力
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
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

// セル値を安全にセット
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setCellValue(ws: any, ref: string, value: string | number) {
  const existing = ws[ref];
  if (existing) {
    existing.v = value;
    existing.t = typeof value === 'number' ? 'n' : 's';
    // 数式があれば削除（データで上書き）
    delete existing.f;
    delete existing.w;
  } else {
    ws[ref] = {
      t: typeof value === 'number' ? 'n' : 's',
      v: value,
    };
  }
}
