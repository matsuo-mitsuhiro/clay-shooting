'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      setDone(true);
    } catch {
      setError('エラーが発生しました');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ color: C.gold, fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
          クレー射撃 成績管理システム
        </h1>
        <p style={{ color: '#aaa', textAlign: 'center', marginBottom: 32 }}>パスワードをお忘れの方</p>

        {done ? (
          <div style={{ background: '#1a2a1a', border: '1px solid #4caf50', borderRadius: 8, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <p style={{ fontSize: 15, marginBottom: 8 }}>リセット用メールを送信しました。</p>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>1時間以内にメール内のURLをクリックしてください。</p>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 24 }}>
              jpn.clayshooting@gmail.com からメールをお送りしました。<br />
              見当たらない場合は、迷惑メールフォルダを探してください。
            </p>
            <button onClick={() => router.push('/admin/login')} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ログイン画面に戻る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 10, padding: 28 }}>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>登録済みのメールアドレスを入力してください。パスワードリセット用のURLをお送りします。</p>
            <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ background: '#1a1a2e', border: '1px solid #444', borderRadius: 5, color: '#fff', padding: '10px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box', marginBottom: 16 }}
            />
            {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={sending} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '11px', fontSize: 15, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', width: '100%', marginBottom: 12, opacity: sending ? 0.7 : 1 }}>
              {sending ? '送信中...' : 'リセットメールを送信'}
            </button>
            <button type="button" onClick={() => router.push('/admin/login')} style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: 6, padding: '10px', fontSize: 14, cursor: 'pointer', width: '100%' }}>
              ログイン画面に戻る
            </button>
          </form>
        )}
      </div>
      <LoadingOverlay show={sending} message="送信中..." />
    </div>
  );
}
