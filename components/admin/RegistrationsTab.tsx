'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { C } from '@/lib/colors';
import type { Registration, ParticipationDay } from '@/lib/types';

interface Props {
  tournamentId: number;
  onTransferToBulk?: (registrations: Registration[]) => void;
}

function dayLabel(d: ParticipationDay): string {
  if (d === 'day1') return '1日目';
  if (d === 'day2') return '2日目';
  return '両方';
}

export default function RegistrationsTab({ tournamentId, onTransferToBulk }: Props) {
  const { data: session } = useSession();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function fetchRegistrations() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRegistrations(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(reg: Registration) {
    if (!window.confirm(`${reg.name} さんの申込をキャンセルしますか？`)) return;
    const adminName = session?.user?.name ?? 'admin';
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${reg.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_name: adminName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      fetchRegistrations();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'キャンセルに失敗しました');
    }
  }

  async function handleTransfer() {
    setTransferError(null);
    if (!window.confirm('申込者データを選手一括登録に移行しますか？\n申込期間が終了している必要があります。')) return;
    try {
      setTransferring(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const data: Registration[] = json.data;
      onTransferToBulk?.(data);
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : '移行に失敗しました');
    } finally {
      setTransferring(false);
    }
  }

  const activeCount = registrations.filter(r => r.status === 'active').length;
  const cancelledCount = registrations.filter(r => r.status === 'cancelled').length;

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
            borderRadius: 5, padding: '4px 12px', fontSize: 14, fontWeight: 700,
          }}>
            申込中: {activeCount}名
          </span>
          {cancelledCount > 0 && (
            <span style={{
              background: C.surface2, border: `1px solid ${C.border}`, color: C.muted,
              borderRadius: 5, padding: '4px 12px', fontSize: 14,
            }}>
              キャンセル: {cancelledCount}名
            </span>
          )}
        </div>
        <button
          onClick={fetchRegistrations}
          style={{
            background: C.surface2, color: C.muted, border: `1px solid ${C.border}`,
            borderRadius: 5, padding: '6px 14px', fontSize: 14, cursor: 'pointer',
          }}
        >
          更新
        </button>
        <button
          onClick={handleTransfer}
          disabled={transferring || activeCount === 0}
          style={{
            background: C.blue2, color: '#fff', border: 'none',
            borderRadius: 5, padding: '6px 16px', fontSize: 14, fontWeight: 700,
            cursor: (transferring || activeCount === 0) ? 'not-allowed' : 'pointer',
            opacity: (transferring || activeCount === 0) ? 0.6 : 1,
            marginLeft: 'auto',
          }}
        >
          {transferring ? '移行中...' : '選手一括登録に移行'}
        </button>
      </div>

      {transferError && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 14,
        }}>{transferError}</div>
      )}

      {loading ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>読み込み中...</p>
      ) : error ? (
        <p style={{ color: C.red, textAlign: 'center', padding: '20px 0' }}>{error}</p>
      ) : registrations.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '40px', textAlign: 'center',
        }}>
          <p style={{ color: C.muted, fontSize: 15 }}>申込はまだありません</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                {['会員番号', '氏名', '所属', 'クラス', '参加', '申込日時', 'ステータス', '操作'].map(h => (
                  <th key={h} style={{
                    padding: '9px 10px', fontSize: 12, color: C.muted, fontWeight: 600,
                    textAlign: 'left', borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrations.map(reg => (
                <tr key={reg.id} style={{
                  borderBottom: `1px solid ${C.border}33`,
                  background: reg.status === 'cancelled' ? `${C.surface2}88` : 'transparent',
                  opacity: reg.status === 'cancelled' ? 0.6 : 1,
                }}>
                  <td style={{ padding: '7px 10px', fontSize: 13, color: C.muted }}>{reg.member_code}</td>
                  <td style={{ padding: '7px 10px', fontSize: 14, color: C.text, fontWeight: 600 }}>{reg.name}</td>
                  <td style={{ padding: '7px 10px', fontSize: 13, color: C.muted }}>{reg.belong ?? '—'}</td>
                  <td style={{ padding: '7px 10px', fontSize: 13, color: C.muted, textAlign: 'center' }}>
                    {reg.class ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 13, color: C.text }}>
                    {dayLabel(reg.participation_day)}
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                    {new Date(reg.applied_at).toLocaleString('ja-JP')}
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 12 }}>
                    {reg.status === 'active' ? (
                      <span style={{
                        background: `${C.green}22`, color: C.green,
                        border: `1px solid ${C.green}`, borderRadius: 4, padding: '2px 8px', fontSize: 12,
                      }}>申込中</span>
                    ) : (
                      <span style={{
                        background: C.surface2, color: C.muted,
                        border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 12,
                      }}>キャンセル</span>
                    )}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    {reg.status === 'active' && (
                      <button
                        onClick={() => handleCancel(reg)}
                        style={{
                          background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
                          borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        キャンセル
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
