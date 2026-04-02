'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { C } from '@/lib/colors';
import type { Tournament, ClassType, ParticipationDay } from '@/lib/types';

export default function ApplyFormPage() {
  const params = useParams();
  const id = params.id as string;
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [memberCode, setMemberCode] = useState('');
  const [name, setName] = useState('');
  const [belong, setBelong] = useState('');
  const [classVal, setClassVal] = useState<ClassType | ''>('');
  const [participationDay, setParticipationDay] = useState<ParticipationDay>('day1');
  const [associationNames, setAssociationNames] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/tournaments/${id}/apply/${token}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setTournament(j.data);
        else setFetchError(j.error ?? 'URLが無効です');
      })
      .catch(() => setFetchError('データ取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    fetch('/api/associations')
      .then(r => r.json())
      .then(j => {
        if (j.success) setAssociationNames((j.data as { name: string }[]).map(a => a.name));
      })
      .catch(() => {});
  }, []);

  const is2Day = !!(tournament?.day2_date);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!memberCode.trim() || !name.trim()) {
      setSubmitError('会員番号と氏名は必須です');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/tournaments/${id}/apply/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          member_code: memberCode.trim(),
          name: name.trim(),
          belong: belong || null,
          class: classVal || null,
          participation_day: is2Day ? participationDay : 'day1',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSubmitted(true);
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

  if (fetchError || !tournament) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: C.red, fontSize: 18 }}>{fetchError ?? 'URLが無効です'}</p>
        <p style={{ color: C.muted, fontSize: 14 }}>このURLは無効または期限切れです。</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
        <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 20px' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>申込完了</span>
        </header>
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
          <div style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, borderRadius: 8, padding: '32px 20px',
          }}>
            <p style={{ color: C.green, fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
              申込が完了しました
            </p>
            <p style={{ color: C.text, fontSize: 15, margin: '0 0 8px' }}>
              「{tournament.name}」への申込が完了しました。
            </p>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
              申込完了のメールをお送りしました。<br />
              ご確認ください。
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>申込フォーム</span>
        <span style={{ marginLeft: 12, fontSize: 15, color: C.muted }}>{tournament.name}</span>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
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
                <label style={labelStyle}>所属</label>
                <select
                  value={belong}
                  onChange={e => setBelong(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— 選択 —</option>
                  {associationNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>クラス</label>
                <select
                  value={classVal}
                  onChange={e => setClassVal(e.target.value as ClassType | '')}
                  style={{ ...inputStyle, width: 120 }}
                >
                  <option value="">— 選択 —</option>
                  {(['A', 'B', 'C', 'D'] as ClassType[]).map(c => (
                    <option key={c} value={c}>{c}クラス</option>
                  ))}
                </select>
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
                }}
              >
                {submitting ? '申込中...' : '申込を確定する'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
