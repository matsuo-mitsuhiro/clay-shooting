'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';

export default function ViewerListPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tournaments')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setTournaments(j.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const eventLabel = (t: string) =>
    t === 'trap' ? 'トラップ' : t === 'skeet' ? 'スキート' : t === 'double_trap' ? 'ダブルトラップ' : t;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      {/* ヘッダー */}
      <header
        className="flex items-center gap-4 px-6 py-4 border-b"
        style={{ background: C.surface, borderColor: C.border }}
      >
        <Link href="/" style={{ color: C.gold, fontSize: 14 }}>← トップへ</Link>
        <span className="font-bold text-lg tracking-wide" style={{ color: C.gold }}>成績閲覧 — 大会選択</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-xl font-bold mb-6" style={{ color: C.gold }}>大会一覧</h1>

        {loading && (
          <p style={{ color: C.muted }} className="text-center py-10">読み込み中...</p>
        )}

        {!loading && tournaments.length === 0 && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <p style={{ color: C.muted }}>大会が登録されていません</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/viewer/${t.id}`}
              className="flex items-center justify-between rounded-xl px-5 py-4 border transition-all hover:scale-[1.01]"
              style={{
                background: C.surface,
                borderColor: C.border,
                textDecoration: 'none',
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base" style={{ color: C.text }}>{t.name}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: C.gold, color: '#000' }}
                  >
                    {eventLabel(t.event_type)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}>
                  {t.venue && <span>📍 {t.venue}</span>}
                  {t.day1_date && <span>📅 {fmtDate(t.day1_date)}</span>}
                </div>
              </div>
              <span style={{ color: C.gold, fontSize: 18 }}>→</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
