'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { C } from '@/lib/colors';
import type { Result, Tournament, ClassType } from '@/lib/types';
import ViewerLoginForm from './ViewerLoginForm';
import LoadingOverlay from '@/components/LoadingOverlay';
import Footer from '@/components/Footer';

interface Props {
  tournamentId: number;
}

export default function ViewerPage({ tournamentId }: Props) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginBelong, setLoginBelong] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [has2ndDay, setHas2ndDay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<'all' | ClassType>('all');
  const [belongFilter, setBelongFilter] = useState<'all' | string>('all');
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterOpen, setFilterOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  // プルリフレッシュ後もログイン状態を維持（sessionStorageで保存）
  useEffect(() => {
    const key = `viewer_session_${tournamentId}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as { name?: string; belong?: string };
        setLoginName(parsed.name ?? '');
        setLoginBelong(parsed.belong ?? '');
        setLoggedIn(true);
      }
    } catch {
      sessionStorage.removeItem(key);
    }
  }, [tournamentId]);

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
      setLastUpdated(json.data.lastScoreUpdated ? new Date(json.data.lastScoreUpdated) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '成績の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchResults();
    setOrigin(window.location.origin);
  }, [fetchResults]);

  // ログイン選手の行を自動ハイライト
  useEffect(() => {
    if (!loggedIn || results.length === 0 || !loginName) return;
    const normalize = (s: string) => s.replace(/[\s\u3000]/g, '');
    const normLogin = normalize(loginName);
    const match = results.find(r => {
      const normName = normalize(r.name ?? '');
      const nameMatch = normName.includes(normLogin) || normLogin.includes(normName);
      if (!nameMatch) return false;
      if (loginBelong && r.belong !== loginBelong) return false;
      return true;
    });
    if (match) setHighlightedCode(match.member_code);
  }, [loggedIn, results, loginName, loginBelong]);

  // ハイライト行へ自動スクロール
  useEffect(() => {
    if (highlightedCode && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedCode]);

  function handleHiddenClick() {
    const pw = window.prompt('パスワードを入力してください');
    if (pw === 'repros') {
      router.push(`/admin/${tournamentId}`);
    }
  }

  async function handleCopyUrl() {
    const url = `${window.location.origin}/viewer/${tournamentId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('URLをコピーしてください:', url);
    }
  }

  const belongs = Array.from(new Set(results.map(r => r.belong).filter(Boolean))).sort() as string[];
  const existingClasses = (['AA', 'A', 'B', 'C'] as ClassType[]).filter(c => results.some(r => r.class === c));

  const filtered = results.filter(r => {
    if (classFilter !== 'all' && r.class !== classFilter) return false;
    if (belongFilter !== 'all' && r.belong !== belongFilter) return false;
    return true;
  });

  // 点数登録済み→合計降順（上部）、未登録→組・番号順（下部）
  const sortedFiltered = (() => {
    const withScore = filtered.filter(r => r.total > 0);
    const noScore = filtered.filter(r => !r.total);
    withScore.sort((a, b) => b.total - a.total);
    noScore.sort((a, b) => a.group1 !== b.group1 ? a.group1 - b.group1 : a.position - b.position);
    return [...withScore, ...noScore];
  })();

  const totalScores = filtered.map(r => r.total).filter(v => v > 0);
  const overallAvg = totalScores.length > 0
    ? (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(2)
    : '-';
  const top6 = [...totalScores].sort((a, b) => b - a).slice(0, 6);
  const top6Avg = top6.length > 0
    ? (top6.reduce((a, b) => a + b, 0) / top6.length).toFixed(2)
    : '-';

  const scoreCell = (val: number | null): React.ReactNode => {
    if (val === null) return <span style={{ color: C.muted }}>-</span>;
    return (
      <span style={{ color: val >= 23 ? '#e74c3c' : C.text, fontWeight: val >= 23 ? 700 : 400 }}>
        {val}
      </span>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
  };

  // ログイン前はログインフォームを表示
  if (!loggedIn) {
    return (
      <ViewerLoginForm
        tournamentId={tournamentId}
        tournamentName={tournament?.name ?? ''}
        tournamentDay1Date={tournament?.day1_date}
        tournamentDay2Date={tournament?.day2_date}
        onLoginSuccess={(name, belong) => {
          sessionStorage.setItem(`viewer_session_${tournamentId}`, JSON.stringify({ name, belong }));
          setLoginName(name);
          setLoginBelong(belong);
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif', position: 'relative' }}>
      <LoadingOverlay show={loading} message="読み込み中..." />
      {/* Header / Banner */}
      <header style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surface2} 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: '20px 20px 16px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              {tournament ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.gold }}>
                      {tournament.name}
                    </h1>
                    <span style={{
                      background: tournament.event_type === 'trap' ? `${C.gold}33` : `${C.blue2}33`,
                      color: tournament.event_type === 'trap' ? C.gold : C.blue2,
                      border: `1px solid ${tournament.event_type === 'trap' ? C.gold : C.blue2}`,
                      borderRadius: 4, padding: '2px 8px', fontSize: 13, fontWeight: 600,
                    }}>
                      {tournament.event_type === 'trap' ? 'トラップ' : 'スキート'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 15, color: '#ffffff' }}>
                    {tournament.venue && <span>📍 {tournament.venue}</span>}
                    {tournament.day1_date && <span>📅 {formatDate(tournament.day1_date)}</span>}
                    {tournament.day2_date && <span>〜 {formatDate(tournament.day2_date)}</span>}
                  </div>
                </>
              ) : loading ? (
                <span style={{ color: C.muted }}>読み込み中...</span>
              ) : (
                <span style={{ color: C.red }}>大会情報の取得に失敗しました</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tournament && (
                <button
                  onClick={() => setShowQrModal(true)}
                  style={{
                    background: C.surface2,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontSize: 15,
                    cursor: 'pointer',
                  }}
                >
                  閲覧用QRコード表示
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={fetchResults}
                  style={{
                    background: C.surface2,
                    color: C.gold,
                    border: `1px solid ${C.gold}`,
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontSize: 15,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ↺ 更新
                </button>
                {lastUpdated && (
                  <span style={{ fontSize: 12, color: C.muted }}>
                    最終更新: {lastUpdated.getHours().toString().padStart(2, '0')}:{lastUpdated.getMinutes().toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              <a
                href="/manual/viewer/scores.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: C.muted,
                  fontSize: 18,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                title="マニュアル"
              >
                ℹ️
              </a>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', maxHeight: 'calc(100vh - 70px)', overflow: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
        {/* Error */}
        {error && (
          <div style={{
            background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 15,
          }}>{error}</div>
        )}

        {!loading && (
          <>
            {/* Filter & Stats Toggle */}
            <button
              onClick={() => setFilterOpen(v => !v)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '10px 16px', marginTop: 20, marginBottom: filterOpen ? 0 : 16,
                width: '100%', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottomLeftRadius: filterOpen ? 0 : 8,
                borderBottomRightRadius: filterOpen ? 0 : 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
                {filterOpen ? '▲' : '▼'} フィルター・集計
              </span>
              {!filterOpen && (classFilter !== 'all' || belongFilter !== 'all') && (
                <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>
                  フィルター適用中
                </span>
              )}
            </button>

            {filterOpen && (
              <>
                {/* Filter Bar */}
                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
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
              </>
            )}

            {/* Results Table */}
            {filtered.length === 0 ? (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '48px 24px', textAlign: 'center', color: C.muted,
              }}>
                成績データがありません
              </div>
            ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: has2ndDay ? 780 : 560, background: C.surface }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ background: C.surface2 }}>
                        <th style={{ ...thS, position: 'sticky', left: 0, zIndex: 11, background: C.surface2 }}>順位</th>
                        <th style={{ ...thS, textAlign: 'left', position: 'sticky', left: 44, zIndex: 11, background: C.surface2 }}>氏名　審判フラグ</th>
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
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFiltered.map(r => {
                        const isHighlighted = highlightedCode === r.member_code;
                        return (
                          <tr
                            key={r.member_code}
                            ref={isHighlighted ? highlightedRowRef : undefined}
                            onClick={() => setHighlightedCode(prev => prev === r.member_code ? null : r.member_code)}
                            style={{
                              borderBottom: `1px solid ${C.border}33`,
                              background: isHighlighted ? '#2a2518' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                            }}
                          >
                            <td style={{ ...tdS, color: r.rank && r.rank <= 3 ? C.gold : C.muted, fontWeight: r.rank && r.rank <= 3 ? 700 : 400, position: 'sticky', left: 0, zIndex: 1, background: isHighlighted ? '#2a2518' : C.surface }}>
                              {r.rank ?? ''}
                            </td>
                            <td style={{ ...tdS, textAlign: 'left', color: C.text, fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', left: 44, zIndex: 1, background: isHighlighted ? '#2a2518' : C.surface }}>
                              {r.name}{r.is_judge ? <span style={{ color: C.gold }}> ⚑</span> : ''}
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
            )}
          </>
        )}
        <Footer />
      </main>

      {/* Hidden admin button (bottom-left, 32x32px transparent) */}
      <button
        onClick={handleHiddenClick}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: 32,
          height: 32,
          background: 'transparent',
          border: 'none',
          cursor: 'default',
          zIndex: 9999,
          opacity: 0,
        }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* QR Modal */}
      {showQrModal && origin && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              maxWidth: 320,
              width: '90%',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, color: C.gold }}>閲覧用QRコード</h3>
            <div style={{ background: '#fff', padding: 10, borderRadius: 8 }}>
              <QRCodeSVG value={`${origin}/viewer/${tournamentId}`} size={200} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.muted, textAlign: 'center', wordBreak: 'break-all' }}>
              {origin}/viewer/{tournamentId}
            </p>
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button
                onClick={handleCopyUrl}
                style={{
                  flex: 1,
                  background: copied ? `${C.green}22` : C.surface2,
                  color: copied ? C.green : C.text,
                  border: `1px solid ${copied ? C.green : C.border}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 15,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {copied ? '✓ コピーしました' : 'URLをコピー'}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  background: 'transparent',
                  color: C.muted,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 15,
                  cursor: 'pointer',
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
  return { AA: '#e74c3c33', A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133' }[c] ?? '';
}

function classBadgeColor(c: ClassType | 'all'): string {
  if (c === 'all') return C.gold;
  return { AA: '#e74c3c', A: C.gold, B: '#3498db', C: '#2ecc71' }[c] ?? C.muted;
}
