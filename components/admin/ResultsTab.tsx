'use client';

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/colors';
import type { Result, Tournament, ClassType } from '@/lib/types';

interface Props {
  tournamentId: number;
}

export default function ResultsTab({ tournamentId }: Props) {
  const [results, setResults] = useState<Result[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [has2ndDay, setHas2ndDay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<'all' | ClassType>('all');
  const [belongFilter, setBelongFilter] = useState<'all' | string>('all');
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);

  // 手動順位モーダル
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [dndItems, setDndItems] = useState<Result[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [savingRank, setSavingRank] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tournaments/${tournamentId}/results`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResults(json.data.results);
      setTournament(json.data.tournament);
      setHas2ndDay(json.data.has2ndDay);
    } catch (e) {
      setError(e instanceof Error ? e.message : '成績の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const belongs = Array.from(new Set(results.map(r => r.belong).filter(Boolean))).sort() as string[];
  const existingClasses = (['AA', 'A', 'B', 'C'] as ClassType[]).filter(c => results.some(r => r.class === c));

  const filtered = results.filter(r => {
    if (classFilter !== 'all' && r.class !== classFilter) return false;
    if (belongFilter !== 'all' && r.belong !== belongFilter) return false;
    return true;
  });

  // 有効選手のみで統計計算
  const validScores = filtered
    .filter(r => r.status === 'valid' || !r.status)
    .map(r => r.total).filter(v => v > 0);
  const overallAvg = validScores.length > 0
    ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2) : '-';
  const top6 = [...validScores].sort((a, b) => b - a).slice(0, 6);
  const top6Avg = top6.length > 0
    ? (top6.reduce((a, b) => a + b, 0) / top6.length).toFixed(2) : '-';

  // CB/FR 列表示フラグ
  const hasCB = results.some(r => r.cb !== null && r.cb !== undefined);
  const hasFR = results.some(r => r.fr !== null && r.fr !== undefined);

  // 手動順位設定中フラグ
  const hasManualRank = results.some(r => r.manual_rank !== null && r.manual_rank !== undefined);

  function handleRowClick(code: string) {
    setHighlightedCode(prev => prev === code ? null : code);
  }

  // ---- 手動順位モーダル ----
  function openManualModal() {
    // 有効選手のみ DnD リストに（API からの順序 = 現在の rank 順）
    const valid = results.filter(r => r.status === 'valid' || !r.status);
    setDndItems(valid);
    setRankError(null);
    setManualModalOpen(true);
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...dndItems];
    const [removed] = next.splice(dragIdx, 1);
    next.splice(idx, 0, removed);
    setDndItems(next);
    setDragIdx(idx);
  }

  function handleDrop() {
    setDragIdx(null);
  }

  async function saveManualRank() {
    setSavingRank(true);
    setRankError(null);
    try {
      // 有効選手に連番、失格・棄権は null
      const rankings = [
        ...dndItems.map((r, i) => ({ member_code: r.member_code, manual_rank: i + 1 })),
        ...results
          .filter(r => r.status === 'disqualified' || r.status === 'withdrawn')
          .map(r => ({ member_code: r.member_code, manual_rank: null })),
      ];
      const res = await fetch(`/api/tournaments/${tournamentId}/scores/ranking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankings }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setManualModalOpen(false);
      await fetchResults();
    } catch (e) {
      setRankError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSavingRank(false);
    }
  }

  async function resetToAutoRank() {
    setSavingRank(true);
    setRankError(null);
    try {
      const rankings = results.map(r => ({ member_code: r.member_code, manual_rank: null }));
      const res = await fetch(`/api/tournaments/${tournamentId}/scores/ranking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankings }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setManualModalOpen(false);
      await fetchResults();
    } catch (e) {
      setRankError(e instanceof Error ? e.message : 'リセットに失敗しました');
    } finally {
      setSavingRank(false);
    }
  }

  // DQ/withdrawn リスト（モーダル下部表示用）
  const dqItems = results.filter(r => r.status === 'disqualified' || r.status === 'withdrawn');

  const scoreCell = (val: number | null): React.ReactNode => {
    if (val === null) return <span style={{ color: C.muted }}>-</span>;
    return (
      <span style={{ color: val >= 23 ? '#e74c3c' : C.text, fontWeight: val >= 23 ? 700 : 400 }}>
        {val}
      </span>
    );
  };

  return (
    <div style={{ padding: '0 16px', maxWidth: 1200, margin: '0 auto', maxHeight: 'calc(100vh - 110px)', overflow: 'auto' }}>

      {/* 手動順位モーダル */}
      {manualModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 16,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: 28, width: '100%', maxWidth: 520,
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* モーダルヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: C.gold, fontWeight: 700 }}>成績順位手動設定</h2>
              <button
                onClick={() => setManualModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              ドラッグして順位を並び替えてください。並べた順番に 1位・2位・3位… と連番で確定されます。
            </p>

            {/* DnD リスト */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              {dndItems.map((r, i) => (
                <div
                  key={r.member_code}
                  draggable
                  onDragStart={e => handleDragStart(e, i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={handleDrop}
                  onDragEnd={handleDrop}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', marginBottom: 6,
                    background: dragIdx === i ? `${C.gold}22` : C.surface2,
                    border: `1px solid ${dragIdx === i ? C.gold : C.border}`,
                    borderRadius: 8,
                    cursor: 'grab',
                    opacity: dragIdx === i ? 0.6 : 1,
                    transition: 'background 0.1s, border-color 0.1s',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ color: C.muted, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>≡</span>
                  <span style={{
                    color: C.gold, fontWeight: 700, fontSize: 17,
                    minWidth: 32, textAlign: 'right', flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ color: C.text, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.name}
                    {r.is_judge ? <span style={{ color: C.gold, marginLeft: 4 }}>⚑</span> : ''}
                  </span>
                  <span style={{ color: C.muted, fontSize: 13, flexShrink: 0 }}>{r.belong ?? ''}</span>
                  <span style={{ color: C.gold, fontWeight: 700, fontSize: 15, minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
                    {r.total}
                  </span>
                </div>
              ))}

              {/* 失格・棄権（ドラッグ不可・最下部固定） */}
              {dqItems.length > 0 && (
                <>
                  {dndItems.length > 0 && (
                    <div style={{ borderTop: `1px dashed ${C.border}`, margin: '10px 0 8px', opacity: 0.4 }} />
                  )}
                  {dqItems.map(r => (
                    <div
                      key={r.member_code}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 14px', marginBottom: 6,
                        background: '#e74c3c08',
                        border: `1px solid ${C.border}33`,
                        borderRadius: 8, opacity: 0.55,
                      }}
                    >
                      <span style={{ color: '#e74c3c', fontWeight: 700, fontSize: 13, minWidth: 32, textAlign: 'right' }}>―</span>
                      <span style={{ color: '#e74c3c', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.name}
                        <span style={{ fontSize: 12, marginLeft: 6 }}>
                          {r.status === 'disqualified' ? '失格' : '棄権'}
                        </span>
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* エラー */}
            {rankError && (
              <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 6, padding: '8px 12px', marginTop: 12, fontSize: 13 }}>
                ⚠ {rankError}
              </div>
            )}

            {/* ボタン */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button
                onClick={saveManualRank}
                disabled={savingRank}
                style={{
                  flex: 1, background: C.gold, color: '#000', border: 'none',
                  borderRadius: 6, padding: '11px', fontSize: 15, fontWeight: 700,
                  cursor: savingRank ? 'not-allowed' : 'pointer', opacity: savingRank ? 0.7 : 1,
                  minWidth: 120,
                }}
              >
                {savingRank ? '保存中...' : '保存する'}
              </button>
              <button
                onClick={resetToAutoRank}
                disabled={savingRank}
                style={{
                  background: 'transparent', color: '#e67e22',
                  border: '1px solid #e67e22', borderRadius: 6,
                  padding: '11px 14px', fontSize: 13, cursor: savingRank ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                自動計算に戻す
              </button>
              <button
                onClick={() => setManualModalOpen(false)}
                disabled={savingRank}
                style={{
                  background: 'transparent', color: C.muted,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: '11px 14px', fontSize: 14, cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>成績一覧</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasManualRank && (
            <span style={{
              background: '#e67e2222', color: '#e67e22',
              border: '1px solid #e67e22', borderRadius: 20,
              padding: '3px 12px', fontSize: 12, fontWeight: 700,
            }}>
              手動設定中
            </span>
          )}
          <button
            onClick={openManualModal}
            style={{
              background: C.surface2, color: C.text,
              border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 14px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            成績順位手動設定
          </button>
          <button
            onClick={fetchResults}
            style={{
              background: C.surface2, color: C.gold,
              border: `1px solid ${C.gold}`, borderRadius: 6,
              padding: '6px 14px', fontSize: 15, cursor: 'pointer', fontWeight: 600,
            }}
          >
            ↺ 更新
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 15,
        }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>読み込み中...</div>
      ) : (
        <>
          {/* Filter Bar */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: C.muted }}>クラス:</span>
              {(['all', ...existingClasses] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setClassFilter(c as 'all' | ClassType)}
                  style={{
                    background: classFilter === c ? classBadgeBg(c as 'all' | ClassType) : 'transparent',
                    color: classFilter === c ? classBadgeColor(c as 'all' | ClassType) : C.muted,
                    border: `1px solid ${classFilter === c ? classBadgeColor(c as 'all' | ClassType) : C.border}`,
                    borderRadius: 4, padding: '3px 10px', fontSize: 14,
                    fontWeight: classFilter === c ? 700 : 400, cursor: 'pointer',
                  }}
                >
                  {c === 'all' ? '全て' : c}
                </button>
              ))}
            </div>
            {belongs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: C.muted }}>所属協会:</span>
                <select
                  value={belongFilter}
                  onChange={e => setBelongFilter(e.target.value)}
                  style={{
                    background: C.inputBg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.text,
                    padding: '5px 10px',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">全て</option>
                  {belongs.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: 13, color: C.muted }}>全体平均</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{overallAvg}</span>
            </div>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: 13, color: C.muted }}>上位6名平均</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>{top6Avg}</span>
            </div>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: 13, color: C.muted }}>表示件数</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{filtered.length}名</span>
            </div>
          </div>

          {/* CB/FR 凡例 */}
          {(hasCB || hasFR) && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '8px 14px', marginBottom: 12,
              display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: C.muted,
            }}>
              {hasCB && <span><span style={{ color: '#e67e22', fontWeight: 700 }}>CB</span>: カウントバック（小さい数字が上位）</span>}
              {hasFR && <span><span style={{ color: '#9b59b6', fontWeight: 700 }}>FR</span>: ファイナルシュートオフ（大きい数字が上位）</span>}
            </div>
          )}

          {/* Results Table */}
          {filtered.length === 0 ? (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '40px 24px', textAlign: 'center', color: C.muted,
            }}>
              成績データがありません
            </div>
          ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: has2ndDay ? 820 : 600, background: C.surface }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: C.surface2 }}>
                      <th style={{ ...thS, background: C.surface2 }}>順位</th>
                      <th style={{ ...thS, textAlign: 'left', position: 'sticky', left: 0, zIndex: 11, background: C.surface2 }}>氏名</th>
                      <th style={{ ...thS, background: C.surface2 }}>組</th>
                      <th style={{ ...thS, textAlign: 'left', background: C.surface2 }}>所属協会</th>
                      <th style={{ ...thS, background: C.surface2 }}>クラス</th>
                      <th style={{ ...thS, background: C.surface2 }}>R1</th>
                      <th style={{ ...thS, background: C.surface2 }}>R2</th>
                      <th style={{ ...thS, background: C.surface2 }}>R3</th>
                      <th style={{ ...thS, background: C.surface2 }}>R4</th>
                      <th style={{ ...thS, background: C.surface2 }}>1日計</th>
                      {has2ndDay && <>
                        <th style={{ ...thS, color: C.blue2, background: C.surface2 }}>R5</th>
                        <th style={{ ...thS, color: C.blue2, background: C.surface2 }}>R6</th>
                        <th style={{ ...thS, color: C.blue2, background: C.surface2 }}>R7</th>
                        <th style={{ ...thS, color: C.blue2, background: C.surface2 }}>R8</th>
                        <th style={{ ...thS, color: C.blue2, background: C.surface2 }}>2日計</th>
                      </>}
                      <th style={{ ...thS, color: C.gold, background: C.surface2 }}>合計</th>
                      <th style={{ ...thS, background: C.surface2 }}>平均</th>
                      {hasCB && <th style={{ ...thS, color: '#e67e22', background: C.surface2 }}>CB</th>}
                      {hasFR && <th style={{ ...thS, color: '#9b59b6', background: C.surface2 }}>FR</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const isHighlighted = highlightedCode === r.member_code;
                      const isDQ = r.status === 'disqualified' || r.status === 'withdrawn';

                      return (
                        <tr
                          key={r.member_code}
                          onClick={() => handleRowClick(r.member_code)}
                          style={{
                            borderBottom: `1px solid ${C.border}33`,
                            background: isDQ
                              ? '#e74c3c0a'
                              : isHighlighted ? `${C.green}22` : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                        >
                          {/* 順位 */}
                          <td style={{
                            ...tdS,
                            color: r.rank && r.rank <= 3 ? C.gold : C.muted,
                            fontWeight: r.rank && r.rank <= 3 ? 700 : 400,
                          }}>
                            {r.rank ?? ''}
                          </td>

                          {/* 氏名 */}
                          <td style={{ ...tdS, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: isDQ ? '#1a1d24' : isHighlighted ? '#27ae6036' : C.surface }}>
                            <span style={{ color: isDQ ? '#e74c3c' : C.text, fontWeight: 500 }}>{r.name}</span>
                            {r.status === 'disqualified' && (
                              <span style={{ color: '#e74c3c', fontSize: 12, marginLeft: 6, fontWeight: 700 }}>失格</span>
                            )}
                            {r.status === 'withdrawn' && (
                              <span style={{ color: '#e74c3c', fontSize: 12, marginLeft: 6, fontWeight: 700 }}>棄権</span>
                            )}
                            {r.is_judge ? <span style={{ color: C.gold }}> ⚑</span> : ''}
                          </td>

                          <td style={{ ...tdS, color: C.muted, fontSize: 14 }}>
                            {r.group1}{r.group2 ? `/${r.group2}` : ''}組
                          </td>
                          <td style={{ ...tdS, textAlign: 'left', color: C.muted, fontSize: 14 }}>{r.belong ?? '-'}</td>
                          <td style={{ ...tdS }}>
                            {r.class ? (
                              <span style={{
                                background: classBadgeBg(r.class),
                                color: classBadgeColor(r.class),
                                borderRadius: 4, padding: '1px 7px', fontSize: 13, fontWeight: 700,
                              }}>{r.class}</span>
                            ) : '-'}
                          </td>
                          <td style={tdS}>{scoreCell(r.r1)}</td>
                          <td style={tdS}>{scoreCell(r.r2)}</td>
                          <td style={tdS}>{scoreCell(r.r3)}</td>
                          <td style={tdS}>{scoreCell(r.r4)}</td>
                          <td style={{ ...tdS, fontWeight: 600, color: C.text }}>{r.day1_total || '-'}</td>
                          {has2ndDay && <>
                            <td style={tdS}>{scoreCell(r.r5)}</td>
                            <td style={tdS}>{scoreCell(r.r6)}</td>
                            <td style={tdS}>{scoreCell(r.r7)}</td>
                            <td style={tdS}>{scoreCell(r.r8)}</td>
                            <td style={{ ...tdS, fontWeight: 600, color: C.blue2 }}>{r.day2_total || '-'}</td>
                          </>}
                          <td style={{ ...tdS, fontWeight: 700, color: isDQ ? C.muted : C.gold, fontSize: 16 }}>
                            {isDQ ? '-' : (r.total || '-')}
                          </td>
                          <td style={{ ...tdS, color: C.muted }}>
                            {!isDQ && r.average !== null && r.average !== undefined
                              ? Number(r.average).toFixed(2) : '-'}
                          </td>
                          {hasCB && (
                            <td style={{ ...tdS, color: r.cb ? '#e67e22' : C.muted, fontWeight: r.cb ? 700 : 400 }}>
                              {r.cb ?? '-'}
                            </td>
                          )}
                          {hasFR && (
                            <td style={{ ...tdS, color: r.fr ? '#9b59b6' : C.muted, fontWeight: r.fr ? 700 : 400 }}>
                              {r.fr ?? '-'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
          )}

          {highlightedCode && (
            <p style={{ fontSize: 14, color: C.muted, marginTop: 8, textAlign: 'center' }}>
              行をクリックしてハイライトを解除できます
            </p>
          )}
        </>
      )}
    </div>
  );
}

const thS: React.CSSProperties = {
  padding: '8px 8px', fontSize: 14, color: C.muted, fontWeight: 600,
  textAlign: 'center', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};

const tdS: React.CSSProperties = {
  padding: '7px 8px', fontSize: 15, textAlign: 'center', whiteSpace: 'nowrap',
};

function classBadgeBg(c: ClassType | 'all'): string {
  if (c === 'all') return `${C.gold}22`;
  return { AA: '#e74c3c33', A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133' }[c] ?? '';
}

function classBadgeColor(c: ClassType | 'all'): string {
  if (c === 'all') return C.gold;
  return { AA: '#e74c3c', A: C.gold, B: '#3498db', C: '#2ecc71' }[c] ?? C.muted;
}
