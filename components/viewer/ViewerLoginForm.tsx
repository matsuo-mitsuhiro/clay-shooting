'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';

interface Props {
  tournamentId: number;
  tournamentName: string;
  onLoginSuccess: (name: string, belong: string) => void;
}

export default function ViewerLoginForm({ tournamentId, tournamentName, onLoginSuccess }: Props) {
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [belong, setBelong] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAff, setLoadingAff] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/members`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const belongs = Array.from(
            new Set(
              (j.data as { belong?: string | null }[])
                .map(m => m.belong)
                .filter(Boolean)
            )
          ) as string[];
          setAffiliations(belongs.sort());
        }
      })
      .finally(() => setLoadingAff(false));
  }, [tournamentId]);

  async function handleLogin() {
    if (!name.trim()) {
      setError('氏名を入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/viewer-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          belong: belong || null,
          name: name.trim(),
          userAgent: navigator.userAgent,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onLoginSuccess(name.trim(), belong);
      } else {
        setError('該当者が存在しないため閲覧できません');
      }
    } catch {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
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

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', padding: '24px',
    }}>
      <LoadingOverlay show={loading} message="確認中..." />

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, color: C.gold, fontWeight: 700 }}>
          成績確認
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: C.muted }}>
          {tournamentName}
        </p>

        <p style={{ margin: '0 0 20px', fontSize: 15, color: C.text }}>
          以下を入力してログインしてください
        </p>

        {/* 所属 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>
            所属
          </label>
          {loadingAff ? (
            <div style={{ color: C.muted, fontSize: 14 }}>読み込み中...</div>
          ) : (
            <select
              value={belong}
              onChange={e => setBelong(e.target.value)}
              style={inputStyle}
            >
              <option value="">— 選択してください —</option>
              {affiliations.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
        </div>

        {/* 氏名 */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>
            氏名 <span style={{ color: C.red }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={inputStyle}
            placeholder="例：松尾"
            autoFocus
          />
          <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>
            名前の一部でも入力できます（例：「松尾」→「松尾 充泰」にマッチ）
          </p>
        </div>

        {/* エラー */}
        {error && (
          <div style={{
            background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
            borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14, fontWeight: 600,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ログインボタン */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', background: C.gold, color: '#000',
            border: 'none', borderRadius: 8, padding: '13px',
            fontSize: 17, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          成績を確認する →
        </button>
      </div>
    </div>
  );
}
