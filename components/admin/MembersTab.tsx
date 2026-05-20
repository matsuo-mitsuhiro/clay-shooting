'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Member, ClassType, ScoreStatus, Tournament, Result, UnusedSlot } from '@/lib/types';
import { PREFECTURES } from '@/lib/prefectures';
import LoadingOverlay from '@/components/LoadingOverlay';
import { ConfirmModal, ErrorModal } from '@/components/ModalDialog';

interface Props {
  tournamentId: number;
  tournament: Tournament | null;
  onNavigateToApplySettings?: () => void;
  onTournamentRefresh?: () => void;
}

interface SlotItem {
  group: number;
  position: number;
  member: Member | null;
  isUnused: boolean;
}

const POSITIONS = 6;

function isSlotUnused(unusedSlots: UnusedSlot[], day: number, group: number, position: number): boolean {
  return unusedSlots.some(u => u.day === day && u.group === group && u.position === position);
}

// 全スロットを (group, position) 順で通しで前詰めする。
// 空席指定 (isUnused=true) のスロットは位置を固定し、シフト対象から除外する（飛ばし）。
// その結果、空きは（同 day 内の）最終組の末尾に集約される。
function compactAllSlots(items: SlotItem[]): SlotItem[] {
  const result = items.map(s => ({ ...s }));
  const sortedIndices = result
    .map((_, i) => i)
    .sort((a, b) => {
      if (result[a].group !== result[b].group) return result[a].group - result[b].group;
      return result[a].position - result[b].position;
    });
  const nonUnusedIndices = sortedIndices.filter(i => !result[i].isUnused);
  const members = nonUnusedIndices
    .map(i => result[i].member)
    .filter((m): m is Member => m !== null);
  for (let k = 0; k < nonUnusedIndices.length; k++) {
    result[nonUnusedIndices[k]].member = k < members.length ? members[k] : null;
  }
  return result;
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
  belong: string | null;
  is_non_prize: boolean;
}

