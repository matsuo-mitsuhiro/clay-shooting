'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';

interface TournamentAdmin {
  id: number;
  member_code: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  current_affiliation: string | null;
}

const inputStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: `1px solid ${C.border}`,
  borderRadius: 5,
  color: C.text,
  padding: '8px 10px',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
};

export default function AdminsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [admins, setAdmins] = useState<TournamentAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新規作成フォーム
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // 編集モーダル
  const [editAdmin, setEditAdmin] = useState<TournamentAdmin | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  const isSystem = session?.user?.role === 'system';
  const myCode = session?.user?.member_code;

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins');
      const json = await res.json();
      if (json.success) setAdmins(json.data);
      else setError(json.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchAdmins();
  }, [status, fetchAdmins]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_code: newCode, name: newName, email: newEmail, password: newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewCode(''); setNewName(''); setNewEmail(''); setNewPassword('');
        await fetchAdmins();
      } else {
        setCreateError(json.error);
      }
    } finally {
      setSaving(false);
    }
  }

  function openEdit(a: TournamentAdmin) {
    setEditAdmin(a);
    setEditEmail(a.email);
    setEditPassword('');
    setEditActive(a.is_active);
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAdmin) return;
    setEditError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = { id: editAdmin.id, email: editEmail, is_active: editActive };
      if (editPassword) body.password = editPassword;
      const res = await fetch('/api/admin/admins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setEditAdmin(null);
        await fetchAdmins();
      } else {
        setEditError(json.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await fetch('/api/admin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await fetchAdmins();
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <LoadingOverlay show message="読み込み中..." />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <LoadingOverlay show={loading || saving} message={saving ? '処理中...' : '読み込み中...'} />

      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 12px', fontSize: 15, cursor: 'pointer' }}>
          ← 大会一覧
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.gold }}>
          {isSystem ? '大会管理者マスター' : 'アカウント設定'}
        </h1>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px' }}>
        {error && (
          <div style={{ background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* 新規作成ボタン（システム管理者のみ） */}
        {isSystem && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowCreate(!showCreate)}
              style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '9px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              ＋ 大会管理者を追加
            </button>
          </div>
        )}

        {/* 新規作成フォーム */}
        {showCreate && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>新規大会管理者</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>会員番号 *</label>
                  <input style={inputStyle} value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="例: 12345" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>氏名 *</label>
                  <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="例: 山田 太郎" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>メールアドレス *</label>
                  <input style={inputStyle} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>初期パスワード（8文字以上）*</label>
                  <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
              </div>
              {createError && <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 10 }}>⚠ {createError}</div>}
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button type="submit" style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }}>作成</button>
                <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '8px 16px', cursor: 'pointer' }}>キャンセル</button>
              </div>
            </form>
          </div>
        )}

        {/* 管理者一覧テーブル */}
        {!loading && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.surface2 }}>
                  <th style={th}>会員番号</th>
                  <th style={th}>氏名</th>
                  <th style={th}>メール</th>
                  <th style={th}>現在の所属</th>
                  <th style={th}>状態</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.muted }}>登録なし</td></tr>
                ) : admins.map(a => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}33`, background: a.member_code === myCode ? `${C.gold}11` : 'transparent' }}>
                    <td style={td}>{a.member_code}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{a.name}</td>
                    <td style={{ ...td, fontSize: 13 }}>{a.email}</td>
                    <td style={{ ...td, color: C.muted }}>{a.current_affiliation ?? '—'}</td>
                    <td style={td}>
                      <span style={{ background: a.is_active ? '#2ecc7133' : `${C.red}33`, color: a.is_active ? '#2ecc71' : '#e74c3c', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                        {a.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td style={td}>
                      {(isSystem || a.member_code === myCode) && (
                        <button onClick={() => openEdit(a)} style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 12px', fontSize: 13, cursor: 'pointer', marginRight: 6 }}>
                          編集
                        </button>
                      )}
                      {isSystem && (
                        <button onClick={() => handleDelete(a.id, a.name)} style={{ background: `${C.red}22`, color: '#e74c3c', border: `1px solid ${C.red}44`, borderRadius: 4, padding: '4px 12px', fontSize: 13, cursor: 'pointer' }}>
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 編集モーダル */}
        {editAdmin && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: '100%', maxWidth: 420 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, color: C.gold }}>{editAdmin.name} を編集</h3>
              <form onSubmit={handleEdit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>メールアドレス</label>
                  <input style={inputStyle} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>新しいパスワード（変更する場合のみ、8文字以上）</label>
                  <input style={inputStyle} type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="変更しない場合は空欄" />
                </div>
                {isSystem && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: C.muted }}>
                      <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.gold }} />
                      有効
                    </label>
                  </div>
                )}
                {editError && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 10 }}>⚠ {editError}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '9px 22px', fontWeight: 700, cursor: 'pointer' }}>保存</button>
                  <button type="button" onClick={() => setEditAdmin(null)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 16px', cursor: 'pointer' }}>キャンセル</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13, color: C.muted, fontWeight: 600,
  textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px 12px', fontSize: 14, textAlign: 'left', whiteSpace: 'nowrap',
};
