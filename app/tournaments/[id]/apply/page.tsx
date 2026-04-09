'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import type { Tournament, ParticipationDay, ClassType } from '@/lib/types';
import Footer from '@/components/Footer';

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
  const [associationNames, setAssociationNames] = useState<string[]>([]);

  // ステップ1: メール入力
  const [email, setEmail] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeSendError, setCodeSendError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // ステップ2: 申込フォーム
  const [code, setCode] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [name, setName] = useState('');
  const [belong, setBelong] = useState('');
  const [classVal, setClassVal] = useState<ClassType | ''>('');
  const [isJudge, setIsJudge] = useState(false);
  const [participationDay, setParticipationDay] = useState<ParticipationDay>('day1');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

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

  useEffect(() => {
    fetch('/api/associations')
      .then(r => r.json())
      .then(j => {
        if (j.success) setAssociationNames((j.data as { name: string }[]).map(a => a.name));
      })
      .catch(() => {});
  }, []);

  const is2Day = !!(applyInfo?.tournament.day2_date);
  const t = applyInfo?.tournament;

  const now = Date.now();
  const isWithinPeriod = t?.apply_start_at && t?.apply_end_at &&
    now >= new Date(t.apply_start_at).getTime() &&
    now <= new Date(t.apply_end_at).getTime() + 5 * 60 * 1000;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const eventLabel = (et: string) => et === 'trap' ? 'トラップ' : 'スキート';

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeSendError(null);
    if (!email.trim()) {
      setCodeSendError('メールアドレスを入力してください');
      return;
    }
    try {
      setCodeSending(true);
      const res = await fetch(`/api/tournaments/${id}/apply/request-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCodeSent(true);
    } catch (e) {
      setCodeSendError(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setCodeSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!code.trim() || code.trim().length !== 6) {
      setSubmitError('申込コードを6桁で入力してください');
      return;
    }
    if (!memberCode.trim() || !name.trim()) {
      setSubmitError('会員番号と氏名は必須です');
      return;
    }
    if (!belong) {
      setSubmitError('所属協会を選択してください');
      return;
    }
    if (!classVal) {
      setSubmitError('クラスを選択してください');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/tournaments/${id}/apply/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          member_code: memberCode.trim(),
          name: name.trim(),
          belong: belong || null,
          class: classVal || null,
          is_judge: isJudge,
          participation_day: is2Day ? participationDay : 'day1',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      // 申込数を最新化
      const infoRes = await fetch(`/api/tournaments/${id}/apply-info`);
      const infoJson = await infoRes.json();
      if (infoJson.success) setApplyInfo(infoJson.data);
      setCompleted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '申込に失敗しました');
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

          {t.notes && (
            <div style={{
              marginTop: 16, background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '10px 14px', fontSize: 14, color: C.muted,
              whiteSpace: 'pre-wrap',
            }}>
              {t.notes}
            </div>
          )}

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
        {completed ? (
          <div style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, borderRadius: 8,
            padding: '32px 20px', textAlign: 'center',
          }}>
            <p style={{ color: C.green, fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
              申込が完了しました
            </p>
            <p style={{ color: C.text, fontSize: 15, margin: '0 0 8px' }}>
              「{t.name}」への申込が完了しました。
            </p>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
              申込完了のメールをお送りしました。ご確認ください。
            </p>
          </div>
        ) : isWithinPeriod ? (
          <>
            {/* ステップ1: メール入力・コード送信 */}
            <section style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '20px', marginBottom: 16,
            }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>申込フォーム</h2>

              {codeSendError && (
                <div style={{
                  background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                  borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
                }}>{codeSendError}</div>
              )}

              <form onSubmit={handleSendCode}>
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
                    disabled={codeSent}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>
                    申込コードをこのメールアドレスに送信します。
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={codeSending || codeSent}
                  style={{
                    background: codeSent ? C.surface2 : C.gold,
                    color: codeSent ? C.muted : '#000',
                    border: 'none', borderRadius: 5,
                    padding: '12px 28px', fontSize: 16, fontWeight: 700,
                    cursor: (codeSending || codeSent) ? 'not-allowed' : 'pointer',
                    opacity: codeSending ? 0.7 : 1,
                    width: '100%',
                  }}
                >
                  {codeSending ? '送信中...' : codeSent ? '申込コードを送信済み' : '申込コードをメールで受取る'}
                </button>
              </form>

              {codeSent && (
                <div style={{
                  marginTop: 12,
                  background: `${C.green}22`, border: `1px solid ${C.green}`, borderRadius: 6,
                  padding: '12px 16px',
                }}>
                  <p style={{ color: C.green, fontWeight: 700, margin: '0 0 4px', fontSize: 15 }}>
                    メールで申込コードを送信しました。
                  </p>
                  <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
                    以下に申込コードを登録してください。（有効期限：10分）
                  </p>
                </div>
              )}
            </section>

            {/* ステップ2: コード＋申込情報入力（コード送信後に表示） */}
            {codeSent && (
              <section style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '24px',
              }}>
                {submitError && (
                  <div style={{
                    background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                    borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14,
                  }}>{submitError}</div>
                )}

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                      <label style={labelStyle}>
                        申込コード <span style={{ color: C.red }}>*</span>
                        <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>※メールに届いた6桁の数字</span>
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="例: 123456"
                        style={{ ...inputStyle, letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="off"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>会員番号 <span style={{ color: C.red }}>*</span></label>
                      <input
                        type="text"
                        value={memberCode}
                        onChange={e => setMemberCode(e.target.value)}
                        placeholder="例: 12345678"
                        style={inputStyle}
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>氏名 <span style={{ color: C.red }}>*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="例: 山田 太郎"
                        style={inputStyle}
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>所属協会 <span style={{ color: C.red }}>*</span></label>
                      <select
                        value={belong}
                        onChange={e => setBelong(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">— 選択 —</option>
                        {associationNames.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                        <div>
                          <label style={labelStyle}>クラス <span style={{ color: C.red }}>*</span></label>
                          <select
                            value={classVal}
                            onChange={e => setClassVal(e.target.value as ClassType | '')}
                            style={{ ...inputStyle, width: 120 }}
                          >
                            <option value="">— 選択 —</option>
                            {(['AA', 'A', 'B', 'C'] as ClassType[]).map(c => (
                              <option key={c} value={c}>{c}クラス</option>
                            ))}
                          </select>
                          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>
                            ※クラスが不明な方はCクラスを選択してください
                          </p>
                        </div>
                        <div style={{ paddingTop: 4 }}>
                          <label style={labelStyle}>審判資格</label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: C.text, fontSize: 15 }}>
                            <input
                              type="checkbox"
                              checked={isJudge}
                              onChange={e => setIsJudge(e.target.checked)}
                              style={{ accentColor: C.gold, width: 18, height: 18 }}
                            />
                            審判資格あり
                          </label>
                        </div>
                      </div>
                    </div>

                    {is2Day && (
                      <div>
                        <label style={labelStyle}>参加日程 <span style={{ color: C.red }}>*</span></label>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {([['day1', '1日目'], ['day2', '2日目'], ['both', '両方']] as [ParticipationDay, string][]).map(([val, label]) => (
                            <label key={val} style={{
                              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                              color: participationDay === val ? C.gold : C.muted, fontSize: 15,
                            }}>
                              <input
                                type="radio"
                                name="participation_day"
                                value={val}
                                checked={participationDay === val}
                                onChange={() => setParticipationDay(val)}
                                style={{ accentColor: C.gold }}
                              />
                              {label}
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
                        marginTop: 8,
                        width: '100%',
                      }}
                    >
                      {submitting ? '申込中...' : '申込を確定する'}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </>
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
      <Footer />
    </div>
  );
}
