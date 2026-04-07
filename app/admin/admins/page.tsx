'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';
import ContactButton from '@/components/ContactButton';
import Footer from '@/components/Footer';

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
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [filterAffiliation, setFilterAffiliation] = useState<string>('');
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

  // 招待QRコード
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // パスワード表示切替
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const isSystem = session?.user?.role === 'system';
  const myCode = session?.user?.member_code;
  const myAffiliation = session?.user?.affiliation ?? null;

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

  const fetchAffiliations = useCallback(async () => {
    try {
      const res = await fetch('/api/players?affiliations=1');
      const json = await res.json();
      if (json.affiliations) setAffiliations(json.affiliations);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAdmins();
      fetchAffiliations();
      // 大会管理者は自所属協会を固定
      if (!isSystem && myAffiliation) setFilterAffiliation(myAffiliation);
    }
  }, [status, fetchAdmins, fetchAffiliations, isSystem, myAffiliation]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (newPassword.length < 8 || newPassword.length > 32) { setCreateError('パスワードは8〜32文字で入力してください'); return; }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { setCreateError('パスワードは英字と数字を各1文字以上含めてください'); return; }
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
    if (editPassword) {
      if (editPassword.length < 8 || editPassword.length > 32) { setEditError('パスワードは8〜32文字で入力してください'); return; }
      if (!/[a-zA-Z]/.test(editPassword) || !/[0-9]/.test(editPassword)) { setEditError('パスワードは英字と数字を各1文字以上含めてください'); return; }
    }
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

  async function handleIssueQR() {
    setQrLoading(true);
    setQrToken(null);
    try {
      const res = await fetch('/api/admin/invitations', { method: 'POST' });
      const json = await res.json();
      if (json.success) setQrToken(json.token);
    } finally {
      setQrLoading(false);
    }
  }

  function getRegisterUrl(token: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://clay-shooting.vercel.app';
    return `${origin}/admin/register?token=${token}`;
  }

  async function handleCopyUrl(token: string) {
    await navigator.clipboard.writeText(getRegisterUrl(token));
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  // 所属協会フィルタ適用
  const filteredAdmins = filterAffiliation
    ? admins.filter(a => (a.current_affiliation ?? '') === filterAffiliation)
    : admins;

  const anyModalOpen = !!editAdmin;

  if (status === 'loading') return <LoadingOverlay show message="読み込み中..." />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <LoadingOverlay show={loading || saving || qrLoading} message={qrLoading ? 'QRコード発行中...' : saving ? '処理中...' : '読み込み中...'} />

      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', pointerEvents: anyModalOpen ? 'none' as const : 'auto' as const }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 12px', fontSize: 15, cursor: 'pointer' }}>
          ← 大会一覧
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.gold, flex: 1 }}>
          運営管理者マスター
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ContactButton />
          {session?.user && (
            <>
              <span style={{ fontSize: 13, color: C.muted }}>{session.user.name ?? session.user.email}</span>
              <span style={{ background: isSystem ? `${C.gold}33` : `${C.blue2}33`, color: isSystem ? C.gold : C.blue2, border: `1px solid ${isSystem ? C.gold : C.blue2}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                {isSystem ? 'システム管理者' : '運営管理者'}
              </span>
            </>
          )}
          <button onClick={() => signOut({ callbackUrl: '/admin/login' })} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            ログアウト
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 16px' }}>
        <div style={{ pointerEvents: anyModalOpen ? 'none' as const : 'auto' as const }}>
        {error && <div style={{ background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>{error}</div>}

        {/* 上部ボタン行 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {isSystem && (
            <button onClick={() => setShowCreate(!showCreate)} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '9px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              ＋ 運営管理者を追加
            </button>
          )}
          <button onClick={handleIssueQR} disabled={qrLoading} style={{ background: `${C.blue2}22`, color: C.blue2, border: `1px solid ${C.blue2}`, borderRadius: 6, padding: '9px 20px', fontWeight: 700, fontSize: 15, cursor: qrLoading ? 'not-allowed' : 'pointer', opacity: qrLoading ? 0.7 : 1 }}>
            {qrLoading ? '発行中...' : '📱 招待QRコードを発行'}
          </button>
        </div>

        {/* QRコード表示 */}
        {qrToken && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.gold }}>運営管理者 招待QRコード</p>
            <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
              <QRCodeSVG value={getRegisterUrl(qrToken)} size={180} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480 }}>
              <input readOnly value={getRegisterUrl(qrToken)} style={{ ...inputStyle, fontSize: 11, flex: 1 }} />
              <button onClick={() => handleCopyUrl(qrToken)} style={{ background: copyDone ? '#2ecc7133' : C.surface2, color: copyDone ? '#2ecc71' : C.text, border: `1px solid ${C.border}`, borderRadius: 5, padding: '8px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {copyDone ? '✓ コピー済み' : 'URLをコピー'}
              </button>
            </div>
            <div style={{ background: `${C.gold}11`, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: '10px 16px', maxWidth: 480, width: '100%' }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                ⚠️ 使用期限24時間、利用者は1名に限定します。<br />
                複数名を登録する場合は人数分、QRコードを発行してください。
              </p>
            </div>
            <button onClick={() => setQrToken(null)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 16px', fontSize: 13, cursor: 'pointer' }}>
              閉じる
            </button>
          </div>
        )}

        {/* 新規作成フォーム */}
        {showCreate && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>新規運営管理者</h3>
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
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>初期パスワード（8〜32文字、英字+数字）*</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inputStyle, paddingRight: 40 }} type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowNewPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: 0 }}>
                      {showNewPassword ? '🙈' : '👁'}
                    </button>
                  </div>
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

        {/* 所属協会フィルタ */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>所属協会で絞り込み：</label>
          {isSystem ? (
            <select
              value={filterAffiliation}
              onChange={e => setFilterAffiliation(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
            >
              <option value="">全て</option>
              {affiliations.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 14, color: C.text, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 12px' }}>
              {myAffiliation ?? '—'}
            </span>
          )}
        </div>

        {/* 管理者一覧テーブル */}
        {!loading && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: C.surface2 }}>
                  <th style={th}>会員番号</th>
                  <th style={{ ...th, position: 'sticky' as const, left: 0, zIndex: 2, background: C.surface2 }}>氏名</th>
                  <th style={th}>メール</th>
                  <th style={th}>現在の所属協会</th>
                  <th style={th}>状態</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.muted }}>登録なし</td></tr>
                ) : filteredAdmins.map(a => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}33`, background: a.member_code === myCode ? `${C.gold}11` : 'transparent' }}>
                    <td style={td}>{a.member_code}</td>
                    <td style={{ ...td, fontWeight: 500, position: 'sticky' as const, left: 0, zIndex: 1, background: a.member_code === myCode ? `#e8a02011` : C.surface }}>{a.name}</td>
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
        </div>

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
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>新しいパスワード（変更する場合のみ、8〜32文字、英字+数字）</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inputStyle, paddingRight: 40 }} type={showEditPassword ? 'text' : 'password'} value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="変更しない場合は空欄" />
                    <button type="button" onClick={() => setShowEditPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: 0 }}>
                      {showEditPassword ? '🙈' : '👁'}
                    </button>
                  </div>
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
      <Footer />
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
