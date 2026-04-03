'use client';

import { useState, useRef, useEffect } from 'react';
import { C } from '@/lib/colors';
import { normalizeKanji } from '@/lib/kanji-normalize';
import type { ClassType, Member, ParticipationDay, Registration } from '@/lib/types';
import LoadingOverlay from '@/components/LoadingOverlay';

interface Props {
  tournamentId: number;
  onSaved?: () => void;
  initialRegistrations?: Registration[];
}

type SearchStatus = 'idle' | 'found' | 'not_found';

interface BulkRow {
  id: number;
  seq: number;          // 人数（連番 1, 2, 3...）
  member_code: string;
  name: string;
  belong: string;       // '' = ブランク
  class: ClassType | '';
  is_judge: boolean;
  searchStatus: SearchStatus;
  participation_day?: ParticipationDay;
}

interface PlayerMaster {
  member_code: string;
  name: string;
  affiliation: string | null;
  is_judge: boolean;
  class: string | null;
}

const INIT_COUNT = 24;
const POSITIONS_PER_GROUP = 6;

function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u3000]/g, '');
}

function generateInitialRows(): BulkRow[] {
  return Array.from({ length: INIT_COUNT }, (_, i) => ({
    id: i,
    seq: i + 1,
    member_code: '',
    name: '',
    belong: '',
    class: '',
    is_judge: false,
    searchStatus: 'idle' as SearchStatus,
  }));
}

function registrationsToRows(regs: Registration[]): BulkRow[] {
  return regs.map((r, i) => ({
    id: i,
    seq: i + 1,
    member_code: r.member_code,
    name: r.name,
    belong: r.belong ?? '',
    class: (r.class ?? '') as ClassType | '',
    is_judge: false,
    searchStatus: 'found' as SearchStatus,
    participation_day: r.participation_day,
  }));
}

