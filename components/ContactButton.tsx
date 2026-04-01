'use client';

import { useState } from 'react';
import { C } from '@/lib/colors';

export default function ContactButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function handleOpen() {
    setOpen(true);
    setEmail('');
    setSending(false);
    setDone(false);
    setError('');
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/support/request-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setDone(true);
      } else {
        setError(json.error ?? '送信に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました。しばらく経ってから再度お試しください。');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Q&Aボタン */}
      <a
        href="/faq"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'transparent',
          color: C.muted,
          border: `1px solid ${C.border}`,
          borderRadius: 5,
          padding: '4px 12px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
          display: 'inline-block',
          lineHeight: '1.6',
        }}
      >
        Q&amp;A
      </a>

      {/* お問合せボタン */}
      <button
        onClick={handleOpen}
        style={{
          background: 'transparent',
          color: C.text,
          border: `1px solid ${C.red}`,
          borderRadius: 5,
          padding: '4px 12px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        お問合せ
      </button>

      {/* モーダル */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 32,
            width: '100%',
            maxWidth: 440,
            position: 'relative',
          }}>
            <button
              onClick={handleClose}
              style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>

            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: C.gold, fontWeight: 700 }}>お問合せ</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              メールアドレスを入力すると、質問用のURLをお送りします。
            </p>

            {!done ? (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                    メールアドレス <span style={{ color: '#e74c3c' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="例: example@email.com"
                    required
                    autoFocus
                    style={{
                      background: C.inputBg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.text,
                      padding: '10px 14px',
                      fontSize: 15,
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                {error && (
                  <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                    ⚠ {error}
                  </div>
                )}

                <div style={{ background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                    ※ メール内のURLは 「１時間」 以内・1回のみ有効です。<br />
                    ※ jpn.clayshooting@gmail.com からメールをお送りします。<br />
                    　 見当たらない場合は、迷惑メールフォルダをご確認ください。
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    disabled={sending}
                    style={{
                      flex: 1,
                      background: C.gold,
                      color: '#000',
                      border: 'none',
                      borderRadius: 6,
                      padding: '11px',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: sending ? 0.7 : 1,
                    }}
                  >
                    {sending ? '送信中...' : '送信する'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      background: 'transparent',
                      color: C.muted,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: '11px 18px',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ color: '#2ecc71', fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
                  メールを送信しました
                </p>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 6, lineHeight: 1.7 }}>
                  {email} 宛にURLをお送りしました。<br />
                  メール内のURLから質問フォームへアクセスしてください。
                </p>
                <p style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>
                  見当たらない場合は、迷惑メールフォルダをご確認ください。
                </p>
                <button
                  onClick={handleClose}
                  style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
