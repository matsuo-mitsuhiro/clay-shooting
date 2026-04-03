'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';

const FAQ_CATEGORIES = ['閲覧者の機能', '大会管理者の機能'];

const inputStyle: React.CSSProperties = {
  background: '#0d0f14',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  padding: '10px 14px',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: C.muted,
  marginBottom: 6,
};

function SupportContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState('');
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [memberCode, setMemberCode] = useState('');
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [tokenEmail, setTokenEmail] = useState(''); // トークンから取得（非表示）
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState(''); // ハニーポット

  useEffect(() => {
    if (!token) { setTokenStatus('invalid'); setTokenError('URLが無効です。'); return; }
    fetch(`/api/support/validate?token=${token}`)
      .then(r => r.json())
      .then(j => {
        if (j.valid) { setTokenStatus('valid'); setTokenEmail(j.email ?? ''); }
        else { setTokenStatus('invalid'); setTokenError(j.error ?? 'URLが無効です。'); }
      })
      .catch(() => { setTokenStatus('invalid'); setTokenError('確認中にエラーが発生しました。'); });

    fetch('/api/players?affiliations=1')
      .then(r => r.json())
      .then(j => { if (j.affiliations) setAffiliations(j.affiliations); })
      .catch(() => {});
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return; // ボット除外
    if (!memberCode.trim() || !name.trim() || !body.trim()) {
      setSubmitError('必須項目をすべて入力してください');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/support/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, member_code: memberCode.trim(), name: name.trim(), affiliation: affiliation || null, email: tokenEmail, body: body.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setSubmitError(json.error ?? '送信に失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenStatus === 'checking') {
    return <LoadingOverlay show message="確認中..." />;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
      <LoadingOverlay show={submitting} message="送信中..." />
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, color: C.gold, fontWeight: 700 }}>クレー射撃 成績管理システム</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>お問い合わせフォーム</p>
        </div>

        {tokenStatus === 'invalid' && (
          <div style={{ background: C.surface, border: `2px solid ${C.red}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <p style={{ color: '#e74c3c', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{tokenError}</p>
            <p style={{ color: C.muted, fontSize: 13 }}>システム管理者にお問い合わせください。</p>
          </div>
        )}

        {tokenStatus === 'valid' && !submitted && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: C.gold }}>質問フォーム</h2>
            <form onSubmit={handleSubmit}>
              {/* ハニーポット（非表示） */}
              <input
                type="text"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>会員番号 <span style={{ color: '#e74c3c' }}>*</span></label>
                <input style={inputStyle} value={memberCode} onChange={e => setMemberCode(e.target.value)} placeholder="例: 12345" required />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>氏名 <span style={{ color: '#e74c3c' }}>*</span></label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="例: 山田 太郎" required />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>所属協会</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={affiliation}
                  onChange={e => setAffiliation(e.target.value)}
                >
                  <option value="">選択してください（任意）</option>
                  {affiliations.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>


              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>質問内容 <span style={{ color: '#e74c3c' }}>*</span></label>
                <textarea
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="ご質問内容を入力してください"
                  required
                />
              </div>

              {submitError && (
                <div style={{ background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
                  ⚠ {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ width: '100%', background: C.gold, color: '#000', border: 'none', borderRadius: 8, padding: '12px', fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
              >
                質問を送信する
              </button>
            </form>
          </div>
        )}

        {submitted && (
          <div style={{ background: C.surface, border: `2px solid ${C.green}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, color: '#2ecc71' }}>質問を送信しました</h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 8 }}>ご質問の確認メールをお送りしました。</p>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
              jpn.clayshooting@gmail.com からメールをお送りしました。<br />
              見当たらない場合は、迷惑メールフォルダを探してください。
            </p>
            <p style={{ color: C.muted, fontSize: 13 }}>
              回答が届きましたら、ご登録のメールアドレスにお知らせします。
            </p>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>よくある質問はこちらで検索できます</p>
          <a href="/faq" style={{ color: C.gold, fontSize: 14, textDecoration: 'underline' }}>Q&A一覧を見る →</a>
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<LoadingOverlay show message="読み込み中..." />}>
      <SupportContent />
    </Suspense>
  );
}
