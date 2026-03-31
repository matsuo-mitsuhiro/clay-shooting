'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { C } from '@/lib/colors';
import { PREFECTURES, DEFAULT_AFFILIATION } from '@/lib/prefectures';
import type { Member, ClassType } from '@/lib/types';
import BulkRegisterTab from './BulkRegisterTab';

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

interface SlotItem {
  group: number;
  position: number;
  member: Member | null;
}

const POSITIONS = 6;
const emptyRow = (): MemberRow => ({ member_code: '', name: '', belong: DEFAULT_AFFILIATION, class: '', is_judge: false });

function SortablePlayerRow({ slot }: { slot: SlotItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `slot-${slot.group}-${slot.position}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={{ ...style, borderBottom: `1px solid ${C.border}33` }}>
      <td style={{ padding: '5px 10px', color: C.muted, fontSize: 15 }}>{slot.group}組</td>
      <td style={{ padding: '5px 10px', color: C.muted, fontSize: 15 }}>{slot.position}</td>
      <td style={{ padding: '5px 10px', color: C.text, fontSize: 15 }}>
        {slot.member ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span {...attributes} {...listeners} style={{ cursor: 'grab', color: C.muted, fontSize: 18, userSelect: 'none' }}>⠿</span>
            {slot.member.name}{slot.member.is_judge ? <span style={{ color: C.gold }}>⚑</span> : ''}
          </div>
        ) : <span style={{ color: C.gold }}>－（空き）</span>}
      </td>
      <td style={{ padding: '5px 10px', color: C.muted, fontSize: 15 }}>{slot.member?.belong ?? '-'}</td>
      <td style={{ padding: '5px 10px', fontSize: 15 }}>
        {slot.member?.class ? (
          <span style={{
            background: classBadgeBg(slot.member.class),
            color: classBadgeColor(slot.member.class),
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 13,
            fontWeight: 700,
          }}>{slot.member.class}</span>
        ) : '-'}
      </td>
    </tr>
  );
}

export default function MembersTab({ tournamentId }: Props) {
  const [showBulk, setShowBulk] = useState(false);
  const [selectedDay, setSelectedDay] = useState<1 | 2>(1);
  const [groupCount, setGroupCount] = useState<{ 1: number; 2: number }>({ 1: 1, 2: 1 });
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [groups, setGroups] = useState<{ [key: string]: MemberRow[] }>({});
  const [savedMembers, setSavedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderItems, setReorderItems] = useState<SlotItem[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      setError(e instanceof Error ? e.message : '選手の取得に失敗しました');
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

  const clearRow = (idx: number) => {
    const rows = [...getRows(selectedDay, selectedGroup)];
    rows[idx] = emptyRow();
    setRows(selectedDay, selectedGroup, rows);
  };

  const normalizeCode = (v: string) =>
    v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();

  async function lookupPlayer(idx: number, rawCode: string) {
    const code = normalizeCode(rawCode);
    if (!code) return;
    updateRow(idx, 'member_code', code);
    try {
      const res = await fetch(`/api/players?code=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;
      const p = json.data;
      const rows = [...getRows(selectedDay, selectedGroup)];
      rows[idx] = {
        ...rows[idx],
        member_code: code,
        name: p.name,
        belong: p.affiliation ?? DEFAULT_AFFILIATION,
        is_judge: p.is_judge,
        class: (p.class ?? '') as ClassType | '',
      };
      setRows(selectedDay, selectedGroup, rows);
    } catch {
      // マスター未登録の場合はそのまま手入力
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

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

    // 重複チェック（具体的なメッセージ）
    const codeMap = new Map<string, { group: number; position: number }>();
    for (const m of allMembers) {
      if (!m.member_code) continue;
      const prev = codeMap.get(m.member_code);
      if (prev) {
        setError(`${m.group_number}組 ${m.position}番の会員番号「${m.member_code}」と${prev.group}組 ${prev.position}番の会員番号が重複しています`);
        return;
      }
      codeMap.set(m.member_code, { group: m.group_number, position: m.position });
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

      // player_master のクラス・審判フラグを更新（member_codeがある選手のみ）
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

  async function handleDeleteMember(m: Member) {
    let hasScores = false;
    if (m.member_code) {
      const res = await fetch(`/api/tournaments/${tournamentId}/members/${m.id}`);
      const json = await res.json();
      if (json.success) hasScores = json.data.hasScores;
    }

    if (hasScores) {
      const confirmed = window.confirm(`${m.name}の点数データも削除されます。削除しますか？`);
      if (!confirmed) return;
    }

    const res = await fetch(`/api/tournaments/${tournamentId}/members/${m.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      await fetchMembers();
      setSuccess(`${m.name}を削除しました`);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(json.error || '削除に失敗しました');
    }
  }

  function enterReorderMode() {
    const dayMems = savedMembers.filter(m => m.day === selectedDay);
    const count = groupCount[selectedDay];
    const slots: SlotItem[] = [];
    for (let g = 1; g <= count; g++) {
      for (let p = 1; p <= POSITIONS; p++) {
        const member = dayMems.find(m => m.group_number === g && m.position === p) || null;
        slots.push({ group: g, position: p, member });
      }
    }
    setReorderItems(slots);
    setReorderMode(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setReorderItems(items => {
      const oldIdx = items.findIndex(s => `slot-${s.group}-${s.position}` === active.id);
      const newIdx = items.findIndex(s => `slot-${s.group}-${s.position}` === over.id);
      if (oldIdx === -1 || newIdx === -1) return items;

      // Swap only member data, keep group/position fixed
      const newItems = items.map(item => ({ ...item }));
      const tempMember = newItems[oldIdx].member;
      newItems[oldIdx].member = newItems[newIdx].member;
      newItems[newIdx].member = tempMember;
      return newItems;
    });
  }

  async function handleSaveReorder() {
    setError(null);
    setSuccess(null);
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

    for (const slot of reorderItems) {
      if (!slot.member) continue;
      const m = slot.member;
      allMembers.push({
        day: selectedDay,
        group_number: slot.group,
        position: slot.position,
        member_code: m.member_code ?? undefined,
        name: m.name,
        belong: m.belong ?? undefined,
        class: (m.class ?? undefined) as ClassType | undefined,
        is_judge: m.is_judge,
      });
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
      await fetchMembers();
      setReorderMode(false);
      setSuccess('組替を保存しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const dayMembers = savedMembers.filter(m => m.day === selectedDay);
  const groupsInDay = Array.from({ length: groupCount[selectedDay] }, (_, i) => i + 1);

  // Generate all slots for registered list (including empty ones)
  const allSlots: SlotItem[] = [];
  for (let g = 1; g <= groupCount[selectedDay]; g++) {
    for (let p = 1; p <= POSITIONS; p++) {
      const member = dayMembers.find(m => m.group_number === g && m.position === p) || null;
      allSlots.push({ group: g, position: p, member });
    }
  }

  const inputStyle: React.CSSProperties = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '5px 7px',
    fontSize: 15,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      {/* Day Tabs（選手一括登録 / 1日目 / 2日目） */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => { setShowBulk(true); setReorderMode(false); }}
          style={{
            background: showBulk ? C.gold : C.surface,
            color: showBulk ? '#000' : C.muted,
            border: `1px solid ${showBulk ? C.gold : C.border}`,
            borderRadius: 6,
            padding: '7px 18px',
            fontSize: 16,
            fontWeight: showBulk ? 700 : 400,
            cursor: 'pointer',
          }}
        >
          選手一括登録
        </button>
        {([1, 2] as const).map(day => (
          <button
            key={day}
            onClick={() => { setShowBulk(false); setSelectedDay(day); setSelectedGroup(1); setReorderMode(false); }}
            style={{
              background: !showBulk && selectedDay === day ? C.gold : C.surface,
              color: !showBulk && selectedDay === day ? '#000' : C.muted,
              border: `1px solid ${!showBulk && selectedDay === day ? C.gold : C.border}`,
              borderRadius: 6,
              padding: '7px 18px',
              fontSize: 16,
              fontWeight: !showBulk && selectedDay === day ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {day}日目
          </button>
        ))}
        {!showBulk && selectedDay === 2 && (
          <button
            onClick={handleCopyDay1}
            style={{
              background: `${C.blue2}22`,
              color: C.blue2,
              border: `1px solid ${C.blue2}`,
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 15,
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
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 15,
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 15,
        }}>{success}</div>
      )}

      {/* 選手一括登録タブ */}
      {showBulk && (
        <BulkRegisterTab tournamentId={tournamentId} onSaved={fetchMembers} />
      )}

      {!showBulk && loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>読み込み中...</div>
      ) : !showBulk ? (
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
                  fontSize: 15,
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
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              ＋組を追加
            </button>
          </div>

          {/* Input Table */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: C.text, fontSize: 16 }}>
                {selectedDay}日目 {selectedGroup}組 — 選手入力
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
                  fontSize: 15,
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
                    {[
                      { label: '番号', color: C.muted },
                      { label: '会員番号', color: C.muted },
                      { label: '氏名', color: C.muted },
                      { label: '所属', color: C.muted },
                      { label: 'クラス', color: C.muted },
                      { label: '審判フラグ', color: C.muted },
                      { label: '削除', color: '#e74c3c' },
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px 10px',
                        fontSize: 14,
                        color: h.color,
                        fontWeight: 600,
                        textAlign: 'left',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getRows(selectedDay, selectedGroup).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '6px 10px', color: C.muted, fontSize: 15, width: 36 }}>{idx + 1}</td>
                      <td style={{ padding: '4px 6px', width: 100 }}>
                        <input
                          type="text"
                          value={row.member_code}
                          onChange={e => updateRow(idx, 'member_code', e.target.value)}
                          onBlur={e => lookupPlayer(idx, e.target.value)}
                          style={inputStyle}
                          placeholder="例: 12345"
                        />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 140 }}>
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => updateRow(idx, 'name', e.target.value)}
                          style={{ ...inputStyle }}
                          placeholder="氏名"
                        />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 110 }}>
                        <select
                          value={row.belong}
                          onChange={e => updateRow(idx, 'belong', e.target.value)}
                          style={{ ...inputStyle, width: '100%' }}
                        >
                          {PREFECTURES.map(p => (
                            <option key={p.cd} value={p.name}>{p.name}</option>
                          ))}
                        </select>
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
                      <td style={{ padding: '4px 6px', width: 60, textAlign: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={row.is_judge}
                            onChange={e => updateRow(idx, 'is_judge', e.target.checked)}
                            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: C.gold }}
                          />
                          <span style={{ fontSize: 15, color: row.is_judge ? C.gold : C.muted }}>⚑</span>
                        </label>
                      </td>
                      <td style={{ padding: '4px 6px', width: 36, textAlign: 'center' }}>
                        <button onClick={() => clearRow(idx)} style={{ background: 'transparent', color: C.muted, border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 選手組替 button */}
          {dayMembers.length > 0 && (
            <div style={{ marginTop: 20, marginBottom: 4, display: 'flex', justifyContent: 'flex-start' }}>
              <button
                onClick={() => {
                  if (reorderMode) {
                    setReorderMode(false);
                  } else {
                    enterReorderMode();
                  }
                }}
                style={{ background: C.surface2, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
              >
                {reorderMode ? '組替をキャンセル' : '選手組替'}
              </button>
            </div>
          )}

          {/* Reorder Mode */}
          {reorderMode && (
            <div style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface2 }}>
                <span style={{ fontWeight: 600, color: C.gold, fontSize: 16 }}>選手組替モード — ⠿ アイコンをドラッグして移動</span>
                <button
                  onClick={handleSaveReorder}
                  disabled={saving}
                  style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '6px 16px', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? '保存中...' : '組替を保存'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={reorderItems.map(s => `slot-${s.group}-${s.position}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                      <thead>
                        <tr style={{ background: C.surface2 }}>
                          {['組', '番', '氏名', '所属', 'クラス'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', fontSize: 13, color: C.muted, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reorderItems.map(slot => (
                          <SortablePlayerRow key={`slot-${slot.group}-${slot.position}`} slot={slot} />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          {/* Saved Members List */}
          {!reorderMode && dayMembers.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 17, color: C.muted, fontWeight: 600, marginBottom: 12 }}>
                登録済み選手一覧（{selectedDay}日目 — {dayMembers.length}名）
              </h3>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: C.surface2 }}>
                        {['組', '番', '会員番号', '氏名　審判フラグ', '所属', 'クラス', '操作'].map(h => (
                          <th key={h} style={{
                            padding: '7px 10px', fontSize: 13, color: C.muted, fontWeight: 600,
                            textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allSlots.map(slot => (
                        <tr key={`${slot.group}-${slot.position}`} style={{
                          borderBottom: `1px solid ${C.border}33`,
                          borderLeft: !slot.member ? `3px solid ${C.gold}` : '3px solid transparent',
                          background: !slot.member ? `${C.gold}0a` : 'transparent',
                        }}>
                          <td style={{ padding: '5px 10px', fontSize: 15, color: C.muted }}>{slot.group}組</td>
                          <td style={{ padding: '5px 10px', fontSize: 15, color: C.muted }}>{slot.position}</td>
                          {slot.member ? (
                            <>
                              <td style={{ padding: '5px 10px', fontSize: 15, color: C.text }}>{slot.member.member_code ?? '-'}</td>
                              <td style={{ padding: '5px 10px', fontSize: 15, color: C.text, fontWeight: slot.member.is_judge ? 600 : 400 }}>
                                {slot.member.name}{slot.member.is_judge ? <span style={{ color: C.gold, marginLeft: 4 }}>⚑</span> : ''}
                              </td>
                              <td style={{ padding: '5px 10px', fontSize: 15, color: C.muted }}>{slot.member.belong ?? '-'}</td>
                              <td style={{ padding: '5px 10px', fontSize: 15 }}>
                                {slot.member.class ? <span style={{ background: classBadgeBg(slot.member.class), color: classBadgeColor(slot.member.class), borderRadius: 4, padding: '1px 7px', fontSize: 13, fontWeight: 700 }}>{slot.member.class}</span> : '-'}
                              </td>
                              <td style={{ padding: '5px 10px' }}>
                                <button onClick={() => handleDeleteMember(slot.member!)} style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 4, padding: '3px 10px', fontSize: 13, cursor: 'pointer' }}>削除</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td colSpan={5} style={{ padding: '5px 10px', fontSize: 15, color: C.gold }}>－（空き）</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function classBadgeBg(c: ClassType): string {
  return { A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133', D: '#9b59b633' }[c];
}
function classBadgeColor(c: ClassType): string {
  return { A: C.gold, B: '#3498db', C: '#2ecc71', D: '#9b59b6' }[c];
}
