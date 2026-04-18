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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { C } from '@/lib/colors';
import type { Member, ClassType, ScoreStatus, Tournament, Result } from '@/lib/types';
import { PREFECTURES } from '@/lib/prefectures';
import LoadingOverlay from '@/components/LoadingOverlay';
import { ConfirmModal, ErrorModal } from '@/components/ModalDialog';

interface Props {
  tournamentId: number;
  tournament: Tournament | null;
  onNavigateToApplySettings?: () => void;
}

interface SlotItem {
  group: number;
  position: number;
  member: Member | null;
}

const POSITIONS = 6;

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

interface UnregisteredEntry {
  member_code: string;
  name: string;
  belong: string | null;
  participation_day: string;
}

// Edit mode: data snapshot per member
interface EditableMember {
  id: number;
  member_code: string | null;
  belong: string | null;
  class: ClassType | null;
  is_judge: boolean;
  is_non_prize: boolean;
}

interface MemberChange {
  id: number;
  member_code: string | null;
  belong: string | null;
  class: ClassType | null;
  is_judge: boolean;
  is_non_prize: boolean;
  memberCodeChanged: boolean;
}

export default function MembersTab({ tournamentId, tournament, onNavigateToApplySettings }: Props) {
  const hasTwoDays = !!(tournament?.day2_date);

  const [selectedDay, setSelectedDay] = useState<1 | 2>(1);
  const [groupCount, setGroupCount] = useState<{ 1: number; 2: number }>({ 1: 1, 2: 1 });
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [savedMembers, setSavedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderItems, setReorderItems] = useState<SlotItem[]>([]);
  const [unregistered, setUnregistered] = useState<UnregisteredEntry[]>([]);
  const [associationNames, setAssociationNames] = useState<string[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ScoreStatus>>({});

  // Delete modal state (両日参加者用)
  const [deleteModal, setDeleteModal] = useState<{ member: Member; hasScores: boolean } | null>(null);
  const [deleteScope, setDeleteScope] = useState<'day1' | 'day2' | 'both'>('day1');

  // Confirm modal state (片日参加者削除用)
  const [simpleConfirm, setSimpleConfirm] = useState<{ message: string; onOk: () => void } | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editedMembers, setEditedMembers] = useState<EditableMember[]>([]);
  const [snapshotMembers, setSnapshotMembers] = useState<EditableMember[]>([]);

  // 会員番号変更で選手マスター未登録コードがあった場合の確認モーダル
  const [memberCodeWarn, setMemberCodeWarn] = useState<{ unknown: string[]; pendingChanges: MemberChange[] } | null>(null);

  useEffect(() => {
    fetch('/api/associations')
      .then(r => r.json())
      .then(j => {
        if (j.success) setAssociationNames((j.data as { name: string }[]).map(a => a.name));
      })
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/members`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const members: Member[] = json.data;
      setSavedMembers(members);

      const maxGroupPerDay: { [day: number]: number } = { 1: 1, 2: 1 };
      for (const m of members) {
        if (m.group_number > (maxGroupPerDay[m.day] ?? 1)) {
          maxGroupPerDay[m.day] = m.group_number;
        }
      }
      setGroupCount({ 1: maxGroupPerDay[1] ?? 1, 2: maxGroupPerDay[2] ?? 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : '選手の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  const fetchScoreStatuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/scores`);
      const json = await res.json();
      if (json.success) {
        const map: Record<string, ScoreStatus> = {};
        for (const s of json.data as { member_code: string; status?: ScoreStatus }[]) {
          if (s.member_code) map[s.member_code] = s.status ?? 'valid';
        }
        setStatusMap(map);
      }
    } catch { /* ignore */ }
  }, [tournamentId]);

  useEffect(() => {
    fetchMembers();
    fetchUnregistered();
    fetchScoreStatuses();
  }, [fetchMembers, fetchScoreStatuses]);

  async function fetchUnregistered() {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/unregistered`);
      const json = await res.json();
      if (json.success) setUnregistered(json.data);
    } catch {
      // ignore
    }
  }

  // --- Edit mode helpers ---
  function enterEditMode() {
    const snapshot: EditableMember[] = savedMembers.map(m => ({
      id: m.id,
      member_code: m.member_code,
      belong: m.belong,
      class: m.class,
      is_judge: m.is_judge,
      is_non_prize: m.is_non_prize,
    }));
    setSnapshotMembers(snapshot);
    setEditedMembers(snapshot.map(s => ({ ...s })));
    setEditing(true);
    setError(null);
    setSuccess(null);
  }

  function cancelEditMode() {
    // Restore savedMembers from snapshot
    setSavedMembers(prev =>
      prev.map(m => {
        const snap = snapshotMembers.find(s => s.id === m.id);
        if (!snap) return m;
        return { ...m, member_code: snap.member_code, belong: snap.belong, class: snap.class, is_judge: snap.is_judge, is_non_prize: snap.is_non_prize };
      })
    );
    setEditing(false);
    setEditedMembers([]);
    setSnapshotMembers([]);
    setError(null);
  }

  function updateEditedMember(memberId: number, field: 'member_code' | 'belong' | 'class' | 'is_judge' | 'is_non_prize', value: string | boolean | null) {
    // 賞典外フラグは同一 member_code の両日分に同期
    if (field === 'is_non_prize') {
      const target = editedMembers.find(em => em.id === memberId);
      const code = target?.member_code ?? null;
      setEditedMembers(prev =>
        prev.map(em => {
          if (em.id === memberId) return { ...em, is_non_prize: !!value };
          if (code && em.member_code === code) return { ...em, is_non_prize: !!value };
          return em;
        })
      );
      setSavedMembers(prev =>
        prev.map(m => {
          if (m.id === memberId) return { ...m, is_non_prize: !!value };
          if (code && m.member_code === code) return { ...m, is_non_prize: !!value };
          return m;
        })
      );
      return;
    }

    setEditedMembers(prev =>
      prev.map(em => em.id === memberId ? { ...em, [field]: value } : em)
    );
    // Also update local display
    setSavedMembers(prev =>
      prev.map(m => m.id === memberId ? { ...m, [field]: value } : m)
    );
  }

  async function saveEditMode() {
    setError(null);
    // Find changed rows — 同一 member_code の両日分の重複変更は1件にまとめる
    const normalizeCode = (s: string | null) => {
      if (!s) return null;
      const trimmed = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
      return trimmed || null;
    };

    // 会員番号変更の検証: 半角数字のみ
    for (const edited of editedMembers) {
      const snap = snapshotMembers.find(s => s.id === edited.id);
      if (!snap) continue;
      const newCode = normalizeCode(edited.member_code);
      if (newCode && !/^\d+$/.test(newCode)) {
        setError(`会員番号は半角数字のみで入力してください（ID=${edited.id}）`);
        return;
      }
    }

    const changes: MemberChange[] = [];
    const seenCodePairs = new Set<string>(); // 両日分の同一コード変更の重複を除外
    for (const edited of editedMembers) {
      const snap = snapshotMembers.find(s => s.id === edited.id);
      if (!snap) continue;
      const newCode = normalizeCode(edited.member_code);
      const oldCode = snap.member_code;
      const codeChanged = newCode !== oldCode;

      // 会員番号変更は同一oldCodeで両日分ある場合、1回だけ処理する（APIが両日分を一括更新）
      if (codeChanged && oldCode) {
        const key = `code:${oldCode}`;
        if (seenCodePairs.has(key)) {
          // 他プロパティの変更があれば別行として処理する必要がある
          if (edited.belong !== snap.belong || edited.class !== snap.class || edited.is_judge !== snap.is_judge || edited.is_non_prize !== snap.is_non_prize) {
            changes.push({ id: edited.id, member_code: newCode, belong: edited.belong, class: edited.class, is_judge: edited.is_judge, is_non_prize: edited.is_non_prize, memberCodeChanged: false });
          }
          continue;
        }
        seenCodePairs.add(key);
      }

      if (codeChanged || edited.belong !== snap.belong || edited.class !== snap.class || edited.is_judge !== snap.is_judge || edited.is_non_prize !== snap.is_non_prize) {
        changes.push({ id: edited.id, member_code: newCode, belong: edited.belong, class: edited.class, is_judge: edited.is_judge, is_non_prize: edited.is_non_prize, memberCodeChanged: codeChanged });
      }
    }

    if (changes.length === 0) {
      setEditing(false);
      setEditedMembers([]);
      setSnapshotMembers([]);
      return;
    }

    // 会員番号変更があれば選手マスターに存在するか事前チェック
    const codeChanges = changes.filter(c => c.memberCodeChanged && c.member_code);
    const unknownCodes: string[] = [];
    for (const c of codeChanges) {
      try {
        const res = await fetch(`/api/players?code=${encodeURIComponent(c.member_code!)}`);
        const json = await res.json();
        if (!json.success) unknownCodes.push(c.member_code!);
      } catch {
        unknownCodes.push(c.member_code!);
      }
    }

    if (unknownCodes.length > 0) {
      setMemberCodeWarn({ unknown: Array.from(new Set(unknownCodes)), pendingChanges: changes });
      return;
    }

    await applyMemberChanges(changes);
  }

  async function applyMemberChanges(changes: MemberChange[]) {
    try {
      setSaving(true);
      const errors: string[] = [];
      for (const c of changes) {
        const body: Record<string, unknown> = {};
        const snap = snapshotMembers.find(s => s.id === c.id);
        if (snap) {
          if (c.memberCodeChanged) body.member_code = c.member_code;
          if (c.belong !== snap.belong) body.belong = c.belong;
          if (c.class !== snap.class) body.class = c.class;
          if (c.is_judge !== snap.is_judge) body.is_judge = c.is_judge;
          if (c.is_non_prize !== snap.is_non_prize) body.is_non_prize = c.is_non_prize;
        }
        const res = await fetch(`/api/tournaments/${tournamentId}/members/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.success) {
          errors.push(json.error || `ID=${c.id}の更新に失敗`);
        }
      }
      if (errors.length > 0) {
        setError(errors.join('; '));
      } else {
        setSuccess(`${changes.length}件を保存しました`);
        setTimeout(() => setSuccess(null), 3000);
      }
      setEditing(false);
      setEditedMembers([]);
      setSnapshotMembers([]);
      setMemberCodeWarn(null);
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(memberCode: string, status: ScoreStatus) {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/scores/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_code: memberCode, status }),
      });
      const json = await res.json();
      if (json.success) {
        setStatusMap(prev => ({ ...prev, [memberCode]: status }));
      } else {
        setError(json.error || 'ステータスの変更に失敗しました');
      }
    } catch {
      setError('ステータスの変更に失敗しました');
    }
  }

  async function handleDeleteMember(m: Member) {
    let hasScores = false;
    if (m.member_code) {
      const res = await fetch(`/api/tournaments/${tournamentId}/members/${m.id}`);
      const json = await res.json();
      if (json.success) hasScores = json.data.hasScores;
    }

    // 両日に同じmember_codeが存在するか判定
    const isBothDayMember = m.member_code
      ? savedMembers.some(sm => sm.member_code === m.member_code && sm.day !== m.day)
      : false;

    if (isBothDayMember) {
      // 両日参加者 → モーダル表示
      setDeleteScope(selectedDay === 1 ? 'day1' : 'day2');
      setDeleteModal({ member: m, hasScores });
      return;
    }

    // 片日のみ → モーダルで確認
    const msg = hasScores
      ? `${m.name}の点数データも削除されます。削除しますか？`
      : `${m.name}を削除しますか？`;
    setSimpleConfirm({
      message: msg,
      onOk: () => {
        setSimpleConfirm(null);
        executeDelete(m.id, 'both');
      },
    });
  }

  async function executeDelete(memberId: number, scope: 'day1' | 'day2' | 'both') {
    try {
      setSaving(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteScope: scope }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchMembers();
        const msgs: string[] = [];
        if (json.data?.deletedName) msgs.push(`${json.data.deletedName}を削除しました`);
        if (json.data?.cancelledRegistration) msgs.push('申込管理リストはキャンセルとして残ります');
        if (json.data?.updatedParticipation) {
          const remainLabel = scope === 'day1' ? '2日目' : '1日目';
          msgs.push(`申込の参加日を「${remainLabel}」に変更しました`);
        }
        setSuccess(msgs.join('。') || '削除しました');
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(json.error || '削除に失敗しました');
      }
    } catch {
      setError('削除に失敗しました');
    } finally {
      setSaving(false);
      setDeleteModal(null);
    }
  }

  function addGroup() {
    setGroupCount(prev => ({ ...prev, [selectedDay]: prev[selectedDay] + 1 }));
    const newGroup = groupCount[selectedDay] + 1;
    setSelectedGroup(newGroup);
  }

  async function handleCopyDay1() {
    try {
      setSaving(true);
      const day1Members = savedMembers.filter(m => m.day === 1);
      const allMembers = day1Members.map(m => ({
        day: 2 as const,
        group_number: m.group_number,
        position: m.position,
        member_code: m.member_code ?? undefined,
        name: m.name,
        belong: m.belong ?? undefined,
        class: (m.class ?? undefined) as ClassType | undefined,
        is_judge: m.is_judge,
      }));

      const res = await fetch(`/api/tournaments/${tournamentId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: 2, members: allMembers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchMembers();
      setSuccess('1日目データをコピーしました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'コピーに失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // Reorder mode
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

  // ランダム組替
  function handleRandomShuffle() {
    if (!reorderItems.length) return;

    // 主催協会名を取得
    const organizerName = tournament?.organizer_cd
      ? PREFECTURES.find(p => p.cd === tournament.organizer_cd)?.name ?? null
      : null;

    // 現在の選手一覧を取り出す（空きスロットは除外）
    const allMembers = reorderItems
      .filter(s => s.member !== null)
      .map(s => s.member!);
    const numGroups = Math.max(...reorderItems.map(s => s.group));

    // 両日参加者を判定（反対の日にも同じmember_codeがいるか）
    const otherDay = selectedDay === 1 ? 2 : 1;
    const otherDayCodes = new Set(
      savedMembers.filter(m => m.day === otherDay && m.member_code).map(m => m.member_code!)
    );
    const isBothDays = (m: Member) => !!m.member_code && otherDayCodes.has(m.member_code);

    // 選手を分類
    const hostJudges: Member[] = [];   // 主催協会・審判
    const hostNon: Member[] = [];      // 主催協会・非審判
    const otherJudges: Member[] = [];  // 他協会・審判
    const otherNon: Member[] = [];     // 他協会・非審判

    // シャッフル用ユーティリティ
    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    allMembers.forEach(m => {
      const isHost = organizerName && m.belong === organizerName;
      if (isHost && m.is_judge) hostJudges.push(m);
      else if (isHost) hostNon.push(m);
      else if (m.is_judge) otherJudges.push(m);
      else otherNon.push(m);
    });

    // 他協会の審判を参加人数の多い協会順にソート
    const belongCounts: Record<string, number> = {};
    allMembers.forEach(m => {
      if (m.belong && m.belong !== organizerName) {
        belongCounts[m.belong] = (belongCounts[m.belong] || 0) + 1;
      }
    });
    const sortedOtherJudges = shuffle(otherJudges).sort((a, b) => {
      return (belongCounts[b.belong ?? ''] || 0) - (belongCounts[a.belong ?? ''] || 0);
    });

    // 各グループに配置する選手を決定
    // slots[g] = [射順1, 射順2, ..., 射順6] (0-indexed)
    const groupSlots: (Member | null)[][] = Array.from({ length: numGroups }, () =>
      Array(POSITIONS).fill(null)
    );

    // 使用済みフラグ
    const used = new Set<number>();

    function pickFrom(pool: Member[]): Member | null {
      for (let i = 0; i < pool.length; i++) {
        if (!used.has(pool[i].id)) {
          used.add(pool[i].id);
          return pool.splice(i, 1)[0];
        }
      }
      return null;
    }

    // シャッフル後、両日参加者を先頭にソート
    const bothFirst = <T extends Member>(arr: T[]) =>
      shuffle(arr).sort((a, b) => (isBothDays(a) ? 0 : 1) - (isBothDays(b) ? 0 : 1));
    const hj = bothFirst(hostJudges);
    const hn = bothFirst(hostNon);
    const oj = [...sortedOtherJudges].sort((a, b) => (isBothDays(a) ? 0 : 1) - (isBothDays(b) ? 0 : 1));

    // Step 1: 各組に主催協会を2名配置（射順1と射順4）
    // 理想: 両方審判、次善: 片方審判+片方非審判
    for (let g = 0; g < numGroups; g++) {
      // 射順1（前半）: 主催審判を優先
      const pos1 = pickFrom(hj) ?? pickFrom(hn);
      if (pos1) groupSlots[g][0] = pos1;

      // 射順4（後半）: 主催審判を優先
      const pos4 = pickFrom(hj) ?? pickFrom(hn);
      if (pos4) groupSlots[g][3] = pos4;
    }

    // Step 2: 審判不足の組を補充
    // 各組に最低1名の審判が必要。主催審判が配置できなかった組に他協会審判を入れる
    for (let g = 0; g < numGroups; g++) {
      const hasJudge = groupSlots[g].some(m => m && m.is_judge);
      if (!hasJudge) {
        // 主催が非審判×2で配置されている場合、他協会の審判を空き位置に追加
        // 前半（射順2,3）か後半（射順5,6）の空きに配置
        // 前半に主催非審判がいて後半に主催非審判がいる場合 → 射順5に他協会審判
        // 前半に主催非審判がいて後半が空の場合 → 射順4に他協会審判
        const judge = pickFrom(oj);
        if (judge) {
          // 後半に主催がいる → 前半の空きに審判を入れる（射順2）
          // 前半に主催がいる → 後半の空きに審判を入れる（射順5）
          if (groupSlots[g][3]) {
            // 後半に主催いる → 前半（射順2）に審判
            if (!groupSlots[g][1]) groupSlots[g][1] = judge;
            else if (!groupSlots[g][2]) groupSlots[g][2] = judge;
          } else if (groupSlots[g][0]) {
            // 前半に主催いる → 後半（射順5）に審判
            if (!groupSlots[g][4]) groupSlots[g][4] = judge;
            else if (!groupSlots[g][5]) groupSlots[g][5] = judge;
          } else {
            // 主催がいない → 射順1に審判
            if (!groupSlots[g][0]) groupSlots[g][0] = judge;
          }
        }
      }
    }

    // Step 3: まだ審判ゼロの組に対して、残りの他協会審判を配置
    for (let g = 0; g < numGroups; g++) {
      const hasJudge = groupSlots[g].some(m => m && m.is_judge);
      if (!hasJudge) {
        const judge = pickFrom(oj);
        if (judge) {
          const emptyIdx = groupSlots[g].findIndex(s => s === null);
          if (emptyIdx !== -1) groupSlots[g][emptyIdx] = judge;
        }
      }
    }

    // Step 4: 残りの選手を配置（両日参加者を前方の組に優先配置）
    const remainingAll = shuffle([...hj, ...hn, ...oj, ...otherNon].filter(m => !used.has(m.id)));
    // 両日参加者を先、片日のみを後にソート
    const remaining = remainingAll.sort((a, b) => {
      const aBoth = isBothDays(a) ? 0 : 1;
      const bBoth = isBothDays(b) ? 0 : 1;
      return aBoth - bBoth;
    });
    let rIdx = 0;
    for (let g = 0; g < numGroups; g++) {
      for (let p = 0; p < POSITIONS; p++) {
        if (!groupSlots[g][p] && rIdx < remaining.length) {
          groupSlots[g][p] = remaining[rIdx++];
        }
      }
    }

    // reorderItems に反映
    const newItems: SlotItem[] = [];
    for (let g = 0; g < numGroups; g++) {
      for (let p = 0; p < POSITIONS; p++) {
        newItems.push({
          group: g + 1,
          position: p + 1,
          member: groupSlots[g][p],
        });
      }
    }
    setReorderItems(newItems);
  }

  // 前日の成績順組替（2日目専用）
  async function handlePreviousDayRankShuffle() {
    if (!reorderItems.length || selectedDay !== 2) return;

    try {
      setSaving(true);

      // 1日目の成績を取得
      const [resultsRes, regsRes] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}/results`),
        fetch(`/api/tournaments/${tournamentId}/registrations`),
      ]);
      const resultsJson = await resultsRes.json();
      const regsJson = await regsRes.json();

      if (!resultsJson.success) throw new Error('成績の取得に失敗しました');

      const results: Result[] = resultsJson.data?.results ?? [];
      const registrations: { member_code: string; applied_at: string }[] =
        regsJson.success ? regsJson.data ?? [] : [];

      // 2日目の選手一覧
      const day2Members = reorderItems
        .filter(s => s.member !== null)
        .map(s => s.member!);

      // 1日目の member_code 一覧（day1 に参加した選手）
      const day1Codes = new Set(
        savedMembers.filter(m => m.day === 1 && m.member_code).map(m => m.member_code!)
      );

      // 成績マップ（member_code → Result）
      const resultMap = new Map<string, Result>();
      for (const r of results) {
        resultMap.set(r.member_code, r);
      }

      // 分類
      const block1Ranked: { member: Member; rank: number }[] = [];     // ① rank あり
      const block2NoRank: { member: Member; result: Result }[] = [];   // ② rank NULL + 点数あり
      const block3NoScore: Member[] = [];                              // ③ 点数なし
      const block4Day2Only: { member: Member; appliedAt: string }[] = []; // ④ 2日目のみ

      for (const m of day2Members) {
        if (!m.member_code || !day1Codes.has(m.member_code)) {
          // 1日目に不参加 → ブロック④
          const reg = registrations.find(r => r.member_code === m.member_code);
          block4Day2Only.push({ member: m, appliedAt: reg?.applied_at ?? '9999' });
          continue;
        }

        const result = resultMap.get(m.member_code);
        if (!result) {
          // 成績データなし → ブロック③
          block3NoScore.push(m);
          continue;
        }

        const hasScore = result.r1 != null || result.r2 != null || result.r3 != null || result.r4 != null;

        if (result.rank != null) {
          // ブロック①: 順位あり
          block1Ranked.push({ member: m, rank: Number(result.rank) });
        } else if (hasScore) {
          // ブロック②: 失格・棄権で点数あり
          block2NoRank.push({ member: m, result });
        } else {
          // ブロック③: 点数なし
          block3NoScore.push(m);
        }
      }

      // ① rank 昇順
      block1Ranked.sort((a, b) => a.rank - b.rank);

      // ② day1_total DESC → カウントバック（R4→R3→R2→R1 DESC）→ CB ASC → FR DESC
      block2NoRank.sort((a, b) => {
        const ra = a.result, rb = b.result;
        const d1a = Number(ra.day1_total) || 0, d1b = Number(rb.day1_total) || 0;
        if (d1a !== d1b) return d1b - d1a;
        // カウントバック（1日目のラウンド: R4→R3→R2→R1）
        for (const key of ['r4', 'r3', 'r2', 'r1'] as const) {
          const va = Number(ra[key]) || 0, vb = Number(rb[key]) || 0;
          if (va !== vb) return vb - va;
        }
        // CB ASC
        const cba = ra.cb != null ? Number(ra.cb) : 999;
        const cbb = rb.cb != null ? Number(rb.cb) : 999;
        if (cba !== cbb) return cba - cbb;
        // FR DESC
        const fra = Number(ra.fr) || 0, frb = Number(rb.fr) || 0;
        if (fra !== frb) return frb - fra;
        return 0;
      });

      // ④ applied_at 昇順
      block4Day2Only.sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));

      // 統合した並び順
      const sortedMembers: Member[] = [
        ...block1Ranked.map(b => b.member),
        ...block2NoRank.map(b => b.member),
        ...block3NoScore,
        ...block4Day2Only.map(b => b.member),
      ];

      // グループに配置（6名ずつ）
      const numGroups = Math.ceil(sortedMembers.length / POSITIONS);
      const newItems: SlotItem[] = [];
      for (let g = 0; g < numGroups; g++) {
        for (let p = 0; p < POSITIONS; p++) {
          const idx = g * POSITIONS + p;
          newItems.push({
            group: g + 1,
            position: p + 1,
            member: idx < sortedMembers.length ? sortedMembers[idx] : null,
          });
        }
      }
      setReorderItems(newItems);
    } catch (e) {
      setError(e instanceof Error ? e.message : '成績順組替に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const dayMembers = savedMembers.filter(m => m.day === selectedDay);
  const groupsInDay = Array.from({ length: groupCount[selectedDay] }, (_, i) => i + 1);

  // Members in selected group
  const groupMembers = dayMembers.filter(m => m.group_number === selectedGroup);

  const selectStyle: React.CSSProperties = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '4px 6px',
    fontSize: 14,
    cursor: 'pointer',
  };

  const dayLabel = (d: string) => d === 'day1' ? '1日目' : d === 'day2' ? '2日目' : '両日';

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1400, margin: '0 auto' }}>
      <LoadingOverlay show={loading || saving} message={loading ? '読み込み中...' : '保存中...'} />

      {/* 申込済み・未登録 警告バナー */}
      {unregistered.length > 0 && (
        <div style={{
          background: '#7a4a0022',
          border: '1px solid #d4870a',
          borderRadius: 8,
          padding: '14px 18px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ color: '#d4870a', fontWeight: 700, fontSize: 15 }}>
              申込済みだが選手未登録の方が {unregistered.length} 名います
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 10 }}>
            {unregistered.map(u => (
              <span key={u.member_code} style={{ fontSize: 14, color: '#e0a040' }}>
                {u.member_code}　{u.name}（{dayLabel(u.participation_day)}）
              </span>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#a07840' }}>
            選手管理で確認するか、申込管理タブでキャンセル処理してください。
          </p>
        </div>
      )}

      {/* Day Tabs（1日目 / 2日目） — 2日開催時のみ表示 */}
      {hasTwoDays && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {([1, 2] as const).map(day => (
            <button
              key={day}
              onClick={() => { setSelectedDay(day); setSelectedGroup(1); setReorderMode(false); setEditing(false); }}
              style={{
                background: selectedDay === day ? C.gold : C.surface,
                color: selectedDay === day ? '#000' : C.muted,
                border: `1px solid ${selectedDay === day ? C.gold : C.border}`,
                borderRadius: 6,
                padding: '7px 18px',
                fontSize: 16,
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
                fontSize: 15,
                cursor: 'pointer',
                marginLeft: 8,
              }}
            >
              1日目からコピー
            </button>
          )}
        </div>
      )}

      {/* Error / Success */}
      <ErrorModal message={error} onClose={() => setError(null)} />
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 15,
        }}>{success}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>読み込み中...</div>
      ) : (
        <>
          {/* 射順発表バナー（選手登録済み & 非公開時のみ） */}
          {savedMembers.length > 0 && !tournament?.squad_published_at && (
            <div style={{
              background: `${C.gold}18`,
              border: `1px solid ${C.gold}66`,
              borderRadius: 6,
              padding: '8px 14px',
              marginBottom: 12,
              fontSize: 14,
              color: C.text,
            }}>
              射順の選定が完了したら、
              <button
                onClick={onNavigateToApplySettings}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: C.gold, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                公開してください。
              </button>
            </div>
          )}

          {/* Group Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {groupsInDay.map(g => {
              const count = dayMembers.filter(m => m.group_number === g).length;
              return (
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
                  {g}組{count > 0 ? `（${count}名）` : ''}
                </button>
              );
            })}
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

          {/* Members Table */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: C.text, fontSize: 16 }}>
                {hasTwoDays ? `${selectedDay}日目 ` : ''}{selectedGroup}組（{groupMembers.length}名）
              </span>
              {/* Edit / Save / Cancel buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {editing ? (
                  <>
                    <button
                      onClick={cancelEditMode}
                      style={{
                        background: C.surface2,
                        color: C.muted,
                        border: `1px solid ${C.border}`,
                        borderRadius: 5,
                        padding: '5px 14px',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveEditMode}
                      disabled={saving}
                      style={{
                        background: C.gold,
                        color: '#000',
                        border: 'none',
                        borderRadius: 5,
                        padding: '5px 14px',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <button
                    onClick={enterEditMode}
                    disabled={reorderMode}
                    style={{
                      background: C.surface2,
                      color: C.gold,
                      border: `1px solid ${C.gold}`,
                      borderRadius: 5,
                      padding: '5px 14px',
                      fontSize: 14,
                      cursor: reorderMode ? 'not-allowed' : 'pointer',
                      opacity: reorderMode ? 0.5 : 1,
                    }}
                  >
                    編集
                  </button>
                )}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {[
                      { label: '射順', width: 50, sticky: true, left: 0 },
                      { label: '会員番号', width: 90 },
                      { label: '氏名', width: undefined, sticky: true, left: 50 },
                      { label: '賞典外', width: 60 },
                      { label: '所属協会', width: 140 },
                      { label: 'クラス', width: 80 },
                      { label: '審判', width: 60 },
                      { label: '成績', width: 80 },
                      { label: '操作', width: 60 },
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px 10px',
                        fontSize: 14,
                        color: C.muted,
                        fontWeight: 600,
                        textAlign: 'left',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                        width: h.width,
                        ...(h.sticky ? { position: 'sticky' as const, left: h.left, zIndex: 2, background: C.surface2 } : {}),
                      }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [];
                    for (let p = 1; p <= POSITIONS; p++) {
                      const member = groupMembers.find(m => m.position === p);
                      rows.push(
                        <tr key={p} style={{
                          borderBottom: `1px solid ${C.border}33`,
                          borderLeft: !member ? `3px solid ${C.gold}` : '3px solid transparent',
                          background: !member ? `${C.gold}0a` : 'transparent',
                        }}>
                          <td style={{ padding: '6px 10px', color: C.muted, fontSize: 15, position: 'sticky', left: 0, zIndex: 1, background: !member ? `${C.gold}0a` : C.surface }}>{p}</td>
                          {member ? (
                            <>
                              <td style={{ padding: '4px 6px', fontSize: 15, color: C.text }}>
                                {editing ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={member.member_code ?? ''}
                                    onChange={e => updateEditedMember(member.id, 'member_code', e.target.value || null)}
                                    placeholder="会員番号"
                                    style={{
                                      ...selectStyle,
                                      width: 80,
                                      fontFamily: 'monospace',
                                    }}
                                  />
                                ) : (
                                  member.member_code ?? '-'
                                )}
                              </td>
                              <td style={{ padding: '6px 10px', fontSize: 15, color: C.text, fontWeight: 500, position: 'sticky', left: 50, zIndex: 1, background: C.surface }}>
                                {member.name}
                              </td>
                              {/* 賞典外 */}
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {editing ? (
                                  <input
                                    type="checkbox"
                                    checked={member.is_non_prize}
                                    onChange={e => updateEditedMember(member.id, 'is_non_prize', e.target.checked)}
                                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.gold }}
                                  />
                                ) : (
                                  <span style={{ fontSize: 15, color: member.is_non_prize ? C.gold : C.muted }}>
                                    {member.is_non_prize ? '✓' : ''}
                                  </span>
                                )}
                              </td>
                              {/* 所属協会 */}
                              <td style={{ padding: '4px 6px' }}>
                                {editing ? (
                                  <select
                                    value={member.belong ?? ''}
                                    onChange={e => updateEditedMember(member.id, 'belong', e.target.value || null)}
                                    style={selectStyle}
                                  >
                                    <option value="">---</option>
                                    {associationNames.map(name => (
                                      <option key={name} value={name}>{name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: 15, color: C.text }}>{member.belong ?? '-'}</span>
                                )}
                              </td>
                              {/* クラス */}
                              <td style={{ padding: '4px 6px' }}>
                                {editing ? (
                                  <select
                                    value={member.class ?? ''}
                                    onChange={e => updateEditedMember(member.id, 'class', e.target.value || null)}
                                    style={{ ...selectStyle, width: 60 }}
                                  >
                                    <option value="">-</option>
                                    {(['AAA', 'AA', 'A', 'B', 'C'] as ClassType[]).map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                ) : (
                                  member.class ? (
                                    <span style={{
                                      background: classBadgeBg(member.class),
                                      color: classBadgeColor(member.class),
                                      borderRadius: 4,
                                      padding: '1px 7px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}>{member.class}</span>
                                  ) : <span style={{ color: C.muted }}>-</span>
                                )}
                              </td>
                              {/* 審判 */}
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {editing ? (
                                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={member.is_judge}
                                      onChange={e => updateEditedMember(member.id, 'is_judge', e.target.checked)}
                                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: C.gold }}
                                    />
                                    <span style={{ fontSize: 15, color: member.is_judge ? C.gold : C.muted }}>⚑</span>
                                  </label>
                                ) : (
                                  <span style={{ fontSize: 15, color: member.is_judge ? C.gold : C.muted }}>
                                    {member.is_judge ? '⚑' : '-'}
                                  </span>
                                )}
                              </td>
                              {/* 成績 */}
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {member.member_code ? (
                                  <select
                                    value={statusMap[member.member_code] ?? 'valid'}
                                    onChange={e => handleStatusChange(member.member_code!, e.target.value as ScoreStatus)}
                                    style={{
                                      background: C.inputBg,
                                      border: `1px solid ${(statusMap[member.member_code] === 'disqualified' || statusMap[member.member_code] === 'withdrawn') ? '#e74c3c' : C.border}`,
                                      borderRadius: 4,
                                      color: (statusMap[member.member_code] === 'disqualified' || statusMap[member.member_code] === 'withdrawn') ? '#e74c3c' : C.text,
                                      padding: '4px 6px', fontSize: 13, cursor: 'pointer',
                                      fontWeight: (statusMap[member.member_code] === 'disqualified' || statusMap[member.member_code] === 'withdrawn') ? 700 : 400,
                                    }}
                                  >
                                    <option value="valid">有効</option>
                                    <option value="disqualified">失格</option>
                                    <option value="withdrawn">棄権</option>
                                  </select>
                                ) : (
                                  <span style={{ color: C.muted, fontSize: 13 }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeleteMember(member)}
                                  style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 4, padding: '3px 10px', fontSize: 13, cursor: 'pointer' }}
                                >
                                  削除
                                </button>
                              </td>
                            </>
                          ) : (
                            <td colSpan={8} style={{ padding: '6px 10px', fontSize: 15, color: C.gold, position: 'sticky', left: 50, zIndex: 1, background: `${C.gold}0a` }}>
                              －（空き）
                            </td>
                          )}
                        </tr>
                      );
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* 選手組替 button */}
          {dayMembers.length > 0 && !editing && (
            <div style={{ marginTop: 20, marginBottom: 4, display: 'flex', justifyContent: 'flex-start', gap: 10 }}>
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
              {reorderMode && (
                <button
                  onClick={handleRandomShuffle}
                  style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
                >
                  ランダム組替
                </button>
              )}
              {reorderMode && selectedDay === 2 && (
                <button
                  onClick={handlePreviousDayRankShuffle}
                  disabled={saving}
                  style={{ background: '#2980b9', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? '処理中...' : '前日の成績順組替'}
                </button>
              )}
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
                          {['組', '射順', '氏名', '所属協会', 'クラス'].map(h => (
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
        </>
      )}

      {/* 両日参加者 削除モーダル */}
      {deleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setDeleteModal(null)}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '24px 28px', maxWidth: 400, width: '90%',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>
              {deleteModal.member.name}（{deleteModal.member.belong ?? '-'}）
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: C.text }}>
              削除する日を選択してください。
            </p>
            {deleteModal.hasScores && (
              <p style={{ margin: '0 0 12px', fontSize: 14, color: C.red }}>
                ※ 点数データも削除されます
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(['day1', 'day2', 'both'] as const).map(scope => (
                <label key={scope} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '8px 12px', borderRadius: 6,
                  background: deleteScope === scope ? `${C.gold}22` : 'transparent',
                  border: `1px solid ${deleteScope === scope ? C.gold : C.border}`,
                }}>
                  <input
                    type="radio" name="deleteScope" value={scope}
                    checked={deleteScope === scope}
                    onChange={() => setDeleteScope(scope)}
                    style={{ accentColor: C.gold }}
                  />
                  <span style={{ fontSize: 15, color: C.text, fontWeight: deleteScope === scope ? 700 : 400 }}>
                    {scope === 'day1' ? '1日目のみ削除' : scope === 'day2' ? '2日目のみ削除' : '両日削除'}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteModal(null)}
                style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 5, padding: '8px 20px', fontSize: 15, cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={() => executeDelete(deleteModal.member.id, deleteScope)}
                disabled={saving}
                style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 5, padding: '8px 20px', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {simpleConfirm && (
        <ConfirmModal
          message={simpleConfirm.message}
          onOk={simpleConfirm.onOk}
          onCancel={() => setSimpleConfirm(null)}
          okLabel="削除"
          okColor={C.red}
        />
      )}

      {memberCodeWarn && (
        <ConfirmModal
          message={`次の会員番号は選手マスターに未登録です：\n${memberCodeWarn.unknown.join('、')}\n\nこのまま保存しますか？`}
          onOk={() => applyMemberChanges(memberCodeWarn.pendingChanges)}
          onCancel={() => setMemberCodeWarn(null)}
          okLabel="このまま保存"
          okColor={C.gold}
        />
      )}
    </div>
  );
}

function classBadgeBg(c: ClassType): string {
  return { AAA: '#9b59b633', AA: '#e74c3c33', A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133' }[c] ?? '';
}
function classBadgeColor(c: ClassType): string {
  return { AAA: '#9b59b6', AA: '#e74c3c', A: C.gold, B: '#3498db', C: '#2ecc71' }[c] ?? C.muted;
}
