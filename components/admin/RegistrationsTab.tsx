'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { C } from '@/lib/colors';
import type { Registration, ParticipationDay, ClassType } from '@/lib/types';
import LoadingOverlay from '@/components/LoadingOverlay';

interface Props {
  tournamentId: number;
}

function dayLabel(d: ParticipationDay): string {
  if (d === 'day1') return '1日目';
  if (d === 'day2') return '2日目';
  return '両方';
}

// ===== Manual add row types =====
type SearchStatus = 'idle' | 'found' | 'not_found';

interface ManualRow {
  id: number;
  member_code: string;
  name: string;
  belong: string;
  class: ClassType | '';
  is_judge: boolean;
  searchStatus: SearchStatus;
}

interface PlayerMaster {
  member_code: string;
  name: string;
  affiliation: string | null;
  is_judge: boolean;
  class: string | null;
}

function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u3000]/g, '');
}

const INIT_MANUAL_ROWS = 6;
const ADD_ROWS_COUNT = 6;

export default function RegistrationsTab({ tournamentId }: Props) {
  const { data: session } = useSession();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ regId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Manual add state
  const [manualDay, setManualDay] = useState<1 | 2>(1);
  const [manualRows, setManualRows] = useState<ManualRow[]>(() => generateManualRows(INIT_MANUAL_ROWS, 0));
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const idCounterRef = useRef(INIT_MANUAL_ROWS);

  // Association names for dropdown
  const [associationNames, setAssociationNames] = useState<string[]>([]);

  useEffect(() => {
    fetchRegistrations();
    fetch('/api/associations')
      .then(r => r.json())
      .then(j => {
        if (j.success) setAssociationNames((j.data as { name: string }[]).map(a => a.name));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  function generateManualRows(count: number, startId: number): ManualRow[] {
    return Array.from({ length: count }, (_, i) => ({
      id: startId + i,
      member_code: '',
      name: '',
      belong: '',
      class: '' as ClassType | '',
      is_judge: false,
      searchStatus: 'idle' as SearchStatus,
    }));
  }

  async function fetchRegistrations() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRegistrations(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(reg: Registration) {
    if (!window.confirm(`${reg.name} さんの申込をキャンセルしますか？`)) return;
    const adminName = session?.user?.name ?? 'admin';
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${reg.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_name: adminName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      fetchRegistrations();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'キャンセルに失敗しました');
    }
  }

  async function handleDeleteManual(reg: Registration) {
    if (!window.confirm(`${reg.name} さんの手動登録を削除しますか？`)) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${reg.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      fetchRegistrations();
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  // Inline edit: start editing
  function startEdit(regId: number, field: string, currentValue: string) {
    setEditingCell({ regId, field });
    setEditValue(currentValue);
  }

  // Inline edit: save
  async function saveEdit(reg: Registration) {
    if (!editingCell) return;
    const { field } = editingCell;
    const newVal = editValue;

    // Only save if changed
    const oldVal = String((reg as unknown as Record<string, unknown>)[field] ?? '');
    if (newVal === oldVal) {
      setEditingCell(null);
      return;
    }

    try {
      const body: Record<string, unknown> = {};
      if (field === 'belong') body.belong = newVal || null;
      else if (field === 'class') body.class = newVal || null;
      else if (field === 'is_judge') body.is_judge = newVal === 'true';
      else if (field === 'name') body.name = newVal;
      else if (field === 'member_code') body.member_code = newVal;

      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${reg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      fetchRegistrations();
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setEditingCell(null);
    }
  }

  // Transfer
  async function handleTransfer() {
    setTransferError(null);
    const untransferred = registrations.filter(r => r.status === 'active' && !r.transferred_at);
    if (untransferred.length === 0) return;
    if (!window.confirm(`未移行の ${untransferred.length} 名を選手登録に移行しますか？\n申込期間が終了している必要があります。`)) return;
    try {
      setTransferring(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      fetchRegistrations();
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : '移行に失敗しました');
    } finally {
      setTransferring(false);
    }
  }

  // ===== Manual add functions =====
  function updateManualRow(id: number, field: keyof ManualRow, value: string | boolean) {
    setManualRows(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: value, searchStatus: 'idle' as SearchStatus } : r
    ));
    setSearched(false);
  }

  function deleteManualRow(id: number) {
    setManualRows(prev => prev.filter(r => r.id !== id));
  }

  function handleAddManualRows() {
    const startId = idCounterRef.current;
    idCounterRef.current += ADD_ROWS_COUNT;
    setManualRows(prev => [...prev, ...generateManualRows(ADD_ROWS_COUNT, startId)]);
  }

  async function handleManualSearch() {
    setSearching(true);
    setManualError(null);
    setManualSuccess(null);

    const newRows: ManualRow[] = [];

    for (const row of manualRows) {
      const code = row.member_code.trim();
      const name = row.name.trim();

      if (!code && !name) {
        newRows.push({ ...row, searchStatus: 'idle' });
        continue;
      }

      try {
        if (code && name) {
          const res = await fetch(`/api/players?code=${encodeURIComponent(code)}`);
          const json = await res.json();
          if (json.success && json.data) {
            const p: PlayerMaster = json.data;
            const normInput = normalizeSpaces(name);
            const normDB = normalizeSpaces(p.name);
            if (normDB.includes(normInput) || normInput.includes(normDB)) {
              newRows.push({
                ...row, member_code: p.member_code, name: p.name,
                belong: p.affiliation ?? '', class: (p.class ?? '') as ClassType | '',
                is_judge: p.is_judge, searchStatus: 'found',
              });
            } else {
              newRows.push({ ...row, searchStatus: 'not_found' });
            }
          } else {
            newRows.push({ ...row, searchStatus: 'not_found' });
          }
        } else if (code) {
          const res = await fetch(`/api/players?code=${encodeURIComponent(code)}`);
          const json = await res.json();
          if (json.success && json.data) {
            const p: PlayerMaster = json.data;
            newRows.push({
              ...row, member_code: p.member_code, name: p.name,
              belong: p.affiliation ?? '', class: (p.class ?? '') as ClassType | '',
              is_judge: p.is_judge, searchStatus: 'found',
            });
          } else {
            newRows.push({ ...row, searchStatus: 'not_found' });
          }
        } else {
          const normName = normalizeSpaces(name);
          const params = new URLSearchParams({ q_name: normName });
          if (row.belong) params.set('q_belong', row.belong);
          const res = await fetch(`/api/players?${params}`);
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const players: PlayerMaster[] = json.data;
            for (let i = 0; i < players.length; i++) {
              const p = players[i];
              newRows.push({
                id: i === 0 ? row.id : idCounterRef.current++,
                member_code: p.member_code, name: p.name,
                belong: p.affiliation ?? '', class: (p.class ?? '') as ClassType | '',
                is_judge: p.is_judge, searchStatus: 'found',
              });
            }
          } else {
            newRows.push({ ...row, searchStatus: 'not_found' });
          }
        }
      } catch {
        newRows.push({ ...row, searchStatus: 'idle' });
      }
    }

    setManualRows(newRows);
    setSearched(true);
    setSearching(false);
  }

  async function handleManualSave() {
    setManualError(null);
    setManualSuccess(null);

    const validRows = manualRows.filter(r => r.name.trim());
    if (validRows.length === 0) {
      setManualError('登録する選手がいません（氏名を入力してください）');
      return;
    }

    try {
      setSaving(true);

      // Save each row as a registration with source='manual'
      const results = [];
      for (const r of validRows) {
        const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'manual',
            member_code: r.member_code.trim(),
            name: r.name.trim(),
            belong: r.belong || null,
            class: r.class || null,
            is_judge: r.is_judge,
            participation_day: manualDay === 1 ? 'day1' : 'day2',
          }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '登録に失敗しました');
        }
        results.push(json.data);
      }

      setManualSuccess(`${validRows.length}名を手動登録しました（${manualDay}日目）`);
      // Reset manual rows
      idCounterRef.current += 100;
      setManualRows(generateManualRows(INIT_MANUAL_ROWS, idCounterRef.current));
      idCounterRef.current += INIT_MANUAL_ROWS;
      setSearched(false);
      fetchRegistrations();
    } catch (e) {
      setManualError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const activeRegs = registrations.filter(r => r.status === 'active');
  const cancelledCount = registrations.filter(r => r.status === 'cancelled').length;
  const untransferredCount = activeRegs.filter(r => !r.transferred_at).length;

  const inputStyle: React.CSSProperties = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '4px 6px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '20px 16px' }}>
      <LoadingOverlay show={searching || saving} message={searching ? '検索中...' : '保存中...'} />

      {/* ============ Manual Add Area ============ */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '16px',
        marginBottom: 24,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: C.gold, fontWeight: 700 }}>
          手動追加
        </h3>

        {/* Day selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ color: C.muted, fontSize: 14 }}>登録先：</span>
          {([1, 2] as const).map(d => (
            <button
              key={d}
              onClick={() => setManualDay(d)}
              style={{
                background: manualDay === d ? C.gold : C.surface2,
                color: manualDay === d ? '#000' : C.muted,
                border: `1px solid ${manualDay === d ? C.gold : C.border}`,
                borderRadius: 6, padding: '5px 14px', fontSize: 14,
                fontWeight: manualDay === d ? 700 : 400, cursor: 'pointer',
              }}
            >
              {d}日目
            </button>
          ))}
        </div>

        {/* Manual error/success */}
        {manualError && (
          <div style={{
            background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
            borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
          }}>{manualError}</div>
        )}
        {manualSuccess && (
          <div style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
            borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
          }}>{manualSuccess}</div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleAddManualRows}
            style={{
              background: C.gold, color: '#000', border: 'none',
              borderRadius: 6, padding: '7px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            +追加（6行）
          </button>
          <button
            onClick={handleManualSearch}
            disabled={searching}
            style={{
              background: C.blue2, color: '#fff', border: 'none',
              borderRadius: 6, padding: '7px 14px', fontSize: 14, fontWeight: 700,
              cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? 0.7 : 1,
            }}
          >
            検索・設定
          </button>
          <button
            onClick={handleManualSave}
            disabled={!searched || saving}
            style={{
              background: searched ? '#1a6a3a' : C.surface2,
              color: searched ? '#fff' : C.muted,
              border: `1px solid ${searched ? '#1a6a3a' : C.border}`,
              borderRadius: 6, padding: '7px 14px', fontSize: 14, fontWeight: 700,
              cursor: (!searched || saving) ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {!searched && (
            <span style={{ fontSize: 12, color: C.muted }}>
              ※「検索・設定」を実行してから保存できます
            </span>
          )}
        </div>

        {/* Manual add table */}
        <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 660 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                {[
                  { label: '会員番号', w: 100 },
                  { label: '氏名', w: undefined },
                  { label: '所属', w: 110 },
                  { label: 'クラス', w: 68 },
                  { label: '審判', w: 52 },
                  { label: '削除', w: 52, red: true },
                ].map(h => (
                  <th key={h.label} style={{
                    padding: '8px 8px', fontSize: 12,
                    color: h.red ? C.red : C.muted,
                    fontWeight: 600, textAlign: 'center',
                    borderBottom: `2px solid ${C.border}`,
                    whiteSpace: 'nowrap', width: h.w,
                  }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {manualRows.map(row => {
                const isNotFound = row.searchStatus === 'not_found';
                return (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}33` }}>
                    <td style={{ padding: '3px 6px' }}>
                      <input type="text" value={row.member_code}
                        onChange={e => updateManualRow(row.id, 'member_code', e.target.value)}
                        style={inputStyle} placeholder="番号" />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input type="text" value={row.name}
                        onChange={e => updateManualRow(row.id, 'name', e.target.value)}
                        style={inputStyle} placeholder="氏名" />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <select value={row.belong}
                        onChange={e => updateManualRow(row.id, 'belong', e.target.value)}
                        style={inputStyle}>
                        <option value="">---</option>
                        {associationNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <select value={row.class}
                        onChange={e => updateManualRow(row.id, 'class', e.target.value as ClassType | '')}
                        style={{ ...inputStyle, width: 56 }}>
                        <option value="">-</option>
                        {(['AA', 'A', 'B', 'C'] as ClassType[]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}>
                        <input type="checkbox" checked={row.is_judge}
                          onChange={e => updateManualRow(row.id, 'is_judge', e.target.checked)}
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: C.gold }} />
                        <span style={{ fontSize: 14, color: row.is_judge ? C.gold : C.muted }}>⚑</span>
                      </label>
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => deleteManualRow(row.id)}
                        style={{
                          background: 'transparent', color: C.red,
                          border: `1px solid ${C.red}`, borderRadius: 4,
                          padding: '2px 8px', fontSize: 13, cursor: 'pointer',
                        }}>
                        x
                      </button>
                      {isNotFound && (
                        <span style={{ marginLeft: 4, fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>
                          該当者なし
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
          会員番号を入力 → DBから自動補完 / 氏名のみ入力 → 氏名+所属で検索 / 両方入力 → 両方一致で補完
        </div>
      </div>

      {/* ============ Registration List ============ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{
            background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
            borderRadius: 5, padding: '4px 12px', fontSize: 14, fontWeight: 700,
          }}>
            申込中: {activeRegs.length}名
          </span>
          {cancelledCount > 0 && (
            <span style={{
              background: C.surface2, border: `1px solid ${C.border}`, color: C.muted,
              borderRadius: 5, padding: '4px 12px', fontSize: 14,
            }}>
              キャンセル: {cancelledCount}名
            </span>
          )}
        </div>
        <button
          onClick={fetchRegistrations}
          style={{
            background: C.surface2, color: C.muted, border: `1px solid ${C.border}`,
            borderRadius: 5, padding: '6px 14px', fontSize: 14, cursor: 'pointer',
          }}
        >
          更新
        </button>
        <button
          onClick={handleTransfer}
          disabled={transferring || untransferredCount === 0}
          style={{
            background: C.blue2, color: '#fff', border: 'none',
            borderRadius: 5, padding: '6px 16px', fontSize: 14, fontWeight: 700,
            cursor: (transferring || untransferredCount === 0) ? 'not-allowed' : 'pointer',
            opacity: (transferring || untransferredCount === 0) ? 0.6 : 1,
            marginLeft: 'auto',
          }}
        >
          {transferring ? '移行中...' : `未移行 ${untransferredCount}名 → 選手登録に移行`}
        </button>
      </div>

      {transferError && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 14,
        }}>{transferError}</div>
      )}

      {loading ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>読み込み中...</p>
      ) : error ? (
        <p style={{ color: C.red, textAlign: 'center', padding: '20px 0' }}>{error}</p>
      ) : registrations.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '40px', textAlign: 'center',
        }}>
          <p style={{ color: C.muted, fontSize: 15 }}>申込はまだありません</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                {['登録元', '会員番号', '氏名', '所属', 'クラス', '審判', '参加', '申込日時', 'ステータス', '操作'].map(h => (
                  <th key={h} style={{
                    padding: '9px 10px', fontSize: 12, color: C.muted, fontWeight: 600,
                    textAlign: 'left', borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrations.map(reg => {
                const isTransferred = !!reg.transferred_at;
                const isManual = reg.source === 'manual';
                const isCancelled = reg.status === 'cancelled';
                const rowOpacity = isCancelled ? 0.5 : isTransferred ? 0.6 : 1;
                const rowBg = isCancelled ? `${C.surface2}88` : isTransferred ? `${C.surface2}44` : 'transparent';

                return (
                  <tr key={reg.id} style={{
                    borderBottom: `1px solid ${C.border}33`,
                    background: rowBg,
                    opacity: rowOpacity,
                  }}>
                    {/* 登録元 */}
                    <td style={{ padding: '7px 10px', fontSize: 12 }}>
                      <span style={{
                        background: isManual ? `${C.blue2}22` : `${C.gold}22`,
                        color: isManual ? C.blue2 : C.gold,
                        border: `1px solid ${isManual ? C.blue2 : C.gold}`,
                        borderRadius: 4, padding: '2px 6px', fontSize: 11,
                      }}>
                        {isManual ? '手動' : 'Web'}
                      </span>
                    </td>

                    {/* 会員番号 */}
                    <td style={{ padding: '7px 10px', fontSize: 13, color: C.muted }}>
                      {reg.member_code}
                    </td>

                    {/* 氏名 (editable) */}
                    <td style={{ padding: '7px 10px', fontSize: 14, color: C.text, fontWeight: 600 }}>
                      {editingCell?.regId === reg.id && editingCell?.field === 'name' ? (
                        <input type="text" value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(reg)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(reg); if (e.key === 'Escape') setEditingCell(null); }}
                          autoFocus
                          style={{ ...inputStyle, width: 120 }} />
                      ) : (
                        <span onClick={() => !isCancelled && !isTransferred && startEdit(reg.id, 'name', reg.name)}
                          style={{ cursor: (!isCancelled && !isTransferred) ? 'pointer' : 'default' }}>
                          {reg.name}
                        </span>
                      )}
                    </td>

                    {/* 所属 (editable) */}
                    <td style={{ padding: '7px 10px', fontSize: 13, color: C.muted }}>
                      {editingCell?.regId === reg.id && editingCell?.field === 'belong' ? (
                        <select value={editValue}
                          onChange={e => { setEditValue(e.target.value); }}
                          onBlur={() => saveEdit(reg)}
                          autoFocus
                          style={{ ...inputStyle, width: 100 }}>
                          <option value="">---</option>
                          {associationNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      ) : (
                        <span onClick={() => !isCancelled && !isTransferred && startEdit(reg.id, 'belong', reg.belong ?? '')}
                          style={{ cursor: (!isCancelled && !isTransferred) ? 'pointer' : 'default' }}>
                          {reg.belong || '---'}
                        </span>
                      )}
                    </td>

                    {/* クラス (editable) */}
                    <td style={{ padding: '7px 10px', fontSize: 13, color: C.muted, textAlign: 'center' }}>
                      {editingCell?.regId === reg.id && editingCell?.field === 'class' ? (
                        <select value={editValue}
                          onChange={e => { setEditValue(e.target.value); }}
                          onBlur={() => saveEdit(reg)}
                          autoFocus
                          style={{ ...inputStyle, width: 56 }}>
                          <option value="">-</option>
                          {(['AA', 'A', 'B', 'C'] as ClassType[]).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span onClick={() => !isCancelled && !isTransferred && startEdit(reg.id, 'class', reg.class ?? '')}
                          style={{ cursor: (!isCancelled && !isTransferred) ? 'pointer' : 'default' }}>
                          {reg.class ?? '---'}
                        </span>
                      )}
                    </td>

                    {/* 審判 (editable) */}
                    <td style={{ padding: '7px 10px', fontSize: 13, textAlign: 'center' }}>
                      {!isCancelled && !isTransferred ? (
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input type="checkbox" checked={reg.is_judge}
                            onChange={async () => {
                              try {
                                const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${reg.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ is_judge: !reg.is_judge }),
                                });
                                const json = await res.json();
                                if (!json.success) throw new Error(json.error);
                                fetchRegistrations();
                              } catch (e) {
                                alert(e instanceof Error ? e.message : '更新に失敗しました');
                              }
                            }}
                            style={{ width: 14, height: 14, accentColor: C.gold }} />
                        </label>
                      ) : (
                        <span style={{ color: reg.is_judge ? C.gold : C.muted }}>
                          {reg.is_judge ? '⚑' : '-'}
                        </span>
                      )}
                    </td>

                    {/* 参加 */}
                    <td style={{ padding: '7px 10px', fontSize: 13, color: C.text }}>
                      {dayLabel(reg.participation_day)}
                    </td>

                    {/* 申込日時 */}
                    <td style={{ padding: '7px 10px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                      {new Date(reg.applied_at).toLocaleString('ja-JP')}
                    </td>

                    {/* ステータス */}
                    <td style={{ padding: '7px 10px', fontSize: 12 }}>
                      {isCancelled ? (
                        <span style={{
                          background: C.surface2, color: C.muted,
                          border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 12,
                        }}>キャンセル</span>
                      ) : isTransferred ? (
                        <span style={{
                          background: `${C.blue2}22`, color: C.blue2,
                          border: `1px solid ${C.blue2}`, borderRadius: 4, padding: '2px 8px', fontSize: 12,
                        }}>移行済</span>
                      ) : (
                        <span style={{
                          background: `${C.green}22`, color: C.green,
                          border: `1px solid ${C.green}`, borderRadius: 4, padding: '2px 8px', fontSize: 12,
                        }}>申込中</span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      {!isCancelled && !isTransferred && !isManual && (
                        <button onClick={() => handleCancel(reg)}
                          style={{
                            background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
                            borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                          }}>
                          キャンセル
                        </button>
                      )}
                      {!isCancelled && !isTransferred && isManual && (
                        <button onClick={() => handleDeleteManual(reg)}
                          style={{
                            background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
                            borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                          }}>
                          x
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
