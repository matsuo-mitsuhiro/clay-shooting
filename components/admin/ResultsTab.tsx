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

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const belongs = Array.from(new Set(results.map(r => r.belong).filter(Boolean))) as string[];

  const filtered = results.filter(r => {
    if (classFilter !== 'all' && r.class !== classFilter) return false;
    if (belongFilter !== 'all' && r.belong !== belongFilter) return false;
    return true;
  });

  const totalScores = filtered.map(r => r.total).filter(v => v > 0);
  const overallAvg = totalScores.length > 0
    ? (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(2)
    : '-';
  const top6 = totalScores.sort((a, b) => b - a).slice(0, 6);
  const top6Avg = top6.length > 0
    ? (top6.reduce((a, b) => a + b, 0) / top6.length).toFixed(2)
    : '-';

  function handleRowClick(code: string) {
    setHighlightedCode(prev => prev === code ? null : code);
  }

  const scoreCell = (val: number | null): React.ReactNode => {
    if (val === null) return <span style={{ color: C.muted }}>-</span>;
    return (
      <span style={{ color: val >= 23 ? '#e74c3c' : C.text, fontWeight: val >= 23 ? 700 : 400 }}>
        {val}
      </span>
    );
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>成績一覧</h3>
        <button
          onClick={fetchResults}
          style={{
            background: C.surface2,
            color: C.gold,
            border: `1px solid ${C.gold}`,
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 15,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ↺ 更新
        </button>
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: C.muted }}>クラス:</span>
              {(['all', 'A', 'B', 'C', 'D'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  style={{
                    background: classFilter === c ? classBadgeBg(c) : 'transparent',
                    color: classFilter === c ? classBadgeColor(c) : C.muted,
                    border: `1px solid ${classFilter === c ? classBadgeColor(c) : C.border}`,
                    borderRadius: 4, padding: '3px 10px', fontSize: 14,
                    fontWeight: classFilter === c ? 700 : 400, cursor: 'pointer',
                  }}
                >
                  {c === 'all' ? '全て' : c}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: C.muted }}>所属:</span>
              <button
                onClick={() => setBelongFilter('all')}
                style={{
                  background: belongFilter === 'all' ? `${C.gold}22` : 'transparent',
                  color: belongFilter === 'all' ? C.gold : C.muted,
                  border: `1px solid ${belongFilter === 'all' ? C.gold : C.border}`,
                  borderRadius: 4, padding: '3px 10px', fontSize: 14,
                  fontWeight: belongFilter === 'all' ? 700 : 400, cursor: 'pointer',
                }}
              >
                全て
              </button>
              {belongs.map(b => (
                <button
                  key={b}
                  onClick={() => setBelongFilter(b)}
                  style={{
                    background: belongFilter === b ? `${C.gold}22` : 'transparent',
                    color: belongFilter === b ? C.gold : C.muted,
                    border: `1px solid ${belongFilter === b ? C.gold : C.border}`,
                    borderRadius: 4, padding: '3px 10px', fontSize: 14,
                    fontWeight: belongFilter === b ? 700 : 400, cursor: 'pointer',
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
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

          {/* Results Table */}
          {filtered.length === 0 ? (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '40px 24px', textAlign: 'center', color: C.muted,
            }}>
              成績データがありません
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: has2ndDay ? 780 : 560 }}>
                  <thead>
                    <tr style={{ background: C.surface2 }}>
                      <th style={thS}>順位</th>
                      <th style={{ ...thS, textAlign: 'left' }}>氏名</th>
                      <th style={thS}>組</th>
                      <th style={{ ...thS, textAlign: 'left' }}>所属</th>
                      <th style={thS}>クラス</th>
                      <th style={thS}>R1</th>
                      <th style={thS}>R2</th>
                      <th style={thS}>R3</th>
                      <th style={thS}>R4</th>
                      <th style={thS}>1日計</th>
                      {has2ndDay && <>
                        <th style={{ ...thS, color: C.blue2 }}>R5</th>
                        <th style={{ ...thS, color: C.blue2 }}>R6</th>
                        <th style={{ ...thS, color: C.blue2 }}>R7</th>
                        <th style={{ ...thS, color: C.blue2 }}>R8</th>
                        <th style={{ ...thS, color: C.blue2 }}>2日計</th>
                      </>}
                      <th style={{ ...thS, color: C.gold }}>合計</th>
                      <th style={thS}>平均</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const isHighlighted = highlightedCode === r.member_code;
                      return (
                        <tr
                          key={r.member_code}
                          onClick={() => handleRowClick(r.member_code)}
                          style={{
                            borderBottom: `1px solid ${C.border}33`,
                            background: isHighlighted ? `${C.green}22` : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                        >
                          <td style={{ ...tdS, color: r.rank <= 3 ? C.gold : C.muted, fontWeight: r.rank <= 3 ? 700 : 400 }}>
                            {r.rank}
                          </td>
                          <td style={{ ...tdS, textAlign: 'left', color: C.text, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {r.is_judge ? <span style={{ color: C.gold }}>⚑ </span> : ''}
                            {r.name}
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
                          <td style={{ ...tdS, fontWeight: 700, color: C.gold, fontSize: 16 }}>{r.total || '-'}</td>
                          <td style={{ ...tdS, color: C.muted }}>{r.average !== null && r.average !== undefined ? Number(r.average).toFixed(2) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
  padding: '8px 8px',
  fontSize: 14,
  color: C.muted,
  fontWeight: 600,
  textAlign: 'center',
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};

const tdS: React.CSSProperties = {
  padding: '7px 8px',
  fontSize: 15,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

function classBadgeBg(c: ClassType | 'all'): string {
  if (c === 'all') return `${C.gold}22`;
  return { A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133', D: '#9b59b633' }[c];
}

function classBadgeColor(c: ClassType | 'all'): string {
  if (c === 'all') return C.gold;
  return { A: C.gold, B: '#3498db', C: '#2ecc71', D: '#9b59b6' }[c];
}