export default function MembersTab({ tournamentId, tournament, onNavigateToApplySettings, onTournamentRefresh }: Props) {
  const hasTwoDays = !!(tournament?.day2_date);
  const unusedSlots: UnusedSlot[] = tournament?.unused_slots ?? [];

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

  // 移動モーダル（⋮⋮ クリックで開く）
  const [moveModal, setMoveModal] = useState<{ slot: SlotItem } | null>(null);
  const [moveTargetGroup, setMoveTargetGroup] = useState(1);
  const [moveTargetPosition, setMoveTargetPosition] = useState(1);

  // 空席設定モーダル
  const [unusedModalOpen, setUnusedModalOpen] = useState(false);
  const [unusedDraft, setUnusedDraft] = useState<Set<string>>(new Set()); // "g-p" の Set

  // ランダム組替プレビュー状態
  const [randomPreview, setRandomPreview] = useState(false);
  const [randomBackup, setRandomBackup] = useState<SlotItem[] | null>(null);

  useEffect(() => {
    fetch('/api/associations')
      .then(r => r.json())
      .then(j => {
        if (j.success) setAssociationNames((j.data as { name: string }[]).map(a => a.name));
      })
      .catch(() => {});
  }, []);

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

  function updateEditedMember(memberId: number, field: 'belong' | 'is_non_prize', value: string | boolean | null) {
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

    // belong 変更
    const newBelong = (value as string | null) ?? null;
    setEditedMembers(prev =>
      prev.map(em => em.id === memberId ? { ...em, belong: newBelong } : em)
    );
    setSavedMembers(prev =>
      prev.map(m => m.id === memberId ? { ...m, belong: newBelong } : m)
    );
  }

  async function saveEditMode() {
    setError(null);
    // 選手管理タブで編集可能なのは belong / is_non_prize のみ
    // 会員番号・氏名・クラス・審判は申込管理タブから変更
    const changes: MemberChange[] = [];
    for (const edited of editedMembers) {
      const snap = snapshotMembers.find(s => s.id === edited.id);
      if (!snap) continue;
      if (edited.belong !== snap.belong || edited.is_non_prize !== snap.is_non_prize) {
        changes.push({ id: edited.id, belong: edited.belong, is_non_prize: edited.is_non_prize });
      }
    }

    if (changes.length === 0) {
      setEditing(false);
      setEditedMembers([]);
      setSnapshotMembers([]);
      return;
    }

    try {
      setSaving(true);
      const errors: string[] = [];
      for (const c of changes) {
        const res = await fetch(`/api/tournaments/${tournamentId}/members/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ belong: c.belong, is_non_prize: c.is_non_prize }),
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
        const isUnused = isSlotUnused(unusedSlots, selectedDay, g, p);
        slots.push({ group: g, position: p, member, isUnused });
      }
    }
    setReorderItems(slots);
    setReorderMode(true);
    setRandomPreview(false);
    setRandomBackup(null);
  }

  // 移動モーダルを開く
  function openMoveModal(slot: SlotItem) {
    if (!slot.member) return;
    if (randomPreview) return; // プレビュー中はロック
    setMoveModal({ slot });
    setMoveTargetGroup(slot.group);
    setMoveTargetPosition(slot.position);
  }

  // モーダル「決定」: A → B 移動（リスト挿入カスケード、空席スキップ）+ 即時 DB 保存
  async function confirmMove() {
    if (!moveModal) return;
    const src = moveModal.slot;
    const dstG = moveTargetGroup;
    const dstP = moveTargetPosition;

    // 元位置と同じ場合は no-op
    if (src.group === dstG && src.position === dstP) {
      setMoveModal(null);
      return;
    }

    // 新しい layout を計算
    const newItems = reorderItems.map(s => ({ ...s }));
    const srcIdx = newItems.findIndex(s => s.group === src.group && s.position === src.position);
    const dstIdx = newItems.findIndex(s => s.group === dstG && s.position === dstP);
    if (srcIdx === -1 || dstIdx === -1) {
      setMoveModal(null);
      return;
    }
    const movingMember = newItems[srcIdx].member;
    if (!movingMember) {
      setMoveModal(null);
      return;
    }

    // 行先が空席だった場合: 空席指定を自動解除（DB 反映: unused_slots からも削除）
    let dstWasUnused = false;
    if (newItems[dstIdx].isUnused) {
      dstWasUnused = true;
      newItems[dstIdx].isUnused = false;
      newItems[dstIdx].member = movingMember;
      newItems[srcIdx].member = null;
    } else {
      // 通常のリスト挿入カスケード（空席スキップ）
      newItems[srcIdx].member = null;
      if (srcIdx > dstIdx) {
        const indices: number[] = [];
        for (let i = dstIdx; i <= srcIdx; i++) {
          if (!newItems[i].isUnused) indices.push(i);
        }
        const oldMembers = indices.map(i => newItems[i].member);
        for (let k = 0; k < indices.length; k++) {
          if (k === 0) newItems[indices[k]].member = movingMember;
          else newItems[indices[k]].member = oldMembers[k - 1];
        }
      } else {
        const indices: number[] = [];
        for (let i = srcIdx; i <= dstIdx; i++) {
          if (!newItems[i].isUnused) indices.push(i);
        }
        const oldMembers = indices.map(i => newItems[i].member);
        for (let k = 0; k < indices.length; k++) {
          if (k === indices.length - 1) newItems[indices[k]].member = movingMember;
          else newItems[indices[k]].member = oldMembers[k + 1];
        }
      }
    }

    // 全スロットを (group, position) 順で通しで前詰め
    // 空席指定 (isUnused=true) は位置固定（飛ばし）、空きは最終組の末尾に集約される
    const compactedItems = compactAllSlots(newItems);

    setReorderItems(compactedItems);
    setMoveModal(null);

    // DB 即時反映
    try {
      setSaving(true);
      const membersPayload = compactedItems
        .filter(s => s.member !== null)
        .map(s => ({
          day: selectedDay,
          group_number: s.group,
          position: s.position,
          member_code: s.member!.member_code ?? undefined,
          name: s.member!.name,
          belong: s.member!.belong ?? undefined,
          class: (s.member!.class ?? undefined) as ClassType | undefined,
          is_judge: s.member!.is_judge,
          is_non_prize: s.member!.is_non_prize,
        }));

      if (dstWasUnused) {
        // 行先空席を解除して保存（unused_slots から削除）
        const newUnused = unusedSlots.filter(u =>
          !(u.day === selectedDay && u.group === dstG && u.position === dstP)
        );
        const res = await fetch(`/api/tournaments/${tournamentId}/unused-slots`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unused_slots: newUnused, members: membersPayload, day: selectedDay }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        onTournamentRefresh?.();
      } else {
        // 通常の members 更新のみ
        const res = await fetch(`/api/tournaments/${tournamentId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: selectedDay, members: membersPayload }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
      // 失敗時はリストをリフレッシュで戻す
      await fetchMembers();
      enterReorderMode();
    } finally {
      setSaving(false);
    }
  }

  // 空席設定モーダルを開く
  function openUnusedModal() {
    if (randomPreview) return;
    // 現在日の空席を Set 化
    const set = new Set<string>();
    for (const u of unusedSlots) {
      if (u.day === selectedDay) set.add(`${u.group}-${u.position}`);
    }
    setUnusedDraft(set);
    setUnusedModalOpen(true);
  }

  function toggleUnusedDraft(g: number, p: number) {
    setUnusedDraft(prev => {
      const next = new Set(prev);
      const key = `${g}-${p}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // 空席設定の保存（カスケード適用）
  async function saveUnusedSlots() {
    setError(null);
    // 新しい現在日の空席リスト
    const newCurrentDayUnused: UnusedSlot[] = Array.from(unusedDraft).map(key => {
      const [g, p] = key.split('-').map(Number);
      return { day: selectedDay, group: g, position: p };
    });
    // 他日の空席はそのまま
    const otherDayUnused = unusedSlots.filter(u => u.day !== selectedDay);
    const fullUnused = [...otherDayUnused, ...newCurrentDayUnused];

    // 現在日の members に対してカスケード適用
    const result = applyUnusedCascade(savedMembers, newCurrentDayUnused, selectedDay, groupCount[selectedDay]);
    if (result.rejected) {
      setError(result.rejected);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/unused-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unused_slots: fullUnused,
          members: result.members.map(m => ({
            day: m.day,
            group_number: m.group_number,
            position: m.position,
            member_code: m.member_code ?? undefined,
            name: m.name,
            belong: m.belong ?? undefined,
            class: m.class ?? undefined,
            is_judge: m.is_judge,
            is_non_prize: m.is_non_prize,
          })),
          day: selectedDay,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setUnusedModalOpen(false);
      await fetchMembers();
      onTournamentRefresh?.();
      setSuccess('空席設定を保存しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
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

  // ランダム組替（プレビュー）
  function handleRandomShuffle() {
    if (!reorderItems.length) return;

    // 現在の状態を backup（キャンセル用）
    setRandomBackup(reorderItems.map(s => ({ ...s })));
    setRandomPreview(true);

    // 主催協会名を取得
    const organizerName = tournament?.organizer_cd
      ? PREFECTURES.find(p => p.cd === tournament.organizer_cd)?.name ?? null
      : null;

    // 現在の選手一覧を取り出す（空きスロット・空席は除外）
    const allMembers = reorderItems
      .filter(s => s.member !== null)
      .map(s => s.member!);
    const numGroups = Math.max(...reorderItems.map(s => s.group));

    // 空席判定ヘルパー
    const isUnusedSlot = (g: number, p: number) => isSlotUnused(unusedSlots, selectedDay, g, p);

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

    // Step 1: 各組に主催協会を2名配置（射順1と射順4、空席ならスキップ）
    for (let g = 0; g < numGroups; g++) {
      if (!isUnusedSlot(g + 1, 1)) {
        const pos1 = pickFrom(hj) ?? pickFrom(hn);
        if (pos1) groupSlots[g][0] = pos1;
      }
      if (!isUnusedSlot(g + 1, 4)) {
        const pos4 = pickFrom(hj) ?? pickFrom(hn);
        if (pos4) groupSlots[g][3] = pos4;
      }
    }

    // Step 2: 審判不足の組を補充（空席はスキップ）
    for (let g = 0; g < numGroups; g++) {
      const hasJudge = groupSlots[g].some(m => m && m.is_judge);
      if (!hasJudge) {
        const judge = pickFrom(oj);
        if (judge) {
          const tryPlace = (idx: number) => {
            const pos = idx + 1;
            if (!isUnusedSlot(g + 1, pos) && !groupSlots[g][idx]) {
              groupSlots[g][idx] = judge;
              return true;
            }
            return false;
          };
          if (groupSlots[g][3]) {
            if (!tryPlace(1)) tryPlace(2);
          } else if (groupSlots[g][0]) {
            if (!tryPlace(4)) tryPlace(5);
          } else {
            tryPlace(0);
          }
        }
      }
    }

    // Step 3: まだ審判ゼロの組に対して、残りの他協会審判を配置（空席スキップ）
    for (let g = 0; g < numGroups; g++) {
      const hasJudge = groupSlots[g].some(m => m && m.is_judge);
      if (!hasJudge) {
        const judge = pickFrom(oj);
        if (judge) {
          const emptyIdx = groupSlots[g].findIndex((s, i) => s === null && !isUnusedSlot(g + 1, i + 1));
          if (emptyIdx !== -1) groupSlots[g][emptyIdx] = judge;
        }
      }
    }

    // Step 4: 残りの選手を配置（両日参加者を前方の組に優先配置、空席スキップ）
    const remainingAll = shuffle([...hj, ...hn, ...oj, ...otherNon].filter(m => !used.has(m.id)));
    const remaining = remainingAll.sort((a, b) => {
      const aBoth = isBothDays(a) ? 0 : 1;
      const bBoth = isBothDays(b) ? 0 : 1;
      return aBoth - bBoth;
    });
    let rIdx = 0;
    for (let g = 0; g < numGroups; g++) {
      for (let p = 0; p < POSITIONS; p++) {
        if (isUnusedSlot(g + 1, p + 1)) continue;
        if (!groupSlots[g][p] && rIdx < remaining.length) {
          groupSlots[g][p] = remaining[rIdx++];
        }
      }
    }

    // reorderItems に反映（空席フラグも保持）
    const newItems: SlotItem[] = [];
    for (let g = 0; g < numGroups; g++) {
      for (let p = 0; p < POSITIONS; p++) {
        newItems.push({
          group: g + 1,
          position: p + 1,
          member: groupSlots[g][p],
          isUnused: isUnusedSlot(g + 1, p + 1),
        });
      }
    }
    setReorderItems(newItems);
  }

  // ランダム組替プレビュー: キャンセル
  function cancelRandomPreview() {
    if (randomBackup) {
      setReorderItems(randomBackup);
    }
    setRandomBackup(null);
    setRandomPreview(false);
  }

  // ランダム組替プレビュー: 保存
  async function saveRandomPreview() {
    await handleSaveReorder();
    setRandomBackup(null);
    setRandomPreview(false);
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

      // 既存の reorderItems の組数を維持（不足する場合は拡張）
      const currentMaxGroup = reorderItems.length > 0 ? Math.max(...reorderItems.map(s => s.group)) : 1;
      const numGroups = Math.max(currentMaxGroup, Math.ceil(sortedMembers.length / POSITIONS));
      // 空席を考慮した利用可能スロット数を計算し、選手数と整合
      const availableSlotIndices: { g: number; p: number }[] = [];
      for (let g = 1; g <= numGroups; g++) {
        for (let p = 1; p <= POSITIONS; p++) {
          if (!isSlotUnused(unusedSlots, selectedDay, g, p)) {
            availableSlotIndices.push({ g, p });
          }
        }
      }

      // ランダム組替プレビュー状態に入れる
      setRandomBackup(reorderItems.map(s => ({ ...s })));
      setRandomPreview(true);

      const newItems: SlotItem[] = [];
      let memberIdx = 0;
      for (let g = 1; g <= numGroups; g++) {
        for (let p = 1; p <= POSITIONS; p++) {
          const isUnused = isSlotUnused(unusedSlots, selectedDay, g, p);
          let member: Member | null = null;
          if (!isUnused) {
            const slotIndex = availableSlotIndices.findIndex(s => s.g === g && s.p === p);
            if (slotIndex !== -1 && slotIndex < sortedMembers.length) {
              member = sortedMembers[slotIndex];
              memberIdx++;
            }
          }
          newItems.push({ group: g, position: p, member, isUnused });
        }
      }
      // 余剰選手があれば最後に追加（注意ログ）
      if (memberIdx < sortedMembers.length) {
        console.warn('成績順組替: 配置しきれなかった選手がいます', sortedMembers.length - memberIdx);
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

  const selectClass = 'bg-input-bg border border-border rounded-[4px] text-text px-[6px] py-[4px] text-[14px] cursor-pointer';

  const dayLabel = (d: string) => d === 'day1' ? '1日目' : d === 'day2' ? '2日目' : '両日';

  return (
    <div className="px-[16px] py-[20px] max-w-[1400px] mx-auto">
      <LoadingOverlay show={loading || saving} message={loading ? '読み込み中...' : '保存中...'} />

      {/* 申込済み・未登録 警告バナー */}
      {unregistered.length > 0 && (
        <div className="bg-[#7a4a0022] border border-[#d4870a] rounded-[8px] px-[18px] py-[14px] mb-[20px]">
          <div className="flex items-center gap-[8px] mb-[10px]">
            <span className="text-[18px]">⚠️</span>
            <span className="text-[#d4870a] font-bold text-[15px]">
              申込済みだが選手未登録の方が {unregistered.length} 名います
            </span>
          </div>
          <div className="flex flex-wrap gap-x-[20px] gap-y-[6px] mb-[10px]">
            {unregistered.map(u => (
              <span key={u.member_code} className="text-[14px] text-[#e0a040]">
                {u.member_code}　{u.name}（{dayLabel(u.participation_day)}）
              </span>
            ))}
          </div>
          <p className="m-0 text-[13px] text-[#a07840]">
            選手管理で確認するか、申込管理タブでキャンセル処理してください。
          </p>
        </div>
      )}

      {/* Day Tabs（1日目 / 2日目） — 2日開催時のみ表示 */}
      {hasTwoDays && (
        <div className="flex gap-[8px] mb-[20px] flex-wrap items-center">
          {([1, 2] as const).map(day => {
            const active = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => { setSelectedDay(day); setSelectedGroup(1); setReorderMode(false); setEditing(false); }}
                className={`rounded-[6px] px-[18px] py-[7px] text-[16px] cursor-pointer border ${
                  active
                    ? 'bg-gold text-black border-gold font-bold'
                    : 'bg-surface text-muted border-border font-normal'
                }`}
              >
                {day}日目
              </button>
            );
          })}
          {selectedDay === 2 && (
            <button
              onClick={handleCopyDay1}
              className="bg-[#2a7a9a22] text-blue-2 border border-blue-2 rounded-[6px] px-[14px] py-[7px] text-[15px] cursor-pointer ml-[8px]"
            >
              1日目からコピー
            </button>
          )}
        </div>
      )}

      {/* Error / Success */}
      <ErrorModal message={error} onClose={() => setError(null)} />
      {success && (
        <div className="bg-[#27ae6022] border border-green text-green rounded-[6px] px-[12px] py-[8px] mb-[12px] text-[15px]">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-[40px] px-0 text-muted">読み込み中...</div>
      ) : (
        <>
          {/* 射順発表バナー（選手登録済み & 非公開時のみ） */}
          {savedMembers.length > 0 && !tournament?.squad_published_at && (
            <div className="bg-[#e8a02018] border border-[#e8a02066] rounded-[6px] px-[14px] py-[8px] mb-[12px] text-[14px] text-text">
              射順の選定が完了したら、
              <button
                onClick={onNavigateToApplySettings}
                className="bg-transparent border-none p-0 text-gold font-bold text-[14px] cursor-pointer underline"
              >
                公開してください。
              </button>
            </div>
          )}

          {/* Group Tabs */}
          <div className="flex gap-[6px] mb-[16px] flex-wrap items-center">
            {groupsInDay.map(g => {
              const count = dayMembers.filter(m => m.group_number === g).length;
              const active = selectedGroup === g;
              return (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`rounded-[5px] px-[14px] py-[5px] text-[15px] cursor-pointer border ${
                    active
                      ? 'bg-surface-2 text-gold border-gold font-bold'
                      : 'bg-surface text-muted border-border font-normal'
                  }`}
                >
                  {g}組{count > 0 ? `（${count}名）` : ''}
                </button>
              );
            })}
            <button
              onClick={addGroup}
              className="bg-transparent text-muted border border-dashed border-border rounded-[5px] px-[12px] py-[5px] text-[15px] cursor-pointer"
            >
              ＋組を追加
            </button>
          </div>

          {/* Members Table */}
          <div className="bg-surface border border-border rounded-[8px] overflow-hidden mb-[16px]">
            <div className="px-[14px] py-[10px] border-b border-border flex justify-between items-center">
              <span className="font-semibold text-text text-[16px]">
                {hasTwoDays ? `${selectedDay}日目 ` : ''}{selectedGroup}組（{groupMembers.length}名）
              </span>
              {/* Edit / Save / Cancel buttons */}
              <div className="flex gap-[8px]">
                {editing ? (
                  <>
                    <button
                      onClick={cancelEditMode}
                      className="bg-surface-2 text-muted border border-border rounded-[5px] px-[14px] py-[5px] text-[14px] cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveEditMode}
                      disabled={saving}
                      className="bg-gold text-black border-none rounded-[5px] px-[14px] py-[5px] text-[14px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <button
                    onClick={enterEditMode}
                    disabled={reorderMode}
                    className={`bg-surface-2 text-gold border border-gold rounded-[5px] px-[14px] py-[5px] text-[14px] ${reorderMode ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    編集
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[580px]">
                <thead>
                  <tr className="bg-surface-2">
                    {[
                      { label: '射順', widthClass: 'w-[50px]', sticky: true, leftClass: 'left-0' },
                      { label: '会員番号', widthClass: 'w-[90px]', sticky: false, leftClass: '' },
                      { label: '氏名（ 🚩審判）', widthClass: '', sticky: true, leftClass: 'left-[50px]' },
                      { label: '賞典外', widthClass: 'w-[60px]', sticky: false, leftClass: '' },
                      { label: '所属協会', widthClass: 'w-[140px]', sticky: false, leftClass: '' },
                      { label: 'クラス', widthClass: 'w-[80px]', sticky: false, leftClass: '' },
                      { label: '成績', widthClass: 'w-[80px]', sticky: false, leftClass: '' },
                      { label: '操作', widthClass: 'w-[60px]', sticky: false, leftClass: '' },
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-[10px] py-[8px] text-[14px] text-muted font-semibold text-left border-b border-border whitespace-nowrap ${h.widthClass} ${
                          h.sticky ? `sticky ${h.leftClass} z-[2] bg-surface-2` : ''
                        }`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [];
                    for (let p = 1; p <= POSITIONS; p++) {
                      const member = groupMembers.find(m => m.position === p);
                      const isUnused = isSlotUnused(unusedSlots, selectedDay, selectedGroup, p);
                      // 空席行（射順は表示するが氏名列に「空席」と表示）
                      if (!member && isUnused) {
                        rows.push(
                          <tr key={p} className="border-b border-b-[#2e334033] bg-[#1a1a1a55]">
                            <td className="px-[10px] py-[6px] text-muted text-[15px] sticky left-0 z-[1] bg-[#1a1a1a]">{p}</td>
                            <td colSpan={7} className="px-[10px] py-[6px] text-[14px] text-muted italic sticky left-[50px] z-[1] bg-[#1a1a1a]">
                              空席
                            </td>
                          </tr>
                        );
                        continue;
                      }
                      const isDQ = member?.member_code
                        ? (statusMap[member.member_code] === 'disqualified' || statusMap[member.member_code] === 'withdrawn')
                        : false;
                      rows.push(
                        <tr
                          key={p}
                          className={`border-b border-b-[#2e334033] border-l-[3px] ${
                            !member ? 'border-l-gold bg-[#e8a0200a]' : 'border-l-transparent bg-transparent'
                          }`}
                        >
                          <td
                            className={`px-[10px] py-[6px] text-muted text-[15px] sticky left-0 z-[1] ${
                              !member ? 'bg-[#e8a0200a]' : 'bg-surface'
                            }`}
                          >
                            {p}
                          </td>
                          {member ? (
                            <>
                              {/* 会員番号（表示のみ・申込管理タブから変更） */}
                              <td className="px-[10px] py-[6px] text-[15px] text-text font-mono">
                                {member.member_code ?? '-'}
                              </td>
                              <td className="px-[10px] py-[6px] text-[15px] text-text font-medium sticky left-[50px] z-[1] bg-surface">
                                {member.name}
                                {member.is_judge && <span className="ml-[6px]">🚩</span>}
                              </td>
                              {/* 賞典外 */}
                              <td className="px-[6px] py-[4px] text-center">
                                {editing ? (
                                  <input
                                    type="checkbox"
                                    checked={member.is_non_prize}
                                    onChange={e => updateEditedMember(member.id, 'is_non_prize', e.target.checked)}
                                    className="w-[16px] h-[16px] cursor-pointer accent-gold"
                                  />
                                ) : (
                                  <span className={`text-[15px] ${member.is_non_prize ? 'text-gold' : 'text-muted'}`}>
                                    {member.is_non_prize ? '✓' : ''}
                                  </span>
                                )}
                              </td>
                              {/* 所属協会 */}
                              <td className="px-[6px] py-[4px]">
                                {editing ? (
                                  <select
                                    value={member.belong ?? ''}
                                    onChange={e => updateEditedMember(member.id, 'belong', e.target.value || null)}
                                    className={selectClass}
                                  >
                                    <option value="">---</option>
                                    {associationNames.map(name => (
                                      <option key={name} value={name}>{name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[15px] text-text">{member.belong ?? '-'}</span>
                                )}
                              </td>
                              {/* クラス（表示のみ・申込管理タブから変更） */}
                              <td className="px-[6px] py-[4px]" title="クラスの変更は「申込管理」タブから行ってください">
                                {member.class ? (
                                  <span className={`rounded-[4px] px-[7px] py-[1px] text-[13px] font-bold ${classBadgeClass(member.class)}`}>
                                    {member.class}
                                  </span>
                                ) : <span className="text-muted">-</span>}
                              </td>
                              {/* 成績 */}
                              <td className="px-[6px] py-[4px] text-center">
                                {member.member_code ? (
                                  <select
                                    value={statusMap[member.member_code] ?? 'valid'}
                                    onChange={e => handleStatusChange(member.member_code!, e.target.value as ScoreStatus)}
                                    className={`bg-input-bg rounded-[4px] px-[6px] py-[4px] text-[13px] cursor-pointer border ${
                                      isDQ
                                        ? 'border-[#e74c3c] text-[#e74c3c] font-bold'
                                        : 'border-border text-text font-normal'
                                    }`}
                                  >
                                    <option value="valid">有効</option>
                                    <option value="disqualified">失格</option>
                                    <option value="withdrawn">棄権</option>
                                  </select>
                                ) : (
                                  <span className="text-muted text-[13px]">-</span>
                                )}
                              </td>
                              <td className="px-[6px] py-[4px] text-center">
                                <button
                                  onClick={() => handleDeleteMember(member)}
                                  className="bg-transparent text-red border border-red rounded-[4px] px-[10px] py-[3px] text-[13px] cursor-pointer"
                                >
                                  削除
                                </button>
                              </td>
                            </>
                          ) : (
                            <td colSpan={8} className="px-[10px] py-[6px] text-[15px] text-gold sticky left-[50px] z-[1] bg-[#e8a0200a]">
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
            <div className="mt-[20px] mb-[4px] flex justify-start gap-[10px] flex-wrap">
              {!reorderMode ? (
                <button
                  onClick={enterReorderMode}
                  className="bg-surface-2 text-gold border border-gold rounded-[6px] px-[18px] py-[7px] text-[15px] cursor-pointer font-semibold"
                >
                  選手組替
                </button>
              ) : randomPreview ? (
                <>
                  <button
                    onClick={cancelRandomPreview}
                    className="bg-surface-2 text-muted border border-border rounded-[6px] px-[18px] py-[7px] text-[15px] cursor-pointer font-semibold"
                  >
                    組替をキャンセル
                  </button>
                  <button
                    onClick={saveRandomPreview}
                    disabled={saving}
                    className="bg-green text-white border-none rounded-[6px] px-[18px] py-[7px] text-[15px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? '保存中...' : '組替を保存'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={openUnusedModal}
                    className="bg-gold text-black border-none rounded-[6px] px-[18px] py-[7px] text-[15px] cursor-pointer font-bold"
                  >
                    空席設定
                  </button>
                  <button
                    onClick={handleRandomShuffle}
                    className="bg-[#e74c3c] text-white border-none rounded-[6px] px-[18px] py-[7px] text-[15px] cursor-pointer font-semibold"
                  >
                    ランダム組替
                  </button>
                  {selectedDay === 2 && (
                    <button
                      onClick={handlePreviousDayRankShuffle}
                      disabled={saving}
                      className="bg-[#2980b9] text-white border-none rounded-[6px] px-[18px] py-[7px] text-[15px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saving ? '処理中...' : '前日の成績順組替'}
                    </button>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => setReorderMode(false)}
                    className="bg-surface-2 text-muted border border-border rounded-[6px] px-[18px] py-[7px] text-[15px] cursor-pointer font-semibold"
                  >
                    組替モード終了
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reorder Mode */}
          {reorderMode && (
            <div className="mt-[12px] bg-surface border border-gold rounded-[8px] overflow-hidden mb-[16px]">
              <div className="px-[14px] py-[10px] border-b border-border bg-surface-2">
                <span className="font-semibold text-gold text-[16px]">
                  選手組替モード {randomPreview ? '— プレビュー中（手動編集ロック）' : '— ⋮⋮ アイコンをクリックして組と射順を変更してください'}
                </span>
              </div>
              {randomPreview && (
                <div className="px-[14px] py-[10px] bg-[#2a1a00] border-b border-b-[#fbbf24] text-[#fbbf24] text-[13px]">
                  ⚠️ プレビュー中: ランダム組替の結果を表示しています。「保存」または「キャンセル」を選択してください。
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[420px]">
                  <thead>
                    <tr className="bg-surface-2">
                      {['組', '射順', '氏名（ 🚩審判）', '所属協会', 'クラス'].map(h => (
                        <th key={h} className="px-[10px] py-[7px] text-[13px] text-muted font-semibold text-left border-b border-border">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reorderItems.map(slot => (
                      <tr
                        key={`slot-${slot.group}-${slot.position}`}
                        className={`border-b border-b-[#2e334033] ${slot.isUnused ? 'bg-[#1a1a1a55]' : 'bg-transparent'}`}
                      >
                        <td className="px-[10px] py-[5px] text-muted text-[15px]">{slot.group}組</td>
                        <td className="px-[10px] py-[5px] text-muted text-[15px]">{slot.position}</td>
                        <td className="px-[10px] py-[5px] text-text text-[15px]">
                          {slot.isUnused ? (
                            <span className="text-muted italic">空席</span>
                          ) : slot.member ? (
                            <div className="flex items-center gap-[8px]">
                              <span
                                onClick={() => openMoveModal(slot)}
                                title="クリックして組と射順を変更"
                                className={`text-[18px] select-none px-[4px] py-0 ${
                                  randomPreview
                                    ? 'cursor-not-allowed text-[#444] opacity-40'
                                    : 'cursor-pointer text-gold opacity-100'
                                }`}
                              >⋮⋮</span>
                              {slot.member.name}{slot.member.is_judge ? <span className="ml-[6px]">🚩</span> : ''}
                            </div>
                          ) : <span className="text-gold">－（空き）</span>}
                        </td>
                        <td className="px-[10px] py-[5px] text-muted text-[15px]">{slot.member?.belong ?? (slot.isUnused ? '—' : '-')}</td>
                        <td className="px-[10px] py-[5px] text-[15px]">
                          {slot.member?.class ? (
                            <span className={`rounded-[4px] px-[7px] py-[1px] text-[13px] font-bold ${classBadgeClass(slot.member.class)}`}>
                              {slot.member.class}
                            </span>
                          ) : (slot.isUnused ? <span className="text-muted">—</span> : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 移動モーダル */}
      {moveModal && (
        <MoveModal
          slot={moveModal.slot}
          maxGroup={Math.max(...reorderItems.map(s => s.group))}
          targetGroup={moveTargetGroup}
          targetPosition={moveTargetPosition}
          onChangeGroup={setMoveTargetGroup}
          onChangePosition={setMoveTargetPosition}
          onCancel={() => setMoveModal(null)}
          onConfirm={confirmMove}
        />
      )}

      {/* 空席設定モーダル */}
      {unusedModalOpen && (
        <UnusedSlotsModal
          day={selectedDay}
          groupCount={groupCount[selectedDay]}
          draft={unusedDraft}
          onToggle={toggleUnusedDraft}
          onCancel={() => setUnusedModalOpen(false)}
          onSave={saveUnusedSlots}
          saving={saving}
        />
      )}

      {/* 両日参加者 削除モーダル */}
      {deleteModal && (
        <div
          className="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[9999]"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="bg-surface border border-border rounded-[10px] px-[28px] py-[24px] max-w-[400px] w-[90%]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="m-0 mb-[16px] text-[17px] text-gold">
              {deleteModal.member.name}（{deleteModal.member.belong ?? '-'}）
            </h3>
            <p className="m-0 mb-[16px] text-[15px] text-text">
              削除する日を選択してください。
            </p>
            {deleteModal.hasScores && (
              <p className="m-0 mb-[12px] text-[14px] text-red">
                ※ 点数データも削除されます
              </p>
            )}
            <div className="flex flex-col gap-[10px] mb-[20px]">
              {(['day1', 'day2', 'both'] as const).map(scope => {
                const selected = deleteScope === scope;
                return (
                  <label
                    key={scope}
                    className={`flex items-center gap-[8px] cursor-pointer px-[12px] py-[8px] rounded-[6px] border ${
                      selected ? 'bg-[#e8a02022] border-gold' : 'bg-transparent border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteScope"
                      value={scope}
                      checked={selected}
                      onChange={() => setDeleteScope(scope)}
                      className="accent-gold"
                    />
                    <span className={`text-[15px] text-text ${selected ? 'font-bold' : 'font-normal'}`}>
                      {scope === 'day1' ? '1日目のみ削除' : scope === 'day2' ? '2日目のみ削除' : '両日削除'}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-[10px] justify-end">
              <button
                onClick={() => setDeleteModal(null)}
                className="bg-surface-2 text-text border border-border rounded-[5px] px-[20px] py-[8px] text-[15px] cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeDelete(deleteModal.member.id, deleteScope)}
                disabled={saving}
                className="bg-red text-white border-none rounded-[5px] px-[20px] py-[8px] text-[15px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
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
          okColor="#ff4d4d"
        />
      )}

    </div>
  );
}

function classBadgeClass(c: ClassType): string {
  return {
    AAA: 'bg-[#9b59b633] text-[#9b59b6]',
    AA: 'bg-[#e74c3c33] text-[#e74c3c]',
    A: 'bg-[#e8a02033] text-gold',
    B: 'bg-[#3498db33] text-[#3498db]',
    C: 'bg-[#2ecc7133] text-[#2ecc71]',
  }[c] ?? 'text-muted';
}

// ============================================================
// 空席設定変更時のカスケード適用
// 現在日の members を、新しい空席設定に従って再配置する。
// 各選手は自身の現在位置以降の最初の「非空席かつ未占有」スロットに置かれる。
// ============================================================
function applyUnusedCascade(
  members: Member[],
  newCurrentDayUnused: UnusedSlot[],
  day: 1 | 2,
  groupCount: number,
): { members: Member[]; rejected: string | null } {
  const isUnused = (g: number, p: number) =>
    newCurrentDayUnused.some(u => u.day === day && u.group === g && u.position === p);

  // 全スロット（線形）
  const slots: { group: number; position: number; isUnused: boolean }[] = [];
  for (let g = 1; g <= groupCount; g++) {
    for (let p = 1; p <= POSITIONS; p++) {
      slots.push({ group: g, position: p, isUnused: isUnused(g, p) });
    }
  }

  // 現在日の members を現在位置順にソート
  const dayMembers = members
    .filter(m => m.day === day)
    .sort((a, b) => {
      if (a.group_number !== b.group_number) return a.group_number - b.group_number;
      return a.position - b.position;
    });

  const placed = new Set<number>(); // slot index
  const newDayMembers: Member[] = [];

  for (const m of dayMembers) {
    const startIdx = slots.findIndex(s => s.group === m.group_number && s.position === m.position);
    const searchFrom = startIdx >= 0 ? startIdx : 0;
    let landed = -1;
    for (let i = searchFrom; i < slots.length; i++) {
      if (slots[i].isUnused) continue;
      if (placed.has(i)) continue;
      landed = i;
      break;
    }
    if (landed === -1) {
      return { members, rejected: '全スロットが選手で埋まっているため空席化できません' };
    }
    placed.add(landed);
    newDayMembers.push({
      ...m,
      group_number: slots[landed].group,
      position: slots[landed].position,
    });
  }

  const otherDayMembers = members.filter(m => m.day !== day);
  return { members: [...newDayMembers, ...otherDayMembers], rejected: null };
}

// ============================================================
// 移動モーダル: ⋮⋮ クリック時に表示
// ============================================================
function MoveModal({
  slot, maxGroup, targetGroup, targetPosition,
  onChangeGroup, onChangePosition, onCancel, onConfirm,
}: {
  slot: SlotItem;
  maxGroup: number;
  targetGroup: number;
  targetPosition: number;
  onChangeGroup: (g: number) => void;
  onChangePosition: (p: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[9999]"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface border border-border rounded-[12px] px-[32px] py-[24px] min-w-[360px] max-w-[480px] w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        <h3 className="m-0 mb-[18px] text-[17px] text-gold border-b border-border pb-[10px]">
          選手の組・射順を変更
        </h3>

        {/* 現在 */}
        <div className="bg-surface-2 px-[14px] py-[10px] rounded-[6px] mb-[12px] flex items-center gap-[14px]">
          <span className="text-muted text-[13px] font-semibold min-w-[40px]">現在</span>
          <span className="text-gold text-[15px] font-semibold">{slot.group}組</span>
          <span className="text-muted text-[14px]">射順</span>
          <span className="text-gold text-[15px] font-semibold">{slot.position}</span>
          <span className="text-muted text-[14px]">·</span>
          <span className="text-text text-[15px] font-semibold">
            {slot.member?.name}
            {slot.member?.is_judge ? <span className="text-gold ml-[6px]">⚑</span> : ''}
          </span>
        </div>

        {/* 変更 */}
        <div className="bg-[#1a1500] px-[14px] py-[10px] rounded-[6px] mb-[18px] border border-[#e8a02066] flex items-center gap-[12px]">
          <span className="text-muted text-[13px] font-semibold min-w-[40px]">変更</span>
          <select
            value={targetGroup}
            onChange={e => onChangeGroup(Number(e.target.value))}
            className="bg-input-bg text-text border border-border rounded-[6px] px-[12px] py-[8px] text-[14px] cursor-pointer"
          >
            {Array.from({ length: maxGroup }, (_, i) => i + 1).map(g => (
              <option key={g} value={g}>{g}組</option>
            ))}
          </select>
          <select
            value={targetPosition}
            onChange={e => onChangePosition(Number(e.target.value))}
            className="bg-input-bg text-text border border-border rounded-[6px] px-[12px] py-[8px] text-[14px] cursor-pointer"
          >
            {Array.from({ length: POSITIONS }, (_, i) => i + 1).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-[10px] justify-end border-t border-border pt-[14px]">
          <button
            onClick={onCancel}
            className="bg-surface-2 text-text border border-border rounded-[6px] px-[18px] py-[8px] text-[14px] cursor-pointer"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="bg-green text-white border-none rounded-[6px] px-[22px] py-[8px] text-[14px] font-bold cursor-pointer"
          >
            決定
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 空席設定モーダル
// ============================================================
function UnusedSlotsModal({
  day, groupCount, draft, onToggle, onCancel, onSave, saving,
}: {
  day: 1 | 2;
  groupCount: number;
  draft: Set<string>;
  onToggle: (g: number, p: number) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[9999]"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface border border-border rounded-[12px] px-[36px] py-[28px] min-w-[480px] max-w-[680px] w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        <h3 className="m-0 mb-[20px] text-[16px] text-gold border-b border-border pb-[10px]">
          空席に設定したい射順を選択してください（{day}日目）
        </h3>

        {Array.from({ length: groupCount }, (_, gi) => gi + 1).map(g => (
          <div key={g} className="flex items-center gap-[14px] mb-[12px] flex-wrap">
            <span className="w-[56px] text-[#aaa] text-[14px] font-semibold">{g}組</span>
            {Array.from({ length: POSITIONS }, (_, pi) => pi + 1).map(p => {
              const key = `${g}-${p}`;
              const selected = draft.has(key);
              return (
                <button
                  key={p}
                  onClick={() => onToggle(g, p)}
                  className={`w-[38px] h-[38px] rounded-full border-2 text-[14px] cursor-pointer transition-all duration-150 ${
                    selected
                      ? 'border-[#ef4444] bg-[#ef4444] text-white'
                      : 'border-[#555] bg-transparent text-[#aaa]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        ))}

        <div className="flex gap-[10px] justify-end border-t border-border pt-[16px] mt-[20px]">
          <button
            onClick={onCancel}
            className="bg-surface-2 text-text border border-border rounded-[6px] px-[18px] py-[8px] text-[14px] cursor-pointer"
          >
            閉じる
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-gold text-black border-none rounded-[6px] px-[22px] py-[8px] text-[14px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
