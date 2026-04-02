'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';
import ContactButton from '@/components/ContactButton';
import MembersTab from './MembersTab';
import ScoresTab from './ScoresTab';
import ResultsTab from './ResultsTab';
import SettingsTab from './SettingsTab';
import ApplySettingsTab from './ApplySettingsTab';
import ViewerHistoryTab from './ViewerHistoryTab';
import RegistrationsTab from './RegistrationsTab';

type TabType = 'members' | 'scores' | 'results' | 'settings' | 'apply-settings' | 'history' | 'registrations';

interface Props {
  tournamentId: number;
}

const VALID_TABS: TabType[] = ['members', 'scores', 'results', 'settings', 'apply-settings', 'history', 'registrations'];

export default function AdminDetail({ tournamentId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isSystem = session?.user?.role === 'system';

  const tabParam = searchParams.get('tab') as TabType | null;
  const initialTab: TabType = (tabParam && VALID_TABS.includes(tabParam)) ? tabParam : 'members';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
    { key: 'apply-settings', label: '申込設定' },
    { key: 'registrations', label: '申込管理' },
    { key: 'members', label: '選手管理' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <ContactButton />
          {session?.user && (
            <>
              <span style={{ fontSize: 13, color: C.muted }}>{session.user.name ?? session.user.email}</span>
              <span style={{
                background: isSystem ? `${C.gold}33` : `${C.blue2}33`,
                color: isSystem ? C.gold : C.blue2,
                border: `1px solid ${isSystem ? C.gold : C.blue2}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {isSystem ? 'システム管理者' : '大会管理者'}
              </span>
            </>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            style={{
              background: 'transparent',
              color: C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Tabs — PC: 横並び / スマホ: ハンバーガーメニュー */}
      {isMobile ? (
        <>
          {/* モバイル用タブバー */}
          <div style={{
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 10,
            minHeight: 48,
          }}>
            <button
              onClick={() => setMenuOpen(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                color: C.muted,
                fontSize: 20,
                padding: '4px 10px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ☰
            </button>
            <span style={{ color: C.gold, fontWeight: 700, fontSize: 15 }}>
              {tabs.find(t => t.key === activeTab)?.label ?? ''}
            </span>
            {tournament && (
              <button
                onClick={() => window.open(`/viewer/${tournamentId}`, '_blank')}
                style={{
                  marginLeft: 'auto',
                  background: `${C.blue2}22`,
                  color: C.blue2,
                  border: `1px solid ${C.blue2}`,
                  borderRadius: 5,
                  padding: '5px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                閲覧用 ↗
              </button>
            )}
          </div>

          {/* ドロワーオーバーレイ */}
          {menuOpen && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 300,
              display: 'flex',
            }}>
              {/* 背景（クリックで閉じる） */}
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }}
              />
              {/* ドロワー本体 */}
              <div style={{
                position: 'relative',
                width: 240,
                background: C.surface,
                borderRight: `1px solid ${C.border}`,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1,
              }}>
                <div style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>メニュー</span>
                  <button
                    onClick={() => setMenuOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setMenuOpen(false); }}
                    style={{
                      background: activeTab === tab.key ? `${C.gold}18` : 'transparent',
                      color: activeTab === tab.key ? C.gold : C.muted,
                      border: 'none',
                      borderLeft: activeTab === tab.key ? `3px solid ${C.gold}` : '3px solid transparent',
                      padding: '14px 20px',
                      fontSize: 15,
                      fontWeight: activeTab === tab.key ? 700 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* PC用タブバー */
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
      )}

      {/* Tab Content */}
      <div style={{ padding: '0' }}>
        {!loading && !error && tournament && (
          <>
            {activeTab === 'registrations' && (
              <RegistrationsTab tournamentId={tournamentId} tournament={tournament} />
            )}
            {activeTab === 'members' && (
              <MembersTab tournamentId={tournamentId} tournament={tournament} />
            )}
            {activeTab === 'scores' && (
              <ScoresTab tournamentId={tournamentId} tournament={tournament} />
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
            {activeTab === 'apply-settings' && (
              <ApplySettingsTab
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
