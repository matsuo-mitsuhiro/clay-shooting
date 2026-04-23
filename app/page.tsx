'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';
import Footer from '@/components/Footer';

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<'current' | 'past'>('current');

  useEffect(() => {
    fetch('/api/tournaments').then(r => r.json()).then(j => {
      if (j.success) setTournaments(j.data);
    }).finally(() => setLoading(false));
  }, []);

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

              const now = Date.now();
              const hasApply = !!(t.apply_start_at && t.apply_end_at);
              const applyOpen = hasApply &&
                now >= new Date(t.apply_start_at!).getTime() &&
                now <= new Date(t.apply_end_at!).getTime() + 5 * 60 * 1000;

              // ボタンラベル・リンク・色の決定
              let btnLabel: string;
              let btnHref: string;
              let btnBg: string;
              let btnColor: string;

              if (hasScores) {
                btnLabel = '成績';
                btnHref = `/viewer/${t.id}`;
                btnBg = '#e74c3c';
                btnColor = '#fff';
              } else if (hasSquad) {
                btnLabel = applyOpen ? '射順・申込' : '射順';
                btnHref = `/tournaments/${t.id}/apply#squad`;
                btnBg = '#2980b9';
                btnColor = '#fff';
              } else {
                btnLabel = applyOpen ? '概要・申込' : '概要';
                btnHref = `/tournaments/${t.id}/apply`;
                btnBg = C.gold;
                btnColor = '#000';
              }

              return (
              <Link
                key={t.id}
                href={btnHref}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>
                  {t.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <span style={{ background: C.gold, color: '#000', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {eventLabel(t.event_type)}
                  </span>
                  <span style={{ background: btnBg, color: btnColor, borderRadius: 6, padding: '7px 18px', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {btnLabel}
                  </span>
                </div>
                <div style={{ fontSize: 15, color: '#ffffff', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t.venue && <span style={{ whiteSpace: 'nowrap' }}>📍 {t.venue}</span>}
                  {t.day1_date && <span style={{ whiteSpace: 'nowrap' }}>📅 {fmtDate(t.day1_date)}{t.day2_date ? ` / ${fmtDate(t.day2_date)}` : ''}</span>}
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
