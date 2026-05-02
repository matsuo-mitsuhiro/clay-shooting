'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';
import Footer from '@/components/Footer';
import { ErrorModal } from '@/components/ModalDialog';

function AdminLoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/admin';
  const prefilledCode = searchParams.get('member_code') ?? '';

  const [memberCode, setMemberCode] = useState(prefilledCode);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSystemLogin, setShowSystemLogin] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      // システム管理者は callbackUrl を無視して常に /admin
      const target = session?.user?.role === 'system' ? '/admin' : callbackUrl;
      router.push(target);
    }
  }, [status, router, callbackUrl, session]);

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!memberCode.trim() || !password) {
      setError('会員番号とパスワードを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('tournament-admin', {
        member_code: memberCode.trim(),
        password,
        userAgent: navigator.userAgent,
        redirect: false,
      });
      if (result?.error) {
        setError('会員番号またはパスワードが正しくありません');
      } else {
        router.push(callbackUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    // システム管理者は常に /admin に遷移
    await signIn('google', { callbackUrl: '/admin' });
  }

  const inputStyle: React.CSSProperties = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: C.text,
    padding: '10px 14px',
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };

  if (status === 'loading') {
    return <LoadingOverlay show message="読み込み中..." />;
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', padding: 24,
    }}>
      <LoadingOverlay show={loading} message="ログイン中..." />

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, color: C.gold, fontWeight: 700 }}>
          管理者ログイン
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 13, color: C.muted }}>
          クレー射撃大会運営システム
        </p>

        {/* 運営管理者：会員番号＋パスワード */}
        <div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: C.muted, fontWeight: 600 }}>
            運営管理者
          </p>
          <form onSubmit={handleCredentialsLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                会員番号
              </label>
              <input
                type="text"
                value={memberCode}
                onChange={e => { setMemberCode(e.target.value); setError(null); }}
                style={inputStyle}
                placeholder="例: 12345"
                autoComplete="username"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>
                パスワード
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0 }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <ErrorModal message={error} onClose={() => setError(null)} />
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: C.gold, color: '#000',
                border: 'none', borderRadius: 8, padding: '12px',
                fontSize: 16, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              ログイン
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Link href="/admin/forgot-password" style={{ color: C.muted, fontSize: 13, textDecoration: 'underline' }}>
                パスワードをお忘れの方はこちら
              </Link>
            </div>
          </form>
        </div>

        {/* システム管理者ログイン（控えめリンク） */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          {showSystemLogin ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  width: '100%', background: '#fff', color: '#333',
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '11px 16px', fontSize: 15, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Googleアカウントでログイン
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSystemLogin(true)}
              style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', opacity: 0.6 }}
            >
              システム管理者の方はこちら
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoadingOverlay show message="読み込み中..." />}>
      <AdminLoginContent />
      <Footer />
    </Suspense>
  );
}
