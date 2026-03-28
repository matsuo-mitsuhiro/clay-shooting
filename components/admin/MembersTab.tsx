'use client';

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/colors';
import type { Member, ClassType } from '@/lib/types';

interface Props {
  tournamentId: number;
}

interface MemberRow {
  member_code: string;
  name: string;
  belong: string;
  class: ClassType | '';
  is_judge: boolean;
}

const POSITIONS = 6;
const emptyRow = (): MemberRow => ({ member_code: '', name: '', belong: '', class: '', is_judge: false });

export default function MembersTab({ tournamentId }: Props) {
  const [selectedDay, setSelectedDay] = useState<1 | 2>(1);
  const [groupCount, setGroupCount] = useState<{ 1: number; 2: number }>({ 1: 1, 2: 1 });
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [groups, setGroups] = useState<{ [key: string]: MemberRow[] }>({});
  const [savedMembers, setSavedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const groupKey = (day: number, group: number) => `${day}_${group}`;

  const getRows = (day: number, group: number): MemberRow[] => {
    const key = groupKey(day, group);
    if (!groups[key]) {
      return Array.from({ length: POSITIONS }, emptyRow);
    }
    return groups[key];
  };

  const setRows = (day: number, group: number, rows: MemberRow[]) => {
    setGroups(prev => ({ ...prev, [groupKey(day, group)]: rows }));
  };

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/members`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const members: Member[] = json.data;
      setSavedMembers(members);

      // Rebuild group state from saved members
      const newGroups: { [key: string]: MemberRow[] } = {};
      const maxGroupPerDay: { [day: number]: number } = { 1: 1, 2: 1 };

      for (const m of members) {
        const key = groupKey(m.day, m.group_number);
        if (!newGroups[key]) {
          newGroups[key] = Array.from({ length: POSITIONS }, emptyRow);
        }
        const idx = m.position - 1;
        if (idx >= 0 && idx < POSITIONS) {
          newGroups[key][idx] = {
            member_code: m.member_code ?? '',
            name: m.name,
            belong: m.belong ?? '',
            class: (m.class ?? '') as ClassType | '',
            is_judge: m.is_judge,
          };
        }
        if (m.group_number > (maxGroupPerDay[m.day] ?? 1)) {
          maxGroupPerDay[m.day] = m.group_number;
        }
      }

      setGroups(prev => ({ ...prev, ...newGroups }));
      setGroupCount({ 1: maxGroupPerDay[1] ?? 1, 2: maxGroupPerDay[2] ?? 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メンバーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const updateRow = (idx: number, field: keyof MemberRow, value: string | boolean) => {
    const rows = [...getRows(selectedDay, selectedGroup)];
    rows[idx] = { ...rows[idx], [field]: value };
    setRows(selectedDay, selectedGroup, rows);
  };

  const normalizeCode = (v: string) =>
    v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();

  async function handleSave() {
    setError(null);
    setSuccess(null);

    // Collect all groups for this day
    const count = groupCount[selectedDay];
    const allMembers: Array<{
      day: 1 | 2;
      group_number: number;
      position: number;
      member_code?: string;
      name: string;
      belong?: string;
      class?: ClassType;
      is_judge: boolean;
    }> = [];

    for (let g = 1; g <= count; g++) {
      const rows = getRows(selectedDay, g);
      for (let i = 0; i < POSITIONS; i++) {
        const row = rows[i];
        if (!row.name.trim()) continue;
        const code = normalizeCode(row.member_code);
        if (code && !/^\d+$/.test(code)) {
          setError(`組${g} ${i + 1}番: 会員番号は数字のみ入力してください`);
          return;
        }
        allMembers.push({
          day: selectedDay,
          group_number: g,
          position: i + 1,
          member_code: code || undefined,
          name: row.name.trim(),
          belong: row.belong.trim() || undefined,
          class: row.class || undefined,
          is_judge: row.is_judge,
        });
      }
    }

    // Duplicate check within day
    const codes = allMembers.map(m => m.member_code).filter(Boolean);
    if (new Set(codes).size !== codes.length) {
      setError('同日程内に会員番号の重複があります');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: selectedDay, members: allMembers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSavedMembers(prev => {
        const other = prev.filter(m => m.day !== selectedDay);
        return [...other, ...json.data];
      });
      setSuccess('保存しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyDay1() {
    const count = groupCount[1];
    const newGroups: { [key: string]: MemberRow[] } = {};
    for (let g = 1; g <= count; g++) {
      const rows = getRows(1, g).map(r => ({ ...r }));
      newGroups[groupKey(2, g)] = rows;
    }
    setGroups(prev => ({ ...prev, ...newGroups }));
    setGroupCount(prev => ({ ...prev, 2: count }));
    setSuccess('1日目データをコピーしました');
    setTimeout(() => setSuccess(null), 3000);
  }

  function addGroup() {
    setGroupCount(prev => ({ ...prev, [selectedDay]: prev[selectedDay] + 1 }));
    const newGroup = groupCount[selectedDay] + 1;
    setGroups(prev => ({
      ...prev,
      [groupKey(selectedDay, newGroup)]: Array.from({ length: POSITIONS }, emptyRow),
    }));
    setSelectedGroup(newGroup);
  }

  const dayMembers = savedMembers.filter(m => m.day === selectedDay);
  const groupsInDay = Array.from({ length: groupCount[selectedDay] }, (_, i) => i + 1);

  const inputStyle: React.CSSProperties = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '5px 7px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      {/* Day Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([1, 2] as const).map(day => (
          <button
            key={day}
            onClick={() => { setSelectedDay(day); setSelectedGroup(1); }}
            style={{
              background: selectedDay === day ? C.gold : C.surface,
              color: selectedDay === day ? '#000' : C.muted,
              border: `1px solid ${selectedDay === day ? C.gold : C.border}`,
              borderRadius: 6,
              padding: '7px 18px',
              fontSize: 14,
              fontWeight: selectedDay === day ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {day}日目
          </button>
        ))}
        {selectedDay === 2 && (
          <button
            onClick={handleCopyDay1}
            style={{
              background: `${C.blue2}22`,
              color: C.blue2,
              border: `1px solid ${C.blue2}`,
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 13,
              cursor: 'pointer',
              marginLeft: 8,
            }}
          >
            1日目からコピー
          </button>
        )}
      </div>

      {/* Error / Success */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13,
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13,
        }}>{success}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>読み込み中...</div>
      ) : (
        <>
          {/* Group Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {groupsInDay.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                style={{
                  background: selectedGroup === g ? C.surface2 : C.surface,
                  color: selectedGroup === g ? C.gold : C.muted,
                  border: `1px solid ${selectedGroup === g ? C.gold : C.border}`,
                  borderRadius: 5,
                  padding: '5px 14px',
                  fontSize: 13,
                  fontWeight: selectedGroup === g ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {g}組
              </button>
            ))}
            <button
              onClick={addGroup}
              style={{
                background: 'transparent',
                color: C.muted,
                border: `1px dashed ${C.border}`,
                borderRadius: 5,
                padding: '5px 12px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ＋組を追加
            </button>
          </div>

          {/* Input Table */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
                {selectedDay}日目 {selectedGroup}組 — メンバー入力
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: C.gold,
                  color: '#000',
                  border: 'none',
                  borderRadius: 5,
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? '保存中...' : 'この組を保存'}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {['番号', '会員番号', '氏名', '所属', 'クラス', '審判'].map(h => (
                      <th key={h} style={{
                        padding: '8px 10px',
                        fontSize: 12,
                        color: C.muted,
                        fontWeight: 600,
                        textAlign: 'left',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getRows(selectedDay, selectedGroup).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '6px 10px', color: C.muted, fontSize: 13, width: 36 }}>{idx + 1}</td>
                      <td style={{ padding: '4px 6px', width: 100 }}>
                        <input
                          type="text"
                          value={row.member_code}
                          onChange={e => updateRow(idx, 'member_code', e.target.value)}
                          style={inputStyle}
                          placeholder="例: 12345"
                        />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 120 }}>
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => updateRow(idx, 'name', e.target.value)}
                          style={inputStyle}
                          placeholder="氏名"
                        />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 120 }}>
                        <input
                          type="text"
                          value={row.belong}
                          onChange={e => updateRow(idx, 'belong', e.target.value)}
                          style={inputStyle}
                          placeholder="所属"
                        />
                      </td>
                      <td style={{ padding: '4px 6px', width: 72 }}>
                        <select
                          value={row.class}
                          onChange={e => updateRow(idx, 'class', e.target.value as ClassType | '')}
                          style={{ ...inputStyle, width: 60 }}
                        >
                          <option value="">-</option>
                          {(['A', 'B', 'C', 'D'] as ClassType[]).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 10px', width: 48, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={row.is_judge}
                          onChange={e => updateRow(idx, 'is_judge', e.target.checked)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.gold }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saved Members List */}
          {dayMembers.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 15, color: C.muted, fontWeight: 600, marginBottom: 12 }}>
                登録済みメンバー一覧（{selectedDay}日目 — {dayMembers.length}名）
              </h3>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: C.surface2 }}>
                        {['組', '番', '会員番号', '氏名', '所属', 'クラス', '審判'].map(h => (
                          <th key={h} style={{
                            padding: '7px 10px', fontSize: 11, color: C.muted, fontWeight: 600,
                            textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dayMembers.map(m => (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}33` }}>
                          <td style={{ padding: '5px 10px', fontSize: 13, color: C.muted }}>{m.group_number}組</td>
                          <td style={{ padding: '5px 10px', fontSize: 13, color: C.muted }}>{m.position}</td>
                          <td style={{ padding: '5px 10px', fontSize: 13, color: C.text }}>{m.member_code ?? '-'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 13, color: C.text, fontWeight: m.is_judge ? 600 : 400 }}>
                            {m.is_judge ? '⚑ ' : ''}{m.name}
                          </td>
                          <td style={{ padding: '5px 10px', fontSize: 13, color: C.muted }}>{m.belong ?? '-'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 13 }}>
                            {m.class ? (
                              <span style={{
                                background: classBadgeBg(m.class),
                                color: classBadgeColor(m.class),
                                borderRadius: 4,
                                padding: '1px 7px',
                                fontSize: 11,
                                fontWeight: 700,
                              }}>{m.class}</span>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '5px 10px', fontSize: 13, color: m.is_judge ? C.gold : C.muted }}>
                            {m.is_judge ? '✓' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function classBadgeBg(c: ClassType): string {
  return { A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133', D: '#9b59b633' }[c];
}
function classBadgeColor(c: ClassType): string {
  return { A: C.gold, B: '#3498db', C: '#2ecc71', D: '#9b59b6' }[c];
}
