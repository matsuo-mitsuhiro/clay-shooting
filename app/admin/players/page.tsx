'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import { PREFECTURES, DEFAULT_AFFILIATION } from '@/lib/prefectures';
import type { PlayerMaster } from '@/app/api/players/route';
import ContactButton from '@/components/ContactButton';

const CLASSES = ['A', 'B', 'C', 'D', 'E'];

const s = {
  page: { minHeight: '100vh', background: C.bg, color: C.text, padding: '24px', fontFamily: 'sans-serif' } as const,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap' as const, gap: '12px' },
  backBtn: { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '13px', padding: 0 },
  title: { fontSize: '22px', fontWeight: 700, margin: 0 },
  subtitle: { fontSize: '13px', color: C.muted, marginTop: '2px' },
  btnGold: { background: C.gold, color: '#000', border: 'none', borderRadius: '6px', padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' },
  btnGray: { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' },
  btnRed: { background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' as const },
  searchInput: { background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '8px 12px', fontSize: '14px', width: '220px' },
  select: { background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '8px 10px', fontSize: '13px' },
  countBadge: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: C.muted, marginLeft: 'auto' },
  tableWrap: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { background: C.surface2, textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const },
  thRed: { background: C.surface2, textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: C.red, borderBottom: `1px solid ${C.border}` },
  td: { padding: '10px 12px', borderBottom: `1px solid #1e2228`, verticalAlign: 'middle' as const },
  // モーダル
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '28px', width: '420px', maxWidth: '95vw' },
  modalTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '20px' },
  formLabel: { fontSize: '12px', color: C.muted, marginBottom: '4px', display: 'block' },
  formInput: { width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' as const },
  formSelect: { width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' as const },
  formRow: { marginBottom: '14px' },
  formRow2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' },
};

const emptyForm = { member_code: '', name: '', affiliation: DEFAULT_AFFILIATION, is_judge: false, class: '' };

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filterAffil, setFilterAffil] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterJudge, setFilterJudge] = useState('');
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filterAffil) params.set('affiliation', filterAffil);
    if (filterClass) params.set('class', filterClass);
    if (filterJudge) params.set('is_judge', filterJudge);
    const res = await fetch(`/api/players?${params}`);
    const json = await res.json();
    if (json.success) setPlayers(json.data);
    setLoading(false);
  }, [q, filterAffil, filterClass, filterJudge]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  function openNew() {
    setForm(emptyForm);
    setModal('new');
  }

  function openEdit(p: PlayerMaster) {
    setForm({
      member_code: p.member_code,
      name: p.name,
      affiliation: p.affiliation ?? DEFAULT_AFFILIATION,
      is_judge: p.is_judge,
      class: p.class ?? '',
    });
    setModal('edit');
  }

  async function save() {
    setSaving(true);
    try {
      if (modal === 'new') {
        await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, class: form.class || null }),
        });
      } else {
        await fetch(`/api/players/${form.member_code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, affiliation: form.affiliation, is_judge: form.is_judge, class: form.class || null }),
        });
      }
      setModal(null);
      fetchPlayers();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/players/${deleteTarget}`, { method: 'DELETE' });
    setDeleteTarget(null);
    fetchPlayers();
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const filtered = players; // サーバー側でフィルタ済み

  return (
    <div style={s.page}>
      {/* ヘッダー */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>選手マスター管理</h1>
          <button style={s.backBtn} onClick={() => router.push('/admin')}>← 大会管理に戻る</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ContactButton />
          <button style={s.btnGold} onClick={openNew}>＋ 新規選手登録</button>
        </div>
      </div>

      {/* フィルタ・検索 */}
      <div style={s.toolbar}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="🔍 会員番号 または 氏名"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select style={s.select} value={filterAffil} onChange={e => setFilterAffil(e.target.value)}>
          <option value="">所属：すべて</option>
          {PREFECTURES.map(p => <option key={p.cd} value={p.name}>{p.name}</option>)}
        </select>
        <select style={s.select} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">クラス：すべて</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={s.select} value={filterJudge} onChange={e => setFilterJudge(e.target.value)}>
          <option value="">審判：すべて</option>
          <option value="true">⚑ 審判のみ</option>
          <option value="false">審判以外</option>
        </select>
        <span style={s.countBadge}>{filtered.length}名</span>
      </div>

      {/* 一覧テーブル */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: C.muted }}>読み込み中…</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>会員番号</th>
                <th style={s.th}>氏名</th>
                <th style={s.th}>所属</th>
                <th style={s.th}>クラス</th>
                <th style={s.th}>審判フラグ</th>
                <th style={s.th}>最終更新</th>
                <th style={s.thRed}>編集 / 削除</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: C.muted }}>該当する選手がいません</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.member_code} style={{ cursor: 'default' }} onMouseEnter={e => (e.currentTarget.style.background = '#1e2228')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={s.td}>{p.member_code}</td>
                  <td style={s.td}>{p.name}</td>
                  <td style={s.td}>{p.affiliation ?? '—'}</td>
                  <td style={s.td}>{p.class ?? '—'}</td>
                  <td style={s.td}>{p.is_judge ? <span style={{ color: C.red }}>⚑</span> : '—'}</td>
                  <td style={{ ...s.td, color: C.muted, fontSize: '12px' }}>{formatDate(p.updated_at)}</td>
                  <td style={s.td}>
                    <button style={{ ...s.btnGray, marginRight: '8px' }} onClick={() => openEdit(p)}>編集</button>
                    <button style={s.btnRed} onClick={() => setDeleteTarget(p.member_code)}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新規登録・編集モーダル */}
      {modal && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={s.modal}>
            <div style={s.modalTitle}>{modal === 'new' ? '新規選手登録' : '選手情報を編集'}</div>
            <div style={s.formRow}>
              <label style={s.formLabel}>会員番号 <span style={{ color: C.red }}>*</span></label>
              <input
                style={{ ...s.formInput, ...(modal === 'edit' ? { color: C.muted } : {}) }}
                value={form.member_code}
                readOnly={modal === 'edit'}
                onChange={e => setForm(f => ({ ...f, member_code: e.target.value }))}
                placeholder="例: 35313"
              />
            </div>
            <div style={s.formRow}>
              <label style={s.formLabel}>氏名 <span style={{ color: C.red }}>*</span></label>
              <input
                style={s.formInput}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例: 松尾 充泰"
              />
            </div>
            <div style={s.formRow}>
              <label style={s.formLabel}>所属</label>
              <select style={s.formSelect} value={form.affiliation} onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))}>
                {PREFECTURES.map(p => <option key={p.cd} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div style={s.formRow2}>
              <div>
                <label style={s.formLabel}>クラス</label>
                <select style={s.formSelect} value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>
                  <option value="">（未設定）</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={s.formLabel}>審判フラグ</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_judge}
                    onChange={e => setForm(f => ({ ...f, is_judge: e.target.checked }))}
                    style={{ accentColor: C.red, width: '16px', height: '16px' }}
                  />
                  <span>審判 ⚑</span>
                </label>
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.btnGray} onClick={() => setModal(null)}>キャンセル</button>
              <button style={s.btnGold} onClick={save} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...s.modal, width: '360px' }}>
            <div style={s.modalTitle}>選手を削除しますか？</div>
            <p style={{ color: C.muted, fontSize: '14px', marginBottom: '8px' }}>
              会員番号 <strong style={{ color: C.text }}>{deleteTarget}</strong> を削除します。
            </p>
            <p style={{ color: C.red, fontSize: '12px' }}>この操作は元に戻せません。</p>
            <div style={s.modalFooter}>
              <button style={s.btnGray} onClick={() => setDeleteTarget(null)}>キャンセル</button>
              <button style={{ ...s.btnGold, background: C.red, color: '#fff' }} onClick={confirmDelete}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
