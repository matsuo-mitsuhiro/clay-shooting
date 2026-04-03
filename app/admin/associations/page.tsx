'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { C } from '@/lib/colors';
import type { Association, ShootingRange } from '@/lib/types';

interface AssociationWithRanges extends Association {
  shooting_range_ids: number[];
}

interface GroupedRanges {
  [prefecture: string]: ShootingRange[];
}

export default function AssociationsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSystem = session?.user?.role === 'system';
  const userAffiliation = session?.user?.affiliation ?? null;

  const [associations, setAssociations] = useState<Association[]>([]);
  const [allRanges, setAllRanges] = useState<ShootingRange[]>([]);
  const [selectedCd, setSelectedCd] = useState<number | null>(null);
  const [editData, setEditData] = useState<AssociationWithRanges | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/associations').then(r => r.json()),
      fetch('/api/shooting-ranges').then(r => r.json()),
    ]).then(([assocJson, rangesJson]) => {
      if (assocJson.success) setAssociations(assocJson.data as Association[]);
      if (rangesJson.success) setAllRanges(rangesJson.data as ShootingRange[]);
      setLoading(false);

      // tournament adminは自協会を自動選択
      if (!isSystem && userAffiliation && assocJson.success) {
        const found = (assocJson.data as Association[]).find(a => a.name === userAffiliation);
        if (found) handleSelect(found.cd, assocJson.data as Association[]);
      }
    }).catch(() => {
      setError('データの取得に失敗しました');
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(cd: number, assocList?: Association[]) {
    setSelectedCd(cd);
    setError(null);
    setSuccess(null);
    // スマホの場合は詳細ビューへ切り替え
    if (window.innerWidth < 768) setMobileView('detail');
    try {
      const res = await fetch(`/api/associations/${cd}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setEditData(json.data as AssociationWithRanges);
    } catch (e) {
      setError(e instanceof Error ? e.message : '協会データの取得に失敗しました');
      const list = assocList ?? associations;
      const assoc = list.find(a => a.cd === cd);
      if (assoc) {
        setEditData({ ...assoc, shooting_range_ids: [] });
      }
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editData) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch(`/api/associations/${editData.cd}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellation_notice: editData.cancellation_notice || null,
          notes: editData.notes || null,
          shooting_range_ids: editData.shooting_range_ids,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess('保存しました');
      setTimeout(() => setSuccess(null), 3000);
      setAssociations(prev => prev.map(a =>
        a.cd === editData.cd
          ? { ...a, cancellation_notice: editData.cancellation_notice, notes: editData.notes }
          : a
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  function toggleRange(id: number) {
    if (!editData) return;
    const ids = editData.shooting_range_ids;
    setEditData({
      ...editData,
      shooting_range_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    });
  }

  // 射撃場を都道府県ごとにグループ化
  const groupedRanges: GroupedRanges = {};
  for (const r of allRanges) {
    if (!groupedRanges[r.prefecture]) groupedRanges[r.prefecture] = [];
    groupedRanges[r.prefecture].push(r);
  }

  const visibleAssociations = isSystem
    ? associations
    : associations.filter(a => a.name === userAffiliation);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    padding: '8px 10px',
    fontSize: 14,
    boxSizing: 'border-box',
    resize: 'vertical',
  };

  // 射撃場チェックボックスリスト（PC: maxHeight スクロール / スマホ: 全展開）
  const rangesBox = (
    <div style={{
      background: C.surface2,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: 12,
      ...(isMobile ? {} : { maxHeight: 360, overflowY: 'auto' as const }),
    }}>
      {Object.entries(groupedRanges).map(([prefecture, prefRanges]) => (
        <div key={prefecture} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>
            {prefecture}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prefRanges.map(r => (
              <label
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isMobile ? '8px 6px' : '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: editData?.shooting_range_ids.includes(r.id)
                    ? `${C.gold}18` : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={editData?.shooting_range_ids.includes(r.id) ?? false}
                  onChange={() => toggleRange(r.id)}
                  style={{ accentColor: C.gold, cursor: 'pointer', width: 18, height: 18, flexShrink: 0 }}
                />
                <span style={{ fontSize: isMobile ? 15 : 13, color: C.text }}>{r.name}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {Object.keys(groupedRanges).length === 0 && (
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          射撃場マスターにデータがありません
        </p>
      )}
    </div>
  );

  // 編集フォーム本体（PC・スマホ共通）
  const editForm = (
    <>
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14,
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 14,
        }}>{success}</div>
      )}
      {!editData ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '40px', textAlign: 'center', color: C.muted,
        }}>
          {isSystem ? '左の一覧から協会を選択してください' : '協会データを読み込み中...'}
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: isMobile ? 16 : 20, marginBottom: 16,
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: C.gold }}>
              {editData.name} 協会
            </h2>

            {/* 射撃場選択 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                所属射撃場
              </label>
              {rangesBox}
            </div>

            {/* 中止のお知らせ方法 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 4 }}>
                中止のお知らせ方法（400文字以内）
              </label>
              <textarea
                value={editData.cancellation_notice ?? ''}
                onChange={e => setEditData({ ...editData, cancellation_notice: e.target.value || null })}
                maxLength={400}
                rows={4}
                style={inputStyle}
                placeholder="例: 当協会のホームページにて公表いたします。"
              />
              <div style={{ fontSize: 12, color: C.muted, textAlign: 'right', marginTop: 2 }}>
                {(editData.cancellation_notice ?? '').length} / 400
              </div>
            </div>

            {/* 注意書き */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 4 }}>
                注意書き（400文字以内）
              </label>
              <textarea
                value={editData.notes ?? ''}
                onChange={e => setEditData({ ...editData, notes: e.target.value || null })}
                maxLength={400}
                rows={4}
                style={inputStyle}
                placeholder="申込フォームに表示される注意事項を入力"
              />
              <div style={{ fontSize: 12, color: C.muted, textAlign: 'right', marginTop: 2 }}>
                {(editData.notes ?? '').length} / 400
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                background: C.gold, color: '#000', border: 'none', borderRadius: 6,
                padding: '9px 24px', fontWeight: 700, fontSize: 15,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      )}
    </>
  );

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
          onClick={() => {
            // スマホで詳細表示中は一覧に戻る（system admin）
            if (isMobile && isSystem && mobileView === 'detail') {
              setMobileView('list');
            } else {
              router.push('/admin');
            }
          }}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: 0 }}
        >
          ← 戻る
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.gold }}>
          {isMobile && isSystem && mobileView === 'detail' && editData
            ? `${editData.name} 協会`
            : '協会マスター'}
        </h1>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>読み込み中...</div>
        ) : isMobile ? (
          /* ===== スマホレイアウト ===== */
          <>
            {mobileView === 'list' && isSystem ? (
              /* スマホ: 協会一覧 */
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: C.surface2,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.muted,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  協会を選択してください
                </div>
                {visibleAssociations.map(a => (
                  <button
                    key={a.cd}
                    onClick={() => handleSelect(a.cd)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      color: C.text,
                      border: 'none',
                      borderBottom: `1px solid ${C.border}`,
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontSize: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{a.name}</span>
                    <span style={{ color: C.muted }}>→</span>
                  </button>
                ))}
              </div>
            ) : (
              /* スマホ: 詳細 */
              <div>
                {editForm}
              </div>
            )}
          </>
        ) : (
          /* ===== PCレイアウト（既存） ===== */
          <div style={{ display: 'grid', gridTemplateColumns: isSystem ? '260px 1fr' : '1fr', gap: 20 }}>
            {/* 左側: 協会リスト（system adminのみ） */}
            {isSystem && (
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: 'hidden',
                alignSelf: 'start',
              }}>
                <div style={{
                  background: C.surface2,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.muted,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  協会一覧
                </div>
                <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                  {visibleAssociations.map(a => (
                    <button
                      key={a.cd}
                      onClick={() => handleSelect(a.cd)}
                      style={{
                        width: '100%',
                        background: selectedCd === a.cd ? `${C.gold}22` : 'transparent',
                        color: selectedCd === a.cd ? C.gold : C.text,
                        border: 'none',
                        borderBottom: `1px solid ${C.border}`,
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 14,
                        cursor: 'pointer',
                        fontWeight: selectedCd === a.cd ? 700 : 400,
                      }}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 右側: 編集フォーム */}
            <div>
              {editForm}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
