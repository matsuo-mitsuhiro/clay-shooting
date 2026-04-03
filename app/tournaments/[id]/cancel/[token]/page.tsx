'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { C } from '@/lib/colors';
import type { Registration } from '@/lib/types';

export default function CancelConfirmPage() {
  const params = useParams();
  const id = params.id as string;
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    fetch(`/api/tournaments/${id}/cancel/${token}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setRegistration(j.data);
        else setFetchError(j.error ?? 'URLが無効です');
      })
      .catch(() => setFetchError('データ取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function handleCancel() {
    if (!window.confirm('本当にキャンセルしますか？')) return;
    setSubmitError(null);
    try {
      setSubmitting(true);
      const res = await fetch(`/api/tournaments/${id}/cancel/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCancelled(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'キャンセルに失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  const dayLabel = (d: string) =>
    d === 'day1' ? '1日目' : d === 'day2' ? '2日目' : '両日';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.muted }}>読み込み中...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: C.red, fontSize: 18 }}>{fetchError}</p>
        <p style={{ color: C.muted, fontSize: 14 }}>このURLは無効または期限切れです。</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>キャンセル確認</span>
      </header>

      <main style={{ maxWidth: 500, margin: '0 auto', padding: '32px 16px' }}>
        {cancelled ? (
          <div style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, borderRadius: 8,
            padding: '24px', textAlign: 'center',
          }}>
            <p style={{ color: C.green, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
              キャンセルが完了しました
            </p>
            <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
              申込のキャンセルを受け付けました。
            </p>
          </div>
        ) : registration ? (
          <section style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '24px',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>以下の申込をキャンセルします</h2>
            <dl style={{ margin: '0 0 20px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 15 }}>
              <dt style={{ color: C.muted }}>氏名</dt>
              <dd style={{ margin: 0, color: C.text, fontWeight: 700 }}>{registration.name}</dd>
              <dt style={{ color: C.muted }}>会員番号</dt>
              <dd style={{ margin: 0, color: C.text }}>{registration.member_code}</dd>
              {registration.belong && (
                <>
                  <dt style={{ color: C.muted }}>所属協会</dt>
                  <dd style={{ margin: 0, color: C.text }}>{registration.belong}</dd>
                </>
              )}
              <dt style={{ color: C.muted }}>参加</dt>
              <dd style={{ margin: 0, color: C.text }}>{dayLabel(registration.participation_day)}</dd>
              <dt style={{ color: C.muted }}>申込日時</dt>
              <dd style={{ margin: 0, color: C.text }}>
                {new Date(registration.applied_at).toLocaleString('ja-JP')}
              </dd>
            </dl>

            {submitError && (
              <div style={{
                background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 14,
              }}>{submitError}</div>
            )}

            <button
              onClick={handleCancel}
              disabled={submitting}
              style={{
                background: C.red, color: '#fff', border: 'none', borderRadius: 5,
                padding: '12px 28px', fontSize: 16, fontWeight: 700, width: '100%',
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'キャンセル中...' : 'キャンセルを確定する'}
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
