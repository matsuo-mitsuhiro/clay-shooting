'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';
import MembersTab from './MembersTab';
import ScoresTab from './ScoresTab';
import ResultsTab from './ResultsTab';
import SettingsTab from './SettingsTab';
import ViewerHistoryTab from './ViewerHistoryTab';

type TabType = 'members' | 'scores' | 'results' | 'settings' | 'history';

interface Props {
  tournamentId: number;
}

export default function AdminDetail({ tournamentId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTournament();
  }, [tournamentId]);

  async function fetchTournament() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tournaments/${tournamentId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setTournament(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'settings', label: '大会設定' },
    { key: 'members', label: '選手登録' },
    { key: 'scores', label: '点数登録' },
    { key: 'results', label: '成績確認' },
    { key: 'history', label: '閲覧履歴' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => router.push('/admin')}
          style={{
            background: 'transparent',
            color: C.muted,
            border: `1px solid ${C.border}`,
            borderRadius: 5,
            padding: '6px 12px',
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          ← 大会一覧
        </button>
        <div style={{ flex: 1 }}>
          {loading ? (
            <span style={{ color: C.muted, fontSize: 18 }}>読み込み中...</span>
          ) : error ? (
            <span style={{ color: C.red, fontSize: 18 }}>{error}</span>
          ) : tournament ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.gold }}>
                {tournament.name}
              </h1>
              {tournament.venue && (
                <span style={{ fontSize: 15, color: C.muted }}>{tournament.venue}</span>
              )}
              <span style={{
                background: tournament.event_type === 'trap' ? `${C.gold}33` : `${C.blue2}33`,
                color: tournament.event_type === 'trap' ? C.gold : C.blue2,
                border: `1px solid ${tournament.event_type === 'trap' ? C.gold : C.blue2}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 13,
                fontWeight: 600,
              }}>
                {tournament.event_type === 'trap' ? 'トラップ' : 'スキート'}
              </span>
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: 14, color: C.muted }}>管理者画面</span>
      </header>

      {/* Tabs */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
        alignItems: 'center',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'transparent',
              color: activeTab === tab.key ? C.gold : C.muted,
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${C.gold}` : '2px solid transparent',
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: activeTab === tab.key ? 700 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
        {tournament && (
          <button
            onClick={() => window.open(`/viewer/${tournamentId}`, '_blank')}
            style={{
              marginLeft: 'auto',
              marginRight: 12,
              background: `${C.blue2}22`,
              color: C.blue2,
              border: `1px solid ${C.blue2}`,
              borderRadius: 5,
              padding: '6px 14px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            閲覧用確認 ↗
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '0' }}>
        {!loading && !error && tournament && (
          <>
            {activeTab === 'members' && (
              <MembersTab tournamentId={tournamentId} />
            )}
            {activeTab === 'scores' && (
              <ScoresTab tournamentId={tournamentId} />
            )}
            {activeTab === 'results' && (
              <ResultsTab tournamentId={tournamentId} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                tournamentId={tournamentId}
                tournament={tournament}
                onUpdated={fetchTournament}
              />
            )}
            {activeTab === 'history' && (
              <ViewerHistoryTab tournamentId={tournamentId} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
