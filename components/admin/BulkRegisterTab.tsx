'use client';

import { useState, useRef } from 'react';
import { C } from '@/lib/colors';
import { PREFECTURES, DEFAULT_AFFILIATION } from '@/lib/prefectures';
import type { ClassType } from '@/lib/types';

interface Props {
  tournamentId: number;
  onSaved?: () => void;
}

interface BulkRow {
  id: number;
  groupNum: number;
  position: number;
  member_code: string;
  name: string;
  belong: string;
  class: ClassType | '';
  is_judge: boolean;
}

interface PlayerMaster {
  member_code: string;
  name: string;
  affiliation: string | null;
  is_judge: boolean;
  class: string | null;
}

const INITIAL_GROUPS = 4;
const POSITIONS_PER_GROUP = 6;

function generateInitialRows(): BulkRow[] {
  const rows: BulkRow[] = [];
  let id = 0;
  for (let g = 1; g <= INITIAL_GROUPS; g++) {
    for (let p = 1; p <= POSITIONS_PER_GROUP; p++) {
      rows.push({
        id: id++,
        groupNum: g,
        position: p,
        member_code: '',
        name: '',
        belong: DEFAULT_AFFILIATION,
        class: '',
        is_judge: false,
      });
    }
  }
  return rows;
}

export default function BulkRegisterTab({ tournamentId, onSaved }: Props) {
  const [bulkDay, setBulkDay] = useState<1 | 2>(1);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(generateInitialRows);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const idCounterRef = useRef(INITIAL_GROUPS * POSITIONS_PER_GROUP);

  const nextId = () => idCounterRef.current++;

  function updateRow(id: number, field: keyof BulkRow, value: string | boolean) {
    setBulkRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function deleteRow(id: number) {
    setBulkRows(prev => prev.filter(r => r.id !== id));
  }

  function handleAddRows() {
    const maxGroup = bulkRows.length > 0
      ? Math.max(...bulkRows.map(r => r.groupNum))
      : 0;
    const newGroup = maxGroup + 1;
    const newRows: BulkRow[] = [];
    for (let p = 1; p <= POSITIONS_PER_GROUP; p++) {
      newRows.push({
        id: nextId(),
        groupNum: newGroup,
        position: p,
        member_code: '',
        name: '',
        belong: DEFAULT_AFFILIATION,
        class: '',
        is_judge: false,
      });
    }
    setBulkRows(prev => [...prev, ...newRows]);
  }

  async function handleSearch() {
    setSearching(true);
    setError(null);
    setSuccess(null);

    const newRows: BulkRow[] = [];

    for (const row of bulkRows) {
      const query = row.member_code.trim();

      if (!query) {
        // 会員番号欄が空の場合はそのまま保持
        newRows.push(row);
        continue;
      }

      try {
        if (/^\d+$/.test(query)) {
          // 数字 → 会員番号の完全一致検索
          const res = await fetch(`/api/players?code=${encodeURIComponent(query)}`);
          const json = await res.json();
          if (json.success && json.data) {
            const p: PlayerMaster = json.data;
            newRows.push({
              ...row,
              member_code: p.member_code,
              name: p.name,
              belong: p.affiliation ?? DEFAULT_AFFILIATION,
              class: (p.class ?? '') as ClassType | '',
              is_judge: p.is_judge,
            });
            continue;
          }
          // マスター未登録 → そのまま保持
          newRows.push(row);
        } else {
          // 文字列 → 氏名の部分一致検索
          const res = await fetch(`/api/players?q=${encodeURIComponent(query)}`);
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const players: PlayerMaster[] = json.data;
            // 複数ヒット → 同じ番号に複数行展開
            for (let i = 0; i < players.length; i++) {
              const p = players[i];
              newRows.push({
                id: i === 0 ? row.id : nextId(),
                groupNum: row.groupNum,
                position: row.position,
                member_code: p.member_code,
                name: p.name,
                belong: p.affiliation ?? DEFAULT_AFFILIATION,
                class: (p.class ?? '') as ClassType | '',
                is_judge: p.is_judge,
              });
            }
            continue;
          }
          // 0件 → そのまま保持
          newRows.push(row);
        }
      } catch {
        newRows.push(row);
      }
    }

    setBulkRows(newRows);
    setSearched(true);
    setSearching(false);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    // 氏名が空欄の行をスキップ
    const validRows = bulkRows.filter(r => r.name.trim());

    if (validRows.length === 0) {
      setError('登録する選手がいません（氏名を入力してください）');
      return;
    }

    // 番号重複チェック
    const seen = new Map<string, BulkRow>();
    for (const row of validRows) {
      const key = `${row.groupNum}_${row.position}`;
      const prev = seen.get(key);
      if (prev) {
        setError(`${row.groupNum}組 ${row.position}番が重複しています。どちらかを削除してください。`);
        return;
      }
      seen.set(key, row);
    }

    const allMembers = validRows.map(r => ({
      day: bulkDay,
      group_number: r.groupNum,
      position: r.position,
      member_code: r.member_code || undefined,
      name: r.name.trim(),
      belong: r.belong || undefined,
      class: (r.class || undefined) as ClassType | undefined,
      is_judge: r.is_judge,
    }));

    try {
      setSaving(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: bulkDay, members: allMembers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // player_master のクラス・審判フラグを更新
      await Promise.allSettled(
        allMembers
          .filter(m => m.member_code)
          .map(m =>
            fetch(`/api/players/${m.member_code}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_judge: m.is_judge, class: m.class ?? null }),
            })
          )
      );

      const skipped = bulkRows.length - validRows.length;
      setSuccess(
        `${validRows.length}名を登録しました` +
        (skipped > 0 ? `（氏名空欄 ${skipped}行はスキップ）` : '')
      );
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // 重複している (groupNum, position) を特定
  const dupKeys = new Set<string>();
  {
    const countMap = new Map<string, number>();
    for (const row of bulkRows) {
      if (!row.name.trim()) continue;
      const key = `${row.groupNum}_${row.position}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    for (const [k, count] of countMap) {
      if (count > 1) dupKeys.add(k);
    }
  }

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
    <div>
      {/* 登録先（日付）選択 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ color: C.muted, fontSize: 14 }}>登録先：</span>
        {([1, 2] as const).map(d => (
          <button
            key={d}
            onClick={() => setBulkDay(d)}
            style={{
              background: bulkDay === d ? C.gold : C.surface,
              color: bulkDay === d ? '#000' : C.muted,
              border: `1px solid ${bulkDay === d ? C.gold : C.border}`,
              borderRadius: 6,
              padding: '5px 14px',
              fontSize: 14,
              fontWeight: bulkDay === d ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {d}日目
          </button>
        ))}
      </div>

      {/* エラー / 成功メッセージ */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
        }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
        }}>
          ✔ {success}
        </div>
      )}

      {/* ツールバー */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleAddRows}
          style={{
            background: C.gold, color: '#000', border: 'none',
            borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ＋追加（6行）
        </button>
        <button
          onClick={handleSearch}
          disabled={searching}
          style={{
            background: '#2a7a9a', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 700,
            cursor: searching ? 'not-allowed' : 'pointer',
            opacity: searching ? 0.7 : 1,
          }}
        >
          {searching ? '検索中...' : '🔍 検索・設定'}
        </button>
        <button
          onClick={handleSave}
          disabled={!searched || saving}
          style={{
            background: searched ? '#1a6a3a' : C.surface,
            color: searched ? '#fff' : C.muted,
            border: `1px solid ${searched ? '#1a6a3a' : C.border}`,
            borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 700,
            cursor: (!searched || saving) ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '保存中...' : '💾 保存'}
        </button>
        {!searched && (
          <span style={{ fontSize: 12, color: C.muted }}>
            ※「検索・設定」を実行してから保存できます
          </span>
        )}
      </div>

      {/* 入力テーブル */}
      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: C.surface2 }}>
              {[
                { label: '番号',   w: 76  },
                { label: '会員番号', w: 105 },
                { label: '氏名',   w: undefined },
                { label: '所属',   w: 110 },
                { label: 'クラス', w: 68  },
                { label: '審判',   w: 52  },
                { label: '削除',   w: 52, red: true },
              ].map(h => (
                <th
                  key={h.label}
                  style={{
                    padding: '8px 8px',
                    fontSize: 12,
                    color: h.red ? C.red : C.muted,
                    fontWeight: 600,
                    textAlign: 'center',
                    borderBottom: `2px solid ${C.border}`,
                    whiteSpace: 'nowrap',
                    width: h.w,
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bulkRows.map((row, idx) => {
              const isDup = dupKeys.has(`${row.groupNum}_${row.position}`);
              const isGroupStart = idx === 0 || bulkRows[idx - 1].groupNum !== row.groupNum;
              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: `1px solid ${C.border}33`,
                    borderTop: isGroupStart && idx > 0 ? `2px solid ${C.border}` : undefined,
                    background: isDup ? `${C.red}11` : 'transparent',
                  }}
                >
                  {/* 番号 */}
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      background: isDup ? `${C.red}22` : C.surface2,
                      border: `1px solid ${isDup ? C.red : C.border}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 12,
                      color: isDup ? C.red : C.muted,
                      whiteSpace: 'nowrap',
                    }}>
                      {row.groupNum}組 {row.position}番
                    </span>
                  </td>

                  {/* 会員番号 */}
                  <td style={{ padding: '3px 6px' }}>
                    <input
                      type="text"
                      value={row.member_code}
                      onChange={e => updateRow(row.id, 'member_code', e.target.value)}
                      style={{ ...inputStyle, borderColor: isDup ? C.red : C.border }}
                      placeholder="番号 / 氏名"
                    />
                  </td>

                  {/* 氏名 */}
                  <td style={{ padding: '3px 6px' }}>
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                      style={inputStyle}
                      placeholder="氏名"
                    />
                  </td>

                  {/* 所属 */}
                  <td style={{ padding: '3px 6px' }}>
                    <select
                      value={row.belong}
                      onChange={e => updateRow(row.id, 'belong', e.target.value)}
                      style={inputStyle}
                    >
                      {PREFECTURES.map(p => (
                        <option key={p.cd} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* クラス */}
                  <td style={{ padding: '3px 6px' }}>
                    <select
                      value={row.class}
                      onChange={e => updateRow(row.id, 'class', e.target.value as ClassType | '')}
                      style={{ ...inputStyle, width: 56 }}
                    >
                      <option value="">-</option>
                      {(['A', 'B', 'C', 'D'] as ClassType[]).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>

                  {/* 審判フラグ */}
                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={row.is_judge}
                        onChange={e => updateRow(row.id, 'is_judge', e.target.checked)}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: C.gold }}
                      />
                      <span style={{ fontSize: 14, color: row.is_judge ? C.gold : C.muted }}>⚑</span>
                    </label>
                  </td>

                  {/* 削除 */}
                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteRow(row.id)}
                      style={{
                        background: 'transparent', color: C.red,
                        border: `1px solid ${C.red}`, borderRadius: 4,
                        padding: '2px 8px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
        <span style={{ color: C.gold }}>●</span>{' '}
        会員番号欄に「会員番号（数字）」または「氏名（部分一致）」を入力して「検索・設定」を押すと自動補完されます<br />
        <span style={{ color: C.gold }}>●</span>{' '}
        氏名が空欄の行は保存しません（NULLデータは無視）
      </div>
    </div>
  );
}
