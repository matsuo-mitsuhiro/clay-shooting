'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';
import Footer from '@/components/Footer';
import { ErrorModal } from '@/components/ModalDialog';

const inputStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: `1px solid #444`,
  borderRadius: 5,
  color: '#fff',
  padding: '10px 12px',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
};

function RegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [memberCode, setMemberCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError('招待リンクが無効です'); setChecking(false); return; }
    fetch(`/api/admin/register?token=${token}`)
      .then(r => r.json())
      .then(j => {
        if (!j.success) setTokenError(j.error);
      })
      .catch(() => setTokenError('エラーが発生しました'))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) { setError('パスワードが一致しません'); return; }
    if (password.length < 8 || password.length > 32) { setError('パスワードは8〜32文字で入力してください'); return; }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('パスワードは英字と数字を各1文字以上含めてください'); return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, member_code: memberCode, name, email, password }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      setDone(true);
    } catch {
      setError('登録に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (checking) return <LoadingOverlay show message="確認中..." />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <h1 style={{ color: C.gold, fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
          クレー射撃大会運営システム
        </h1>
        <p style={{ color: '#aaa', textAlign: 'center', marginBottom: 32 }}>運営管理者 新規登録</p>

        {tokenError ? (
          <div style={{ background: '#2a1a1a', border: `1px solid ${C.red}`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: C.red, fontSize: 16 }}>{tokenError}</p>
          </div>
        ) : done ? (
          <div style={{ background: '#1a2a1a', border: `1px solid #4caf50`, borderRadius: 8, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>登録が完了しました</p>
            <p style={{ color: '#aaa', marginBottom: 8 }}>登録完了メールをご確認ください。</p>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 24 }}>
              jpn.clayshooting@gmail.com からメールをお送りしました。<br />
              見当たらない場合は、迷惑メールフォルダを探してください。
            </p>
            <button onClick={() => router.push('/admin/login?member_code=' + encodeURIComponent(memberCode))} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              ログイン画面へ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#1a1a2e', border: `1px solid #333`, borderRadius: 10, padding: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>会員番号 <span style={{ color: C.red }}>*</span></label>
                <input value={memberCode} onChange={e => setMemberCode(e.target.value)} required style={inputStyle} placeholder="例: 12345" />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>氏名 <span style={{ color: C.red }}>*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="例: 山田 太郎" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>メールアドレス <span style={{ color: C.red }}>*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>パスワード <span style={{ color: C.red }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0 }}>{showPassword ? '🙈' : '👁'}</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#aaa', display: 'block', marginBottom: 6 }}>パスワード（確認）<span style={{ color: C.red }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ ...inputStyle, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0 }}>{showConfirmPassword ? '🙈' : '👁'}</button>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>8〜32文字、英字と数字を各1文字以上含む</p>

            {error && (
              <ErrorModal
                message={error.includes('既に登録されています')
                  ? `${error}\n\nパスワードをお忘れの場合は、ログイン画面からリセットしてください。\nまたは、登録済みのアカウントを別の管理者に依頼して削除してください。`
                  : error}
                onClose={() => setError(null)}
              />
            )}

            <button type="submit" disabled={saving} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '12px', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', width: '100%', opacity: saving ? 0.7 : 1 }}>
              {saving ? '登録中...' : '登録する'}
            </button>
          </form>
        )}
      </div>
      <LoadingOverlay show={saving} message="登録中..." />
      <Footer />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingOverlay show message="読み込み中..." />}>
      <RegisterContent />
    </Suspense>
  );
}
