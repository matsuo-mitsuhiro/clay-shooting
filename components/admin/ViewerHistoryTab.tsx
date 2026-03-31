'use client';

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/colors';
import type { ViewerLog } from '@/lib/types';
import LoadingOverlay from '@/components/LoadingOverlay';

interface Props {
  tournamentId: number;
}

interface HistoryData {
  logs: ViewerLog[];
  total: number;
  page: number;
  totalPages: number;
  totalLogins: number;
  uniqueUsers: number;
  belongs: string[];
}

export default function ViewerHistoryTab({ tournamentId }: Props) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [belongFilter, setBelongFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page) });
      if (belongFilter) params.set('belong', belongFilter);
      const res = await fetch(`/api/tournaments/${tournamentId}/viewer-logs?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, page, belongFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function formatDate(s: string) {
    const d = new Date(s);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function formatUA(ua: string | null): string {
    if (!ua) return '-';
    if (/iPhone|iPad/.test(ua)) return '📱 iOS';
    if (/Android/.test(ua)) return '📱 Android';
    if (/Mac/.test(ua)) return '💻 Mac';
    if (/Windows/.test(ua)) return '🖥 Windows';
    return ua.slice(0, 30) + '...';
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      <LoadingOverlay show={loading} message="読み込み中..." />

      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>
        閲覧履歴
      </h2>

      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 12,
        }}>{error}</div>
      )}

      {data && (
        <>
          {/* 集計カード */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '12px 20px', textAlign: 'center', minWidth: 120,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>{data.uniqueUsers}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>ユニークユーザー数</div>
            </div>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '12px 20px', textAlign: 'center', minWidth: 120,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{data.totalLogins}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>総ログイン回数</div>
            </div>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '12px 20px', textAlign: 'center', minWidth: 120,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{data.total}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>表示件数</div>
            </div>
          </div>

          {/* 所属フィルタ */}
          {data.belongs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: C.muted }}>所属で絞り込み：</span>
              <button
                onClick={() => { setBelongFilter(''); setPage(1); }}
                style={{
                  background: !belongFilter ? `${C.gold}22` : 'transparent',
                  color: !belongFilter ? C.gold : C.muted,
                  border: `1px solid ${!belongFilter ? C.gold : C.border}`,
                  borderRadius: 4, padding: '3px 10px', fontSize: 13,
                  fontWeight: !belongFilter ? 700 : 400, cursor: 'pointer',
                }}
              >
                全て
              </button>
              {data.belongs.map(b => (
                <button
                  key={b}
                  onClick={() => { setBelongFilter(b); setPage(1); }}
                  style={{
                    background: belongFilter === b ? `${C.gold}22` : 'transparent',
                    color: belongFilter === b ? C.gold : C.muted,
                    border: `1px solid ${belongFilter === b ? C.gold : C.border}`,
                    borderRadius: 4, padding: '3px 10px', fontSize: 13,
                    fontWeight: belongFilter === b ? 700 : 400, cursor: 'pointer',
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* 履歴テーブル */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {['日時', '所属', '入力氏名', '照合氏名', '端末'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', fontSize: 13, color: C.muted,
                        fontWeight: 600, textAlign: 'left',
                        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: C.muted }}>
                        閲覧履歴がありません
                      </td>
                    </tr>
                  ) : (
                    data.logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}33` }}>
                        <td style={{ padding: '7px 12px', fontSize: 14, color: C.muted, whiteSpace: 'nowrap' }}>
                          {formatDate(log.logged_at)}
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 14, color: C.text }}>
                          {log.belong ?? '-'}
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 14, color: C.text }}>
                          {log.name_input ?? '-'}
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 14, color: C.green }}>
                          {log.matched_name ?? '-'}
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 13, color: C.muted }}>
                          {formatUA(log.user_agent)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ページネーション */}
          {data.totalPages > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: C.surface2, color: page === 1 ? C.muted : C.text,
                  border: `1px solid ${C.border}`, borderRadius: 5,
                  padding: '5px 14px', fontSize: 14,
                  cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1,
                }}
              >
                ← 前へ
              </button>
              <span style={{ fontSize: 14, color: C.muted }}>
                {page} / {data.totalPages} ページ
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                style={{
                  background: C.surface2, color: page === data.totalPages ? C.muted : C.text,
                  border: `1px solid ${C.border}`, borderRadius: 5,
                  padding: '5px 14px', fontSize: 14,
                  cursor: page === data.totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === data.totalPages ? 0.5 : 1,
                }}
              >
                次へ →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
