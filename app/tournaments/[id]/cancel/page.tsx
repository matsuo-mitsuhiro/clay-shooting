'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';

export default function CancelPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/tournaments/${id}/apply-info`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setTournament(j.data.tournament);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!email.trim()) {
      setSubmitError('メールアドレスを入力してください');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/tournaments/${id}/cancel/request-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    padding: '10px 12px',
    fontSize: 16,
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>申込キャンセル</span>
        {tournament && <span style={{ fontSize: 15, color: C.muted }}>{tournament.name}</span>}
      </header>

      <main style={{ maxWidth: 500, margin: '0 auto', padding: '32px 16px' }}>
        {loading ? (
          <p style={{ color: C.muted, textAlign: 'center' }}>読み込み中...</p>
        ) : submitted ? (
          <div style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, borderRadius: 8,
            padding: '24px', textAlign: 'center',
          }}>
            <p style={{ color: C.green, fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              メールを送信しました
            </p>
            <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
              キャンセル手続きのURLを送信しました。<br />
              1時間以内にアクセスしてキャンセルを完了してください。
            </p>
          </div>
        ) : (
          <section style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '24px',
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, color: C.gold }}>キャンセル申請</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: C.muted }}>
              申込時に使用したメールアドレスを入力してください。<br />
              キャンセル手続きのURLをお送りします。
            </p>

            {submitError && (
              <div style={{
                background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 14,
              }}>{submitError}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 6 }}>
                  メールアドレス <span style={{ color: C.red }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="申込時のメールアドレス"
                  style={inputStyle}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: C.red, color: '#fff', border: 'none', borderRadius: 5,
                  padding: '12px 28px', fontSize: 16, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  width: '100%',
                }}
              >
                {submitting ? '送信中...' : 'キャンセルURLを受け取る'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
