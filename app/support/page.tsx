'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';
import Footer from '@/components/Footer';

const inputClass = 'w-full bg-input-bg border border-border rounded-[6px] text-text px-[14px] py-[10px] text-[15px] box-border';
const labelClass = 'block text-[13px] text-muted mb-[6px]';

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
    <div className="min-h-screen bg-bg text-text font-[Arial,sans-serif] flex flex-col">
      <LoadingOverlay show={submitting} message="送信中..." />
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-[520px]">
        <div className="text-center mb-8">
          <h1 className="mt-0 mb-[6px] text-[22px] text-gold font-bold">クレー射撃大会運営システム</h1>
          <p className="m-0 text-[13px] text-muted">お問い合わせフォーム</p>
        </div>

        {tokenStatus === 'invalid' && (
          <div className="bg-surface border-2 border-red rounded-[12px] p-8 text-center">
            <div className="text-[40px] mb-4">⚠️</div>
            <p className="text-[#e74c3c] text-[16px] font-semibold mb-2">{tokenError}</p>
            <p className="text-muted text-[13px]">システム管理者にお問い合わせください。</p>
          </div>
        )}

        {tokenStatus === 'valid' && !submitted && (
          <div className="bg-surface border border-border rounded-[12px] p-8">
            <h2 className="mt-0 mb-5 text-[18px] text-gold">質問フォーム</h2>
            <form onSubmit={handleSubmit}>
              {/* ハニーポット（非表示） */}
              <input
                type="text"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="mb-4">
                <label className={labelClass}>会員番号 <span className="text-[#e74c3c]">*</span></label>
                <input className={inputClass} value={memberCode} onChange={e => setMemberCode(e.target.value)} placeholder="例: 12345" required />
              </div>

              <div className="mb-4">
                <label className={labelClass}>氏名 <span className="text-[#e74c3c]">*</span></label>
                <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="例: 山田 太郎" required />
              </div>

              <div className="mb-4">
                <label className={labelClass}>所属協会</label>
                <select
                  className={`${inputClass} cursor-pointer`}
                  value={affiliation}
                  onChange={e => setAffiliation(e.target.value)}
                >
                  <option value="">選択してください（任意）</option>
                  {affiliations.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>


              <div className="mb-5">
                <label className={labelClass}>質問内容 <span className="text-[#e74c3c]">*</span></label>
                <textarea
                  className={`${inputClass} min-h-[140px] resize-y leading-[1.6]`}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="ご質問内容を入力してください"
                  required
                />
              </div>

              {submitError && (
                <div className="bg-[#ff4d4d22] border border-red text-[#e74c3c] rounded-[6px] px-[14px] py-[10px] mb-4 text-[14px]">
                  ⚠ {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold text-black border-0 rounded-[8px] p-3 text-[16px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                質問を送信する
              </button>
            </form>
          </div>
        )}

        {submitted && (
          <div className="bg-surface border-2 border-green rounded-[12px] p-10 text-center">
            <div className="text-[48px] mb-4">✅</div>
            <h2 className="mt-0 mb-3 text-[20px] text-[#2ecc71]">質問を送信しました</h2>
            <p className="text-muted text-[14px] mb-2">ご質問の確認メールをお送りしました。</p>
            <p className="text-muted text-[13px] mb-6">
              jpn.clayshooting@gmail.com からメールをお送りしました。<br />
              見当たらない場合は、迷惑メールフォルダを探してください。
            </p>
            <p className="text-muted text-[13px]">
              回答が届きましたら、ご登録のメールアドレスにお知らせします。
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-muted text-[13px] mb-2">よくある質問はこちらで検索できます</p>
          <a href="/faq" className="text-gold text-[14px] underline">Q&A一覧を見る →</a>
        </div>
        </div>
      </div>
      <Footer />
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
