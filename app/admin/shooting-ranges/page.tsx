'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { C } from '@/lib/colors';
import type { ShootingRange } from '@/lib/types';
import Footer from '@/components/Footer';
import { ErrorModal } from '@/components/ModalDialog';

interface GroupedRanges {
  [prefecture: string]: ShootingRange[];
}

export default function ShootingRangesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSystem = session?.user?.role === 'system';

  const [ranges, setRanges] = useState<ShootingRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newPrefecture, setNewPrefecture] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetchRanges();
  }, []);

  async function fetchRanges() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/shooting-ranges');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRanges(json.data as ShootingRange[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newPrefecture.trim() || !newName.trim()) {
      setAddError('都道府県名と射撃場名は必須です');
      return;
    }
    try {
      setAdding(true);
      setAddError(null);
      const res = await fetch('/api/shooting-ranges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefecture: newPrefecture.trim(), name: newName.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setNewPrefecture('');
      setNewName('');
      setShowForm(false);
      await fetchRanges();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '追加に失敗しました');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return;
    try {
      const res = await fetch(`/api/shooting-ranges/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchRanges();
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  // 都道府県ごとにグループ化
  const grouped: GroupedRanges = {};
  for (const r of ranges) {
    if (!grouped[r.prefecture]) grouped[r.prefecture] = [];
    grouped[r.prefecture].push(r);
  }

  const inputStyle: React.CSSProperties = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    padding: '8px 10px',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: 0 }}
        >
          ← 戻る
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.gold }}>
          射撃場マスター
        </h1>
        {isSystem && (
          <button
            onClick={() => { setShowForm(!showForm); setAddError(null); }}
            style={{
              marginLeft: 'auto',
              background: C.gold,
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ＋ 追加
          </button>
        )}
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        {error && (
          <ErrorModal message={error} onClose={() => setError(null)} />
        )}

        {/* 追加フォーム */}
        {isSystem && showForm && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 20, marginBottom: 20,
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: C.gold }}>射撃場を追加</h3>
            {addError && (
              <div style={{
                background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13,
              }}>{addError}</div>
            )}
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>
                    都道府県名 <span style={{ color: C.red }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newPrefecture}
                    onChange={e => setNewPrefecture(e.target.value)}
                    placeholder="例: 大阪府"
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 4 }}>
                    射撃場名 <span style={{ color: C.red }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="例: ○○国際射撃場"
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={adding}
                  style={{
                    background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                    padding: '7px 18px', fontWeight: 700, fontSize: 14,
                    cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.7 : 1,
                  }}
                >
                  {adding ? '追加中...' : '追加する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setAddError(null); }}
                  style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 5, padding: '7px 14px', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>読み込み中...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '40px', textAlign: 'center', color: C.muted,
          }}>
            射撃場が登録されていません。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(grouped).map(([prefecture, prefRanges]) => (
              <div
                key={prefecture}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  background: C.surface2,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.gold,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {prefecture}
                </div>
                <div>
                  {prefRanges.map((r, idx) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: idx < prefRanges.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 14, color: C.text }}>{r.name}</span>
                      {isSystem && (
                        <button
                          onClick={() => handleDelete(r.id, r.name)}
                          style={{
                            background: 'transparent',
                            color: C.red,
                            border: `1px solid ${C.red}`,
                            borderRadius: 4,
                            padding: '3px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
