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
import InspectionTab from './InspectionTab';
import RegistrationsTab from './RegistrationsTab';

type TabType = 'members' | 'scores' | 'results' | 'inspection' | 'settings' | 'apply-settings' | 'history' | 'registrations';

interface Props {
  tournamentId: number;
}

const VALID_TABS: TabType[] = ['members', 'scores', 'results', 'inspection', 'settings', 'apply-settings', 'history', 'registrations'];

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
  const [contactOpen, setContactOpen] = useState(false);

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
    { key: 'inspection', label: '記録審査' },
    { key: 'history', label: '閲覧履歴' },
  ];

  return (
    <div style={{ height: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        {/* PC用: ヘッダー右側ボタン群 */}
        {!isMobile && (
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
                  {isSystem ? 'システム管理者' : '運営管理者'}
                </span>
              </>
            )}
            <a
              href="/manual/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.muted, fontSize: 18, textDecoration: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="マニュアル"
            >
              ℹ️
            </a>
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
        )}
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
                本大会閲覧用確認 ↗
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
                {/* ドロワーヘッダー */}
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

                {/* ユーザー情報（最上部） */}
                {session?.user && (
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>
                      {session.user.name ?? session.user.email}
                    </div>
                    <span style={{
                      background: isSystem ? `${C.gold}33` : `${C.blue2}33`,
                      color: isSystem ? C.gold : C.blue2,
                      border: `1px solid ${isSystem ? C.gold : C.blue2}`,
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {isSystem ? 'システム管理者' : '運営管理者'}
                    </span>
                  </div>
                )}

                {/* トップページ */}
                <button
                  onClick={() => { router.push('/admin'); setMenuOpen(false); }}
                  style={{
                    background: 'transparent',
                    color: C.muted,
                    border: 'none',
                    borderLeft: '3px solid transparent',
                    padding: '12px 20px',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  ←Top トップページ
                </button>

                {/* 区切り線 */}
                <div style={{ height: 1, background: C.border, margin: '4px 16px' }} />

                {/* タブ一覧 */}
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setMenuOpen(false); }}
                    style={{
                      background: activeTab === tab.key ? `${C.gold}18` : 'transparent',
                      color: activeTab === tab.key ? C.gold : C.muted,
                      border: 'none',
                      borderLeft: activeTab === tab.key ? `3px solid ${C.gold}` : '3px solid transparent',
                      padding: '12px 20px',
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

                {/* 区切り線 */}
                <div style={{ height: 1, background: C.border, margin: '8px 16px' }} />

                {/* Q&A */}
                <a
                  href="/faq"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'block',
                    color: C.muted,
                    textDecoration: 'none',
                    padding: '10px 20px',
                    fontSize: 15,
                    borderLeft: '3px solid transparent',
                  }}
                >
                  Q&amp;A ↗
                </a>

                {/* お問合せ */}
                <button
                  onClick={() => { setMenuOpen(false); setContactOpen(true); }}
                  style={{
                    background: 'transparent',
                    color: C.muted,
                    border: 'none',
                    borderLeft: '3px solid transparent',
                    padding: '10px 20px',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  お問合せ
                </button>

                {/* マニュアル */}
                <a
                  href="/manual/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'block',
                    color: C.muted,
                    textDecoration: 'none',
                    padding: '10px 20px',
                    fontSize: 15,
                    borderLeft: '3px solid transparent',
                  }}
                >
                  ℹ️ マニュアル ↗
                </a>

                {/* 区切り線 */}
                <div style={{ height: 1, background: C.border, margin: '8px 16px' }} />

                {/* ログアウト */}
                <button
                  onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/admin/login' }); }}
                  style={{
                    background: 'transparent',
                    color: C.muted,
                    border: 'none',
                    borderLeft: '3px solid transparent',
                    padding: '10px 20px',
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  ログアウト
                </button>
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
          <button
            onClick={() => router.push('/admin')}
            style={{
              background: 'transparent',
              color: C.muted,
              border: 'none',
              borderBottom: '2px solid transparent',
              padding: '12px 20px',
              fontSize: 16,
              fontWeight: 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ←Top
          </button>
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
              本大会閲覧用確認 ↗
            </button>
          )}
        </div>
      )}

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
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
            {activeTab === 'inspection' && (
              <InspectionTab
                tournamentId={tournamentId}
                tournament={tournament}
                onUpdated={fetchTournament}
              />
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

      {/* ドロワーからのお問合せモーダル */}
      {contactOpen && (
        <ContactModal onClose={() => setContactOpen(false)} />
      )}
    </div>
  );
}

// ─── お問合せモーダル（ドロワー用） ───────────────────────────────
function ContactModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/support/request-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (json.success) { setDone(true); } else { setError(json.error ?? '送信に失敗しました'); }
    } catch { setError('通信エラーが発生しました。'); } finally { setSending(false); }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: '100%', maxWidth: 440, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, color: C.gold, fontWeight: 700 }}>お問合せ</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>メールアドレスを入力すると、質問用のURLをお送りします。</p>
        {!done ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>メールアドレス <span style={{ color: '#e74c3c' }}>*</span></label>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="例: example@email.com" required autoFocus
                style={{ background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '10px 14px', fontSize: 15, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            {error && <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>⚠ {error}</div>}
            <div style={{ background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                ※ メール内のURLは「１時間」以内・1回のみ有効です。<br />
                ※ jpn.clayshooting@gmail.com からお送りします。
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={sending} style={{ flex: 1, background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '11px', fontSize: 15, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
                {sending ? '送信中...' : '送信する'}
              </button>
              <button type="button" onClick={onClose} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '11px 18px', fontSize: 14, cursor: 'pointer' }}>キャンセル</button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ color: '#2ecc71', fontWeight: 600, marginBottom: 8, fontSize: 16 }}>メールを送信しました</p>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>{email} 宛にURLをお送りしました。</p>
            <button onClick={onClose} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}>閉じる</button>
          </div>
        )}
      </div>
    </div>
  );
}
