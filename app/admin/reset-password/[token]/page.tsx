'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      fetch(`/api/admin/password-reset/${p.token}`)
        .then(r => r.json())
        .then(j => { if (!j.success) setTokenError(j.error); })
        .catch(() => setTokenError('エラーが発生しました'))
        .finally(() => setChecking(false));
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('パスワードが一致しません'); return; }
    if (password.length < 8 || password.length > 32) { setError('パスワードは8〜32文字で入力してください'); return; }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setError('パスワードは英字と数字を各1文字以上含めてください'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/password-reset/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      setDone(true);
    } catch {
      setError('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { background: '#1a1a2e', border: '1px solid #444', borderRadius: 5, color: '#fff', padding: '10px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box' };

  if (checking) return <LoadingOverlay show message="確認中..." />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ color: C.gold, fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
          クレー射撃 成績管理システム
        </h1>
        <p style={{ color: '#aaa', textAlign: 'center', marginBottom: 32 }}>新しいパスワードの設定</p>

        {tokenError ? (
          <div style={{ background: '#2a1a1a', border: `1px solid ${C.red}`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: C.red, marginBottom: 20 }}>{tokenError}</p>
            <button onClick={() => router.push('/admin/forgot-password')} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              再度リセットを申請する
            </button>
          </div>
        ) : done ? (
          <div style={{ background: '#1a2a1a', border: '1px solid #4caf50', borderRadius: 8, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>パスワードを変更しました</p>
            <button onClick={() => router.push('/admin/login')} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ログイン画面へ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 10, padding: 28 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>新しいパスワード <span style={{ color: C.red }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0 }}>{showPassword ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>パスワード（確認）<span style={{ color: C.red }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0 }}>{showConfirmPassword ? '🙈' : '👁'}</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>8〜32文字、英字と数字を各1文字以上含む</p>
            {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={saving} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '11px', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', width: '100%', opacity: saving ? 0.7 : 1 }}>
              {saving ? '変更中...' : 'パスワードを変更する'}
            </button>
          </form>
        )}
      </div>
      <LoadingOverlay show={saving} message="変更中..." />
    </div>
  );
}
