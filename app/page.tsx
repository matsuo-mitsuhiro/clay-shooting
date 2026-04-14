'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';
import Footer from '@/components/Footer';

export default function Home() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<'current' | 'past'>('current');

  useEffect(() => {
    fetch('/api/tournaments').then(r => r.json()).then(j => {
      if (j.success) setTournaments(j.data);
    }).finally(() => setLoading(false));
  }, []);

  function handleAdminClick() {
    const pw = window.prompt('パスワードを入力してください');
    if (pw === 'repros') {
      router.push('/admin');
    } else if (pw !== null) {
      alert('あなたの会社名は？');
    }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const eventLabel = (t: string) => t === 'trap' ? 'トラップ' : t === 'skeet' ? 'スキート' : t === 'double_trap' ? 'ダブルトラップ' : t;

  const todayStr = new Date().toISOString().slice(0, 10);
  const lastDate = (t: Tournament) => t.day2_date ?? t.day1_date ?? '';

  const currentTournaments = tournaments
    .filter(t => !lastDate(t) || lastDate(t) >= todayStr)
    .sort((a, b) => (lastDate(a) < lastDate(b) ? -1 : lastDate(a) > lastDate(b) ? 1 : 0));

  const pastTournaments = tournaments
    .filter(t => lastDate(t) && lastDate(t) < todayStr)
    .sort((a, b) => (lastDate(a) > lastDate(b) ? -1 : lastDate(a) < lastDate(b) ? 1 : 0));

  const displayTournaments = listTab === 'current' ? currentTournaments : pastTournaments;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <header style={{ borderBottom: `1px solid ${C.goldDark}`, padding: '24px 24px 16px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '0.15em', color: C.gold }}>クレー射撃大会</h1>
        <p style={{ margin: '6px 0 0', fontSize: 16, letterSpacing: '0.3em', color: C.gold }}>運 営 シ ス テ ム</p>
      </header>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
        {/* タブ切替 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['current', 'past'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setListTab(tab)}
              style={{
                background: listTab === tab ? C.gold : 'transparent',
                color: listTab === tab ? '#000' : C.muted,
                border: `1px solid ${listTab === tab ? C.gold : C.border}`,
                borderRadius: 6,
                padding: '6px 16px',
                fontSize: 15,
                fontWeight: listTab === tab ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {tab === 'current' ? '大会一覧' : '過去の大会'}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: C.muted, textAlign: 'center' }}>読み込み中...</p>
        ) : displayTournaments.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: C.muted }}>
            {listTab === 'current' ? '大会が登録されていません' : '過去の大会はありません'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayTournaments.map(t => {
              const sc = (t as Tournament & { score_count?: number }).score_count ?? 0;
              const hasSquad = !!t.squad_published_at;
              const hasScores = sc > 0;
              const btnLabel = hasScores ? '成績' : hasSquad ? '射順' : '概要';
              const btnHref = hasScores
                ? `/viewer/${t.id}`
                : hasSquad
                  ? `/tournaments/${t.id}/apply#squad`
                  : `/tournaments/${t.id}/apply`;
              const btnBg = hasScores ? '#e74c3c' : hasSquad ? '#2980b9' : C.gold;
              const btnColor = hasScores ? '#fff' : hasSquad ? '#fff' : '#000';

              const now = Date.now();
              const hasApply = !!(t.apply_start_at && t.apply_end_at);
              const applyOpen = hasApply &&
                now >= new Date(t.apply_start_at!).getTime() &&
                now <= new Date(t.apply_end_at!).getTime() + 5 * 60 * 1000;

              return (
              <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Link href={btnHref} style={{ textDecoration: 'none', flex: 1 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{t.name}</span>
                      <span style={{ background: C.gold, color: '#000', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{eventLabel(t.event_type)}</span>
                    </div>
                    <div style={{ fontSize: 15, color: '#ffffff', display: 'flex', gap: 16 }}>
                      {t.venue && <span>📍 {t.venue}</span>}
                      {t.day1_date && <span>📅 {fmtDate(t.day1_date)}{t.day2_date ? ` / ${fmtDate(t.day2_date)}` : ''}</span>}
                    </div>
                  </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {applyOpen && (
                    <Link
                      href={`/tournaments/${t.id}/apply`}
                      style={{
                        background: C.gold, color: '#000',
                        borderRadius: 6, padding: '7px 16px',
                        fontSize: 14, fontWeight: 700,
                        textDecoration: 'none', whiteSpace: 'nowrap',
                      }}
                    >
                      申込
                    </Link>
                  )}
                  <Link
                    href={btnHref}
                    style={{
                      background: btnBg, color: btnColor,
                      borderRadius: 6, padding: '7px 16px',
                      fontSize: 14, fontWeight: 700,
                      textDecoration: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {btnLabel}
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>
      {/* Hidden admin button */}
      <button
        onClick={handleAdminClick}
        style={{
          position: 'fixed', bottom: 16, left: 16,
          width: 40, height: 40,
          background: C.bg, color: C.bg,
          border: 'none', borderRadius: 4,
          cursor: 'pointer', fontSize: 1,
        }}
        aria-label=""
      >　</button>
      <Footer />
    </div>
  );
}