export default function BulkRegisterTab({ tournamentId, onSaved, initialRegistrations }: Props) {
  const [bulkDay, setBulkDay] = useState<1 | 2>(1);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() =>
    initialRegistrations ? registrationsToRows(initialRegistrations) : generateInitialRows()
  );
  const [searched, setSearched] = useState(() => !!initialRegistrations);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const idCounterRef = useRef(INIT_COUNT);
  const [associationNames, setAssociationNames] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/associations')
      .then(r => r.json())
      .then(j => {
        if (j.success) setAssociationNames((j.data as { name: string }[]).map(a => a.name));
      })
      .catch(() => {});
  }, []);

  const nextId = () => idCounterRef.current++;

  function updateRow(id: number, field: keyof BulkRow, value: string | boolean) {
    setBulkRows(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: value, searchStatus: 'idle' as SearchStatus } : r
    ));
    setSearched(false);
  }

  function deleteRow(id: number) {
    setBulkRows(prev => prev.filter(r => r.id !== id));
  }

  function handleAddRows() {
    const maxSeq = bulkRows.length > 0 ? Math.max(...bulkRows.map(r => r.seq)) : 0;
    const newRows: BulkRow[] = Array.from({ length: POSITIONS_PER_GROUP }, (_, i) => ({
      id: nextId(),
      seq: maxSeq + i + 1,
      member_code: '',
      name: '',
      belong: '',
      class: '',
      is_judge: false,
      searchStatus: 'idle' as SearchStatus,
    }));
    setBulkRows(prev => [...prev, ...newRows]);
  }

  async function handleSearch() {
    setSearching(true);
    setError(null);
    setSuccess(null);

    const newRows: BulkRow[] = [];

    for (const row of bulkRows) {
      const code = row.member_code.trim();
      const name = row.name.trim();

      // 両方空 → そのまま
      if (!code && !name) {
        newRows.push({ ...row, searchStatus: 'idle' });
        continue;
      }

      try {
        if (code && name) {
          // 会員番号 + 氏名 → 会員番号で検索し、氏名が一致するか確認
          const res = await fetch(`/api/players?code=${encodeURIComponent(code)}`);
          const json = await res.json();
          if (json.success && json.data) {
            const p: PlayerMaster = json.data;
            const normInput = normalizeKanji(normalizeSpaces(name));
            const normDB = normalizeKanji(normalizeSpaces(p.name));
            if (normDB.includes(normInput) || normInput.includes(normDB)) {
              newRows.push({
                ...row,
                member_code: p.member_code,
                name: p.name,
                belong: p.affiliation ?? '',
                class: (p.class ?? '') as ClassType | '',
                is_judge: p.is_judge,
                searchStatus: 'found',
              });
            } else {
              // 会員番号は存在するが氏名不一致
              newRows.push({ ...row, searchStatus: 'not_found' });
            }
          } else {
            // 会員番号が見つからない
            newRows.push({ ...row, searchStatus: 'not_found' });
          }
        } else if (code) {
          // 会員番号のみ → 完全一致
          const res = await fetch(`/api/players?code=${encodeURIComponent(code)}`);
          const json = await res.json();
          if (json.success && json.data) {
            const p: PlayerMaster = json.data;
            newRows.push({
              ...row,
              member_code: p.member_code,
              name: p.name,
              belong: p.affiliation ?? '',
              class: (p.class ?? '') as ClassType | '',
              is_judge: p.is_judge,
              searchStatus: 'found',
            });
          } else {
            newRows.push({ ...row, searchStatus: 'not_found' });
          }
        } else {
          // 氏名のみ → スペース正規化検索（所属協会がある場合は絞り込み）
          const normName = normalizeSpaces(name);
          const params = new URLSearchParams({ q_name: normName });
          if (row.belong) params.set('q_belong', row.belong);
          const res = await fetch(`/api/players?${params}`);
          const json = await res.json();

          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const players: PlayerMaster[] = json.data;
            // 複数ヒット → 同じ seq に複数行展開
            for (let i = 0; i < players.length; i++) {
              const p = players[i];
              newRows.push({
                id: i === 0 ? row.id : nextId(),
                seq: row.seq,
                member_code: p.member_code,
                name: p.name,
                belong: p.affiliation ?? '',
                class: (p.class ?? '') as ClassType | '',
                is_judge: p.is_judge,
                searchStatus: 'found',
              });
            }
          } else {
            // 0件 → 「該当者なし」（行は保持・保存は可能）
            newRows.push({ ...row, searchStatus: 'not_found' });
          }
        }
      } catch {
        newRows.push({ ...row, searchStatus: 'idle' });
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

    // seq 重複チェック（同じ人数番号に複数行）
    const seqCount = new Map<number, number>();
    for (const r of validRows) {
      seqCount.set(r.seq, (seqCount.get(r.seq) ?? 0) + 1);
    }
    for (const [seq, count] of seqCount) {
      if (count > 1) {
        setError(`人数 ${seq} が重複しています。どちらかを削除してください。`);
        return;
      }
    }

    try {
      setSaving(true);

      // 定員チェック
      const applyInfoRes = await fetch(`/api/tournaments/${tournamentId}/apply-info`);
      const applyInfoJson = await applyInfoRes.json();
      if (applyInfoJson.success) {
        const applyInfo = applyInfoJson.data;
        const max: number | null = applyInfo.tournament.max_participants;
        if (max) {
          const bulkCount = validRows.length;
          const webCount = Math.max(applyInfo.day1_count, applyInfo.day2_count);
          const total = bulkCount + webCount;
          if (total > max) {
            setError(`申込上限${max}件に対して既にWeb申込から${webCount}件申込があり、一括登録からの申込は${total - max}件はオーバーしていますので、保存できません。`);
            setSaving(false);
            return;
          }
        }
      }

      // 既存の登録済み選手を取得して空きスロットを特定
      const membersRes = await fetch(`/api/tournaments/${tournamentId}/members`);
      const membersJson = await membersRes.json();
      if (!membersJson.success) throw new Error(membersJson.error);

      const existingMembers = (membersJson.data as Member[]).filter(m => m.day === bulkDay);
      const occupied = new Set<string>(
        existingMembers.map(m => `${m.group_number}_${m.position}`)
      );

      // 空きスロットに順番に割り当て
      let curGroup = 1;
      let curPos = 1;

      function findNextSlot() {
        while (occupied.has(`${curGroup}_${curPos}`)) {
          curPos++;
          if (curPos > POSITIONS_PER_GROUP) {
            curPos = 1;
            curGroup++;
          }
        }
      }

      const allMembers = validRows.map(r => {
        findNextSlot();
        const group = curGroup;
        const pos = curPos;
        occupied.add(`${group}_${pos}`);
        curPos++;
        if (curPos > POSITIONS_PER_GROUP) {
          curPos = 1;
          curGroup++;
        }
        return {
          day: bulkDay,
          group_number: group,
          position: pos,
          member_code: r.member_code || undefined,
          name: r.name.trim(),
          belong: r.belong || undefined,
          class: (r.class || undefined) as ClassType | undefined,
          is_judge: r.is_judge,
        };
      });

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
      const maxGroup = Math.max(...allMembers.map(m => m.group_number));
      setSuccess(
        `${validRows.length}名を登録しました（${bulkDay}日目 1〜${maxGroup}組へ自動割り当て）` +
        (skipped > 0 ? ` ／ 氏名空欄${skipped}行はスキップ` : '')
      );
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // 重複している seq を特定
  const dupSeqs = new Set<number>();
  {
    const countMap = new Map<number, number>();
    for (const row of bulkRows) {
      if (!row.name.trim()) continue;
      countMap.set(row.seq, (countMap.get(row.seq) ?? 0) + 1);
    }
    for (const [seq, count] of countMap) {
      if (count > 1) dupSeqs.add(seq);
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
      <LoadingOverlay show={searching || saving} message={searching ? '検索中...' : '保存中...'} />

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
              borderRadius: 6, padding: '5px 14px', fontSize: 14,
              fontWeight: bulkDay === d ? 700 : 400, cursor: 'pointer',
            }}
          >
            {d}日目
          </button>
        ))}
      </div>

      {/* エラー / 成功 */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
        }}>⚠ {error}</div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 14,
        }}>✔ {success}</div>
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
            cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? 0.7 : 1,
          }}
        >
          🔍 検索・設定
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

      {/* テーブル */}
      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: C.surface2 }}>
              {[
                { label: '人数',   w: 52  },
                { label: '会員番号', w: 100 },
                { label: '氏名',   w: undefined },
                { label: '参加',   w: 80  },
                { label: '所属協会',   w: 110 },
                { label: 'クラス', w: 68  },
                { label: '審判',   w: 52  },
                { label: '削除',   w: 52, red: true },
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
            {bulkRows.map((row) => {
              const isDup = dupSeqs.has(row.seq);
              const isNotFound = row.searchStatus === 'not_found';
              const rowBg = isDup ? `${C.red}11` : 'transparent';

              return (
                <tr key={row.id} style={{
                  borderBottom: `1px solid ${C.border}33`,
                  background: rowBg,
                }}>
                  {/* 人数 */}
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      background: isDup ? `${C.red}22` : C.surface2,
                      border: `1px solid ${isDup ? C.red : C.border}`,
                      borderRadius: 4, padding: '2px 6px',
                      fontSize: 12,
                      color: isDup ? C.red : C.muted,
                      minWidth: 32, textAlign: 'center',
                    }}>
                      {row.seq}
                    </span>
                  </td>

                  {/* 会員番号 */}
                  <td style={{ padding: '3px 6px' }}>
                    <input
                      type="text"
                      value={row.member_code}
                      onChange={e => updateRow(row.id, 'member_code', e.target.value)}
                      style={{ ...inputStyle, borderColor: isDup ? C.red : C.border }}
                      placeholder="番号"
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

                  {/* 参加 */}
                  <td style={{ padding: '3px 6px' }}>
                    <select
                      value={row.participation_day ?? 'day1'}
                      onChange={e => updateRow(row.id, 'participation_day', e.target.value)}
                      style={{ ...inputStyle, width: 70 }}
                    >
                      <option value="day1">1日目</option>
                      <option value="day2">2日目</option>
                      <option value="both">両方</option>
                    </select>
                  </td>

                  {/* 所属協会 */}
                  <td style={{ padding: '3px 6px' }}>
                    <select
                      value={row.belong}
                      onChange={e => updateRow(row.id, 'belong', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">—</option>
                      {associationNames.map(name => (
                        <option key={name} value={name}>{name}</option>
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
                      {(['AA', 'A', 'B', 'C'] as ClassType[]).map(c => (
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

                  {/* 削除 + 該当者なし */}
                  <td style={{ padding: '3px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                    {isNotFound && (
                      <span style={{
                        marginLeft: 6, fontSize: 11, color: '#e74c3c',
                        fontWeight: 700, whiteSpace: 'nowrap',
                      }}>
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
        <span style={{ color: C.gold }}>●</span>{' '}
        会員番号（数字）を入力→DBから自動補完　氏名のみ入力→氏名＋所属協会で検索　両方入力→両方一致で補完<br />
        <span style={{ color: C.gold }}>●</span>{' '}
        氏名が空欄の行は保存しません　保存時は空きスロットへ順番に自動割り当て（必要な組は自動追加）
      </div>
    </div>
  );
}
