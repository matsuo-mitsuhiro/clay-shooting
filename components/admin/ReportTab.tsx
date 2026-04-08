'use client';

import { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

interface ClassCounts {
  AA: number;
  A: number;
  B: number;
  C: number;
  none: number;
  total: number;
}

interface IncentiveRow {
  event_type: string;
  straight_type: number;
  player_name: string;
  member_code: string;
  belong: string;
  amount: number;
  sort_order: number;
}

interface ReportData {
  tournament: Record<string, unknown>;
  pairedTournament: Record<string, unknown> | null;
  report: {
    id: number;
    report_date: string | null;
    certification_fee: number;
    advertising_fee: number;
    remarks: string | null;
  } | null;
  incentives: IncentiveRow[];
  incentivesAreAuto: boolean;
  association: { cd: number; name: string; president_name: string | null } | null;
  trapCounts: ClassCounts;
  skeetCounts: ClassCounts;
  fiscalYear: number | null;
  classDivisionText: string;
  trapTournamentId: number | null;
  skeetTournamentId: number | null;
}

const AMOUNT_MAP: Record<number, number> = { 50: 20000, 75: 40000, 100: 80000 };

export default function ReportTab({ tournamentId, tournament, onUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  // Form fields
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [presidentName, setPresidentName] = useState('');
  const [certFee, setCertFee] = useState(50000);
  const [adFee, setAdFee] = useState(5000);
  const [remarks, setRemarks] = useState('');
  const [incentives, setIncentives] = useState<IncentiveRow[]>([]);

  // Excel dialog
  const [showExcelDialog, setShowExcelDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tournaments/${tournamentId}/report`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const d = json.data as ReportData;
      setData(d);

      // Populate form
      if (d.report) {
        setReportDate(d.report.report_date ? new Date(d.report.report_date) : new Date());
        setCertFee(d.report.certification_fee ?? 50000);
        setAdFee(d.report.advertising_fee ?? 5000);
        setRemarks(d.report.remarks ?? '');
      } else {
        setReportDate(new Date());
        setCertFee(50000);
        setAdFee(5000);
        setRemarks('');
      }
      setPresidentName(d.association?.president_name ?? '');
      setIncentives(d.incentives ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Save
  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paired_tournament_id: data.pairedTournament ? Number(data.pairedTournament.id) : null,
          report_date: reportDate.toISOString().slice(0, 10),
          certification_fee: certFee,
          advertising_fee: adFee,
          remarks,
          incentives,
          president_name: presidentName,
          organizer_cd: tournament.organizer_cd,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess(true);
      onUpdated();
      setTimeout(() => setSuccess(false), 2000);
      // Refresh to get saved state
      await fetchReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // Incentive helpers
  const addIncentive = () => {
    setIncentives(prev => [...prev, {
      event_type: String(tournament.event_type),
      straight_type: 50,
      player_name: '',
      member_code: '',
      belong: '',
      amount: 20000,
      sort_order: prev.length,
    }]);
  };

  const removeIncentive = (idx: number) => {
    setIncentives(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIncentive = (idx: number, field: keyof IncentiveRow, value: string | number) => {
    setIncentives(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      // Auto-update amount when straight_type changes
      if (field === 'straight_type') {
        updated.amount = AMOUNT_MAP[Number(value)] ?? 0;
      }
      return updated;
    }));
  };

  // Calculations
  const totalParticipants = (data?.trapCounts.total ?? 0) + (data?.skeetCounts.total ?? 0);
  const feeTotal = certFee + adFee;
  const incentiveFee = 1000 * totalParticipants;
  const participationFee = 1000 * totalParticipants;
  const incentivePayTotal = incentives.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const incentivePayCount = incentives.length;
  const netFee = (incentiveFee + participationFee) - incentivePayTotal;
  const grandTotal = feeTotal + netFee;

  // Excel download
  const handleExcelDownload = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/report-excel`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        alert(json?.error ?? 'Excel生成に失敗しました');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      let fileName = '大会報告書.xlsx';
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)/);
        if (match) fileName = decodeURIComponent(match[1]);
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExcelDialog(false);
    } catch {
      alert('ダウンロードに失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // --- Styles ---
  const cardStyle: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '24px 20px',
    marginBottom: 16,
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 14,
    paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, color: C.muted, marginBottom: 4, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 14, color: C.text,
    background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 6,
    outline: 'none', boxSizing: 'border-box',
  };
  const readOnlyStyle: React.CSSProperties = {
    ...inputStyle, background: C.surface2, cursor: 'default', color: C.muted,
  };
  const gridStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px 16px',
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>読み込み中...</div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.red }}>{error ?? 'データの取得に失敗しました'}</div>;
  }

  const trapT = data.trapTournamentId ? data.tournament : data.pairedTournament;
  const skeetT = data.skeetTournamentId
    ? (Number(data.tournament.id) === data.skeetTournamentId ? data.tournament : data.pairedTournament)
    : null;

  // Rule text (combine if different)
  const trapRule = trapT ? String(trapT.rule_type ?? '') : '';
  const skeetRule = skeetT ? String(skeetT.rule_type ?? '') : '';
  const ruleText = trapRule === skeetRule ? trapRule : [trapRule, skeetRule].filter(Boolean).join(' / ');

  // Event type text
  const hasTraps = !!data.trapTournamentId;
  const hasSkeet = !!data.skeetTournamentId;
  const eventText = hasTraps && hasSkeet ? 'トラップ・スキート' : hasTraps ? 'トラップ' : 'スキート';

  return (
    <div>
      <div style={{ padding: '20px', pointerEvents: showExcelDialog ? 'none' as const : 'auto' as const }}>

        {/* ペア大会情報 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>ペア大会</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: `${C.gold}33`, color: C.gold, border: `1px solid ${C.gold}`,
                borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: 'center',
              }}>トラップ</span>
              {data.trapTournamentId ? (
                <span style={{ color: C.text, fontSize: 14 }}>
                  {trapT ? String(trapT.name) : ''} (ID:{data.trapTournamentId})
                  <span style={{ color: C.green, marginLeft: 8 }}>✓ 検出</span>
                </span>
              ) : (
                <span style={{ color: C.muted, fontSize: 14 }}>該当なし</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: `${C.blue2}33`, color: C.blue2, border: `1px solid ${C.blue2}`,
                borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: 'center',
              }}>スキート</span>
              {data.skeetTournamentId ? (
                <span style={{ color: C.text, fontSize: 14 }}>
                  {skeetT ? String(skeetT.name) : ''} (ID:{data.skeetTournamentId})
                  <span style={{ color: C.green, marginLeft: 8 }}>✓ 検出</span>
                </span>
              ) : (
                <span style={{ color: C.muted, fontSize: 14 }}>該当なし</span>
              )}
            </div>
          </div>
        </div>

        {/* 基本情報 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>基本情報</div>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>年度</label>
              <input style={readOnlyStyle} value={data.fiscalYear ? `${data.fiscalYear}年度` : ''} readOnly />
            </div>
            <div>
              <label style={labelStyle}>報告日</label>
              <DatePicker
                selected={reportDate}
                onChange={(date: Date | null) => { if (date) setReportDate(date); }}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                customInput={<input style={{ ...inputStyle, width: 180, cursor: 'pointer' }} readOnly />}
              />
            </div>
            <div>
              <label style={labelStyle}>主催</label>
              <input style={readOnlyStyle} value={data.association ? `${data.association.name} クレー射撃協会` : ''} readOnly />
            </div>
            <div>
              <label style={labelStyle}>会長名</label>
              <input
                style={inputStyle}
                value={presidentName}
                onChange={e => setPresidentName(e.target.value)}
                placeholder="会長名を入力"
              />
            </div>
          </div>

          <div style={{ ...gridStyle, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>大会名</label>
              <input style={readOnlyStyle} value={String(data.tournament.name ?? '')} readOnly />
            </div>
            <div>
              <label style={labelStyle}>大会開催日</label>
              <input style={readOnlyStyle} value={data.tournament.day1_date ? String(data.tournament.day1_date).slice(0, 10) : ''} readOnly />
            </div>
            <div>
              <label style={labelStyle}>大会会場名</label>
              <input style={readOnlyStyle} value={String(data.tournament.venue ?? '')} readOnly />
            </div>
            <div>
              <label style={labelStyle}>使用クレー名</label>
              <input style={readOnlyStyle} value={String(data.tournament.clay_name ?? '')} readOnly />
            </div>
            <div>
              <label style={labelStyle}>ルール</label>
              <input style={readOnlyStyle} value={ruleText} readOnly />
            </div>
            <div>
              <label style={labelStyle}>種目</label>
              <input style={readOnlyStyle} value={eventText} readOnly />
            </div>
            <div>
              <label style={labelStyle}>クラス</label>
              <input style={readOnlyStyle} value={data.classDivisionText} readOnly />
            </div>
            <div>
              <label style={labelStyle}>審査委員名</label>
              <input style={readOnlyStyle} value={String(data.tournament.chief_judge ?? '')} readOnly />
            </div>
            <div>
              <label style={labelStyle}>記録責任者名</label>
              <input style={readOnlyStyle} value={String(data.tournament.record_manager ?? '')} readOnly />
            </div>
            <div>
              <label style={labelStyle}>セット責任者名</label>
              <input style={readOnlyStyle} value={String(data.tournament.set_checker ?? '')} readOnly />
            </div>
          </div>
        </div>

        {/* 参加人数 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>参加人数（自動集計）</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 500, fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.gold}` }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: C.muted }}></th>
                  {hasTraps && <th style={{ padding: '8px 12px', textAlign: 'right', color: C.gold }}>トラップ</th>}
                  {hasSkeet && <th style={{ padding: '8px 12px', textAlign: 'right', color: C.blue2 }}>スキート</th>}
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: C.text, fontWeight: 700 }}>合計</th>
                </tr>
              </thead>
              <tbody>
                {(['AA', 'A', 'B', 'C', 'none'] as const).map(cls => {
                  const trapN = data.trapCounts[cls] ?? 0;
                  const skeetN = data.skeetCounts[cls] ?? 0;
                  const totalN = trapN + skeetN;
                  if (totalN === 0 && cls === 'AA') return null; // AAは使わない場合非表示
                  return (
                    <tr key={cls} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '6px 12px', color: C.text }}>
                        {cls === 'none' ? 'なし' : `${cls}クラス`}
                      </td>
                      {hasTraps && <td style={{ padding: '6px 12px', textAlign: 'right', color: C.text }}>{trapN} 名</td>}
                      {hasSkeet && <td style={{ padding: '6px 12px', textAlign: 'right', color: C.text }}>{skeetN} 名</td>}
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: C.text, fontWeight: 600 }}>{totalN} 名</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: `2px solid ${C.gold}` }}>
                  <td style={{ padding: '8px 12px', color: C.gold, fontWeight: 700 }}>合計</td>
                  {hasTraps && <td style={{ padding: '8px 12px', textAlign: 'right', color: C.gold, fontWeight: 700 }}>{data.trapCounts.total} 名</td>}
                  {hasSkeet && <td style={{ padding: '8px 12px', textAlign: 'right', color: C.gold, fontWeight: 700 }}>{data.skeetCounts.total} 名</td>}
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: C.gold, fontWeight: 700 }}>{totalParticipants} 名</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 奨励金獲得者 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            奨励金獲得者リスト
            {data.incentivesAreAuto && (
              <span style={{ fontSize: 12, fontWeight: 400, color: C.muted, marginLeft: 8 }}>
                ※ スコアから自動検出。追加・修正可能。
              </span>
            )}
          </div>

          {incentives.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.gold}` }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', color: C.muted, width: 30 }}>No</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: C.muted }}>種目</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', color: C.muted }}>種別</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: C.muted }}>氏名</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: C.muted }}>会員番号</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: C.muted }}>所属</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: C.muted }}>金額</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', color: C.muted, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {incentives.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: C.muted }}>{idx + 1}</td>
                      <td style={{ padding: '4px 4px' }}>
                        <select
                          value={row.event_type}
                          onChange={e => updateIncentive(idx, 'event_type', e.target.value)}
                          style={{ ...inputStyle, width: 100, fontSize: 13, padding: '4px 6px' }}
                        >
                          <option value="trap">トラップ</option>
                          <option value="skeet">スキート</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select
                          value={row.straight_type}
                          onChange={e => updateIncentive(idx, 'straight_type', Number(e.target.value))}
                          style={{ ...inputStyle, width: 70, fontSize: 13, padding: '4px 6px', textAlign: 'center' }}
                        >
                          <option value={50}>50</option>
                          <option value={75}>75</option>
                          <option value={100}>100</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input
                          value={row.player_name}
                          onChange={e => updateIncentive(idx, 'player_name', e.target.value)}
                          style={{ ...inputStyle, fontSize: 13, padding: '4px 6px', minWidth: 80 }}
                        />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input
                          value={row.member_code}
                          onChange={e => updateIncentive(idx, 'member_code', e.target.value)}
                          style={{ ...inputStyle, fontSize: 13, padding: '4px 6px', width: 80 }}
                        />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input
                          value={row.belong}
                          onChange={e => updateIncentive(idx, 'belong', e.target.value)}
                          style={{ ...inputStyle, fontSize: 13, padding: '4px 6px', minWidth: 70 }}
                        />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: C.text, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {row.amount.toLocaleString()} 円
                      </td>
                      <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeIncentive(idx)}
                          style={{
                            background: 'transparent', border: 'none', color: C.red,
                            fontSize: 16, cursor: 'pointer', padding: '2px 6px',
                          }}
                          title="削除"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {incentives.length === 0 && (
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>該当者なし</p>
          )}

          <button
            onClick={addIncentive}
            style={{
              background: C.surface2, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '6px 16px', fontSize: 13, cursor: 'pointer',
            }}
          >
            ＋ 追加
          </button>
        </div>

        {/* 本部納入金 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>本部納入金</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600 }}>

            {/* ① 公認料 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 13, minWidth: 200 }}>① 公式大会公認料</span>
              <input
                type="number"
                value={certFee}
                onChange={e => setCertFee(Number(e.target.value) || 0)}
                style={{ ...inputStyle, width: 120, textAlign: 'right' }}
              />
              <span style={{ color: C.muted, fontSize: 13 }}>円</span>
            </div>

            {/* ② 広告代 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 13, minWidth: 200 }}>② 射撃場広告代</span>
              <input
                type="number"
                value={adFee}
                onChange={e => setAdFee(Number(e.target.value) || 0)}
                style={{ ...inputStyle, width: 120, textAlign: 'right' }}
              />
              <span style={{ color: C.muted, fontSize: 13 }}>円</span>
            </div>

            <div style={{ borderBottom: `1px solid ${C.border}`, margin: '4px 0' }} />

            {/* ③ 合計 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, minWidth: 200, fontWeight: 600 }}>③ 合計（①+②）</span>
              <span style={{ color: C.text, fontSize: 14, fontWeight: 600, minWidth: 120, textAlign: 'right', display: 'inline-block' }}>
                {feeTotal.toLocaleString()}
              </span>
              <span style={{ color: C.muted, fontSize: 13 }}>円</span>
            </div>

            <div style={{ borderBottom: `1px solid ${C.border}`, margin: '4px 0' }} />

            {/* ④ 奨励金納付 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 13, minWidth: 200 }}>④ 奨励金に伴う納付金</span>
              <span style={{ color: C.text, fontSize: 14, minWidth: 120, textAlign: 'right', display: 'inline-block' }}>
                {incentiveFee.toLocaleString()}
              </span>
              <span style={{ color: C.muted, fontSize: 12 }}>（@1,000 × {totalParticipants}名）</span>
            </div>

            {/* ⑤ 参加料納付 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 13, minWidth: 200 }}>⑤ 参加料に伴う納付金</span>
              <span style={{ color: C.text, fontSize: 14, minWidth: 120, textAlign: 'right', display: 'inline-block' }}>
                {participationFee.toLocaleString()}
              </span>
              <span style={{ color: C.muted, fontSize: 12 }}>（@1,000 × {totalParticipants}名）</span>
            </div>

            {/* ⑥ 奨励金支払合計 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.muted, fontSize: 13, minWidth: 200 }}>⑥ 奨励金獲得者へ支払合計</span>
              <span style={{ color: C.text, fontSize: 14, minWidth: 120, textAlign: 'right', display: 'inline-block' }}>
                {incentivePayTotal.toLocaleString()}
              </span>
              <span style={{ color: C.muted, fontSize: 12 }}>（{incentivePayCount}名分）</span>
            </div>

            <div style={{ borderBottom: `1px solid ${C.border}`, margin: '4px 0' }} />

            {/* ⑦ 差引 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, minWidth: 200, fontWeight: 600 }}>⑦ 差引本部納付金額</span>
              <span style={{ color: C.text, fontSize: 14, fontWeight: 600, minWidth: 120, textAlign: 'right', display: 'inline-block' }}>
                {netFee.toLocaleString()}
              </span>
              <span style={{ color: C.muted, fontSize: 12 }}>（(④+⑤)−⑥）</span>
            </div>

            {/* ⑧ 本部合計 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${C.gold}11`, padding: '8px 12px', borderRadius: 6, marginTop: 4 }}>
              <span style={{ color: C.gold, fontSize: 14, minWidth: 200, fontWeight: 700 }}>⑧ 本部納入合計金額</span>
              <span style={{ color: C.gold, fontSize: 16, fontWeight: 700, minWidth: 120, textAlign: 'right', display: 'inline-block' }}>
                {grandTotal.toLocaleString()}
              </span>
              <span style={{ color: C.gold, fontSize: 13 }}>円</span>
            </div>
          </div>
        </div>

        {/* 摘要 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>摘要</div>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="備考・摘要を入力..."
          />
        </div>

        {/* エラー / 成功メッセージ */}
        {error && <div style={{ color: C.red, fontSize: 14, marginBottom: 12 }}>⚠ {error}</div>}
        {success && <div style={{ color: '#2ecc71', fontSize: 14, marginBottom: 12 }}>保存しました</div>}

        {/* ボタン行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 32px', fontSize: 15, fontWeight: 700,
              color: '#fff', background: saving ? C.muted : C.gold,
              border: 'none', borderRadius: 8,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => setShowExcelDialog(true)}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 700,
              color: C.text, background: C.surface2,
              border: `1px solid ${C.gold}`, borderRadius: 8, cursor: 'pointer',
            }}
          >
            大会報告書 Excel
          </button>
        </div>
      </div>

      {/* Excel ダイアログ */}
      {showExcelDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '28px 24px', width: 400, maxWidth: '95vw',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: C.gold }}>
              大会報告書 Excel出力
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              ※ 保存済みのデータでExcelを出力します。先に「保存」してからダウンロードしてください。
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleExcelDownload}
                disabled={generating}
                style={{
                  padding: '10px 28px', fontSize: 16, fontWeight: 700,
                  color: '#000', background: generating ? C.muted : C.gold,
                  border: 'none', borderRadius: 8,
                  cursor: generating ? 'default' : 'pointer',
                  opacity: generating ? 0.5 : 1,
                }}
              >
                {generating ? 'ダウンロード中...' : 'ダウンロード'}
              </button>
              <button
                onClick={() => setShowExcelDialog(false)}
                style={{
                  padding: '10px 28px', fontSize: 16, fontWeight: 600,
                  color: C.muted, background: 'transparent',
                  border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer',
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
