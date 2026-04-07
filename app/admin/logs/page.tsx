'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { C } from '@/lib/colors';
import type { OperationLog, OperationAction } from '@/lib/types';
import Footer from '@/components/Footer';

const ACTION_LABELS: Record<OperationAction, string> = {
  tournament_create: '大会新規作成',
  tournament_update: '大会情報を更新',
  tournament_delete: '大会を削除',
  tournament_reset: 'リセット実行',
  apply_settings: '申込設定を更新',
  registration_manual: '手動追加',
  registration_transfer: '選手管理に移行',
  registration_cancel: '申込キャンセル',
  registration_delete: '申込削除',
  registration_restore: '未移行に戻す',
  member_delete: '選手を削除',
  login: 'ログイン',
  inspection_save: '記録審査を保存',
  inspection_download: '記録審査表ダウンロード',
};

const PAGE_SIZE = 50;

export default function OperationLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isSystem = session?.user?.role === 'system';
  const userAffiliation = session?.user?.affiliation ?? null;

  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterTournament, setFilterTournament] = useState('');
  const [filterAffiliation, setFilterAffiliation] = useState('');
  const [affiliations, setAffiliations] = useState<string[]>([]);

  // 所属協会一覧を取得
  const fetchAffiliations = useCallback(async () => {
    try {
      const res = await fetch('/api/players?affiliations=1');
      const json = await res.json();
      if (json.affiliations) setAffiliations(json.affiliations);
    } catch { /* ignore */ }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (filterAction) params.set('action', filterAction);
      if (filterTournament) params.set('tournament_id', filterTournament);
      if (filterAffiliation) params.set('affiliation', filterAffiliation);

      const res = await fetch(`/api/operation-logs?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs);
        setTotal(json.data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterTournament, filterAffiliation]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAffiliations();
    }
  }, [status, fetchAffiliations]);

  useEffect(() => {
    if (status === 'authenticated') fetchLogs();
  }, [status, fetchLogs]);

  if (status === 'loading') return null;
  if (!session) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.text, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>ログインが必要です</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function formatDate(iso: string) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${mo}/${da} ${h}:${mi}`;
  }

  const th: React.CSSProperties = {
    padding: '10px 12px', fontSize: 15, color: C.muted, fontWeight: 600,
    textAlign: 'left', borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '8px 12px', fontSize: 15, borderBottom: `1px solid ${C.border}`,
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 15 }}
          >
            ← 戻る
          </button>
          <h1 style={{ margin: 0, fontSize: 20, color: C.gold }}>ログイン・操作ログ</h1>
        </div>
        <div style={{ fontSize: 15, color: C.muted }}>
          全 {total} 件
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* フィルター */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, color: C.muted }}>操作種別:</span>
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(0); }}
              style={{
                background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5,
                color: C.text, padding: '5px 10px', fontSize: 15,
              }}
            >
              <option value="">全て</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {isSystem && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, color: C.muted }}>所属協会:</span>
              <select
                value={filterAffiliation}
                onChange={e => { setFilterAffiliation(e.target.value); setPage(0); }}
                style={{
                  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5,
                  color: C.text, padding: '5px 10px', fontSize: 15,
                }}
              >
                <option value="">全て</option>
                {affiliations.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => { setFilterAction(''); setFilterTournament(''); setFilterAffiliation(''); setPage(0); }}
            style={{
              background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 5, padding: '5px 12px', fontSize: 15, cursor: 'pointer',
            }}
          >
            フィルターリセット
          </button>
        </div>

        {/* テーブル */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                <th style={th}>日時</th>
                <th style={th}>管理者</th>
                <th style={th}>所属協会</th>
                <th style={th}>大会名</th>
                <th style={th}>操作内容</th>
                <th style={th}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: C.muted }}>読み込み中...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: C.muted }}>ログがありません</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: C.muted }}>{formatDate(log.logged_at)}</td>
                  <td style={td}>{log.admin_name ?? '—'}</td>
                  <td style={{ ...td, color: C.muted }}>{log.admin_affiliation ?? '—'}</td>
                  <td style={td}>{log.tournament_name ?? '—'}</td>
                  <td style={td}>
                    <span style={{
                      background: C.surface2, borderRadius: 4, padding: '2px 8px', fontSize: 14,
                      color: log.action.includes('delete') || log.action === 'tournament_reset' ? C.red
                        : log.action === 'login' ? C.blue2
                        : C.text,
                    }}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td style={{ ...td, color: C.muted, fontSize: 14 }}>{log.detail ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページング */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                background: C.surface, color: page === 0 ? C.muted : C.text,
                border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 14px',
                fontSize: 15, cursor: page === 0 ? 'default' : 'pointer',
              }}
            >
              ← 前へ
            </button>
            <span style={{ fontSize: 15, color: C.muted, padding: '5px 8px' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                background: C.surface, color: page >= totalPages - 1 ? C.muted : C.text,
                border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 14px',
                fontSize: 15, cursor: page >= totalPages - 1 ? 'default' : 'pointer',
              }}
            >
              次へ →
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
