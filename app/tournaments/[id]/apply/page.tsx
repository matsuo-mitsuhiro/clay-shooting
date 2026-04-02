'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import type { Tournament, ParticipationDay } from '@/lib/types';

interface ApplyInfoData {
  tournament: Tournament;
  day1_count: number;
  day2_count: number;
}

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [applyInfo, setApplyInfo] = useState<ApplyInfoData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [participationDay, setParticipationDay] = useState<ParticipationDay>('day1');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/tournaments/${id}/apply-info`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setApplyInfo(j.data);
        else setFetchError(j.error ?? 'データ取得に失敗しました');
      })
      .catch(() => setFetchError('データ取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [id]);

  const is2Day = !!(applyInfo?.tournament.day2_date);
  const t = applyInfo?.tournament;

  const now = Date.now();
  const isWithinPeriod = t?.apply_start_at && t?.apply_end_at &&
    now >= new Date(t.apply_start_at).getTime() &&
    now <= new Date(t.apply_end_at).getTime() + 5 * 60 * 1000;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const eventLabel = (et: string) => et === 'trap' ? 'トラップ' : 'スキート';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!email.trim()) {
      setSubmitError('メールアドレスを入力してください');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/tournaments/${id}/apply/request-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          participation_day: is2Day ? participationDay : 'day1',
        }),
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    color: C.muted,
    marginBottom: 6,
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.muted }}>読み込み中...</p>
      </div>
    );
  }

  if (fetchError || !t) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.red }}>{fetchError ?? '大会が見つかりません'}</p>
      </div>
    );
  }

  const max = t.max_participants;
  const day1Remaining = max ? max - (applyInfo?.day1_count ?? 0) : null;
  const day2Remaining = max ? max - (applyInfo?.day2_count ?? 0) : null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>大会申込</span>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        {/* 大会情報 */}
        <section style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '20px', marginBottom: 20,
        }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 20, color: C.gold }}>{t.name}</h1>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 15 }}>
            {t.venue && (
              <>
                <dt style={{ color: C.muted }}>会場</dt>
                <dd style={{ margin: 0, color: C.text }}>{t.venue}</dd>
              </>
            )}
            {t.day1_date && (
              <>
                <dt style={{ color: C.muted }}>開催日</dt>
                <dd style={{ margin: 0, color: C.text }}>
                  {fmtDate(t.day1_date)}{t.day2_date ? ` / ${fmtDate(t.day2_date)}` : ''}
                </dd>
              </>
            )}
            <dt style={{ color: C.muted }}>種目</dt>
            <dd style={{ margin: 0, color: C.text }}>{eventLabel(t.event_type)}</dd>
            {t.gate_open_time && (
              <>
                <dt style={{ color: C.muted }}>開門</dt>
                <dd style={{ margin: 0, color: C.text }}>{t.gate_open_time}</dd>
              </>
            )}
            {t.reception_start_time && (
              <>
                <dt style={{ color: C.muted }}>受付</dt>
                <dd style={{ margin: 0, color: C.text }}>{t.reception_start_time}</dd>
              </>
            )}
            {t.practice_clay_time && (
              <>
                <dt style={{ color: C.muted }}>テストクレー</dt>
                <dd style={{ margin: 0, color: C.text }}>{t.practice_clay_time}</dd>
              </>
            )}
            {t.competition_start_time && (
              <>
                <dt style={{ color: C.muted }}>競技開始</dt>
                <dd style={{ margin: 0, color: C.text }}>{t.competition_start_time}</dd>
              </>
            )}
          </dl>

          {/* 申込数表示 */}
          {max && (
            <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 14 }}>
                <span style={{ color: C.muted }}>{is2Day ? '1日目 ' : ''}定員: </span>
                <span style={{ color: C.text, fontWeight: 700 }}>{max}名</span>
                <span style={{ color: C.muted, marginLeft: 8 }}>申込: </span>
                <span style={{ color: C.gold, fontWeight: 700 }}>{applyInfo?.day1_count ?? 0}名</span>
                <span style={{ color: C.muted, marginLeft: 8 }}>残: </span>
                <span style={{ color: (day1Remaining ?? 0) > 0 ? C.green : C.red, fontWeight: 700 }}>
                  {day1Remaining ?? 0}名
                </span>
              </div>
              {is2Day && (
                <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 14px', fontSize: 14 }}>
                  <span style={{ color: C.muted }}>2日目 定員: </span>
                  <span style={{ color: C.text, fontWeight: 700 }}>{max}名</span>
                  <span style={{ color: C.muted, marginLeft: 8 }}>申込: </span>
                  <span style={{ color: C.gold, fontWeight: 700 }}>{applyInfo?.day2_count ?? 0}名</span>
                  <span style={{ color: C.muted, marginLeft: 8 }}>残: </span>
                  <span style={{ color: (day2Remaining ?? 0) > 0 ? C.green : C.red, fontWeight: 700 }}>
                    {day2Remaining ?? 0}名
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 注意書き */}
          {t.notes && (
            <div style={{
              marginTop: 16, background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '10px 14px', fontSize: 14, color: C.muted,
              whiteSpace: 'pre-wrap',
            }}>
              {t.notes}
            </div>
          )}

          {/* 中止お知らせ */}
          {t.cancellation_notice && (
            <div style={{
              marginTop: 12, background: `${C.red}11`, border: `1px solid ${C.red}66`,
              borderRadius: 6, padding: '10px 14px', fontSize: 14, color: C.text,
              whiteSpace: 'pre-wrap',
            }}>
              <strong style={{ color: C.red }}>中止・中断時のお知らせ方法：</strong><br />
              {t.cancellation_notice}
            </div>
          )}
        </section>

        {/* 申込フォーム */}
        {submitted ? (
          <div style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, borderRadius: 8,
            padding: '20px', textAlign: 'center',
          }}>
            <p style={{ color: C.green, fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              メールを送信しました
            </p>
            <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
              入力したメールアドレスに申込フォームのURLを送信しました。<br />
              1時間以内にアクセスして申込を完了してください。
            </p>
          </div>
        ) : isWithinPeriod ? (
          <section style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>申込フォーム</h2>
            {submitError && (
              <div style={{
                background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
              }}>{submitError}</div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  メールアドレス <span style={{ color: C.red }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  style={inputStyle}
                  autoComplete="email"
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>
                  申込フォームのURLをこのメールアドレスに送信します。
                </p>
              </div>

              {is2Day && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>
                    参加日程 <span style={{ color: C.red }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['day1', 'day2', 'both'] as ParticipationDay[]).map(d => (
                      <label key={d} style={{
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        color: participationDay === d ? C.gold : C.muted, fontSize: 15,
                      }}>
                        <input
                          type="radio"
                          name="participation_day"
                          value={d}
                          checked={participationDay === d}
                          onChange={() => setParticipationDay(d)}
                          style={{ accentColor: C.gold }}
                        />
                        {d === 'day1' ? '1日目' : d === 'day2' ? '2日目' : '両方'}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                  padding: '12px 28px', fontSize: 16, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  width: '100%',
                }}
              >
                {submitting ? '送信中...' : '申込フォームURLを受け取る'}
              </button>
            </form>
          </section>
        ) : (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '20px', textAlign: 'center',
          }}>
            <p style={{ color: C.muted, fontSize: 16 }}>
              {(!t.apply_start_at || Date.now() < new Date(t.apply_start_at).getTime())
                ? '募集が開始されていません'
                : '申込受付は終了しました'}
            </p>
            {t.apply_start_at && t.apply_end_at && (
              <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
                受付期間: {new Date(t.apply_start_at).toLocaleString('ja-JP')} 〜 {new Date(t.apply_end_at).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        )}

        {/* キャンセルリンク */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={() => router.push(`/tournaments/${id}/cancel`)}
            style={{
              background: 'transparent', color: C.muted,
              border: `1px solid ${C.border}`, borderRadius: 5,
              padding: '8px 16px', fontSize: 14, cursor: 'pointer',
            }}
          >
            申込キャンセルの方はこちら
          </button>
        </div>
      </main>
    </div>
  );
}
