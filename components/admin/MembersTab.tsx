'use client';

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/colors';
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

    setReorderItems(newItems);
    setMoveModal(null);

    // DB 即時反映
    try {
      setSaving(true);
      const membersPayload = newItems
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
                      const isUnused = isSlotUnused(unusedSlots, selectedDay, selectedGroup, p);
                      // 空席行（射順は表示するが氏名列に「空席」と表示）
                      if (!member && isUnused) {
                        rows.push(
                          <tr key={p} style={{ borderBottom: `1px solid ${C.border}33`, background: '#1a1a1a55' }}>
                            <td style={{ padding: '6px 10px', color: C.muted, fontSize: 15, position: 'sticky', left: 0, zIndex: 1, background: '#1a1a1a' }}>{p}</td>
                            <td colSpan={8} style={{ padding: '6px 10px', fontSize: 14, color: C.muted, fontStyle: 'italic', position: 'sticky', left: 50, zIndex: 1, background: '#1a1a1a' }}>
                              空席
                            </td>
                          </tr>
                        );
                        continue;
                      }
                      rows.push(
                        <tr key={p} style={{
                          borderBottom: `1px solid ${C.border}33`,
                          borderLeft: !member ? `3px solid ${C.gold}` : '3px solid transparent',
                          background: !member ? `${C.gold}0a` : 'transparent',
                        }}>
                          <td style={{ padding: '6px 10px', color: C.muted, fontSize: 15, position: 'sticky', left: 0, zIndex: 1, background: !member ? `${C.gold}0a` : C.surface }}>{p}</td>
                          {member ? (
                            <>
                              {/* 会員番号（表示のみ・申込管理タブから変更） */}
                              <td style={{ padding: '6px 10px', fontSize: 15, color: C.text, fontFamily: 'monospace' }}>
                                {member.member_code ?? '-'}
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
                              {/* クラス（表示のみ・申込管理タブから変更） */}
                              <td style={{ padding: '4px 6px' }} title="クラスの変更は「申込管理」タブから行ってください">
                                {member.class ? (
                                  <span style={{
                                    background: classBadgeBg(member.class),
                                    color: classBadgeColor(member.class),
                                    borderRadius: 4,
                                    padding: '1px 7px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                  }}>{member.class}</span>
                                ) : <span style={{ color: C.muted }}>-</span>}
                              </td>
                              {/* 審判（表示のみ・申込管理タブから変更） */}
                              <td style={{ padding: '4px 6px', textAlign: 'center' }} title="審判の変更は「申込管理」タブから行ってください">
                                <span style={{ fontSize: 15, color: member.is_judge ? C.gold : C.muted }}>
                                  {member.is_judge ? '⚑' : '-'}
                                </span>
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
            <div style={{ marginTop: 20, marginBottom: 4, display: 'flex', justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              {!reorderMode ? (
                <button
                  onClick={enterReorderMode}
                  style={{ background: C.surface2, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
                >
                  選手組替
                </button>
              ) : randomPreview ? (
                <>
                  <button
                    onClick={cancelRandomPreview}
                    style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
                  >
                    組替をキャンセル
                  </button>
                  <button
                    onClick={saveRandomPreview}
                    disabled={saving}
                    style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? '保存中...' : '組替を保存'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={openUnusedModal}
                    style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}
                  >
                    空席設定
                  </button>
                  <button
                    onClick={handleRandomShuffle}
                    style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
                  >
                    ランダム組替
                  </button>
                  {selectedDay === 2 && (
                    <button
                      onClick={handlePreviousDayRankShuffle}
                      disabled={saving}
                      style={{ background: '#2980b9', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
                    >
                      {saving ? '処理中...' : '前日の成績順組替'}
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setReorderMode(false)}
                    style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
                  >
                    組替モード終了
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reorder Mode */}
          {reorderMode && (
            <div style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                <span style={{ fontWeight: 600, color: C.gold, fontSize: 16 }}>
                  選手組替モード {randomPreview ? '— プレビュー中（手動編集ロック）' : '— ⋮⋮ アイコンをクリックして組と射順を変更してください'}
                </span>
              </div>
              {randomPreview && (
                <div style={{ padding: '10px 14px', background: '#2a1a00', borderBottom: `1px solid #fbbf24`, color: '#fbbf24', fontSize: 13 }}>
                  ⚠️ プレビュー中: ランダム組替の結果を表示しています。「保存」または「キャンセル」を選択してください。
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
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
                      <tr key={`slot-${slot.group}-${slot.position}`} style={{
                        borderBottom: `1px solid ${C.border}33`,
                        background: slot.isUnused ? '#1a1a1a55' : 'transparent',
                      }}>
                        <td style={{ padding: '5px 10px', color: C.muted, fontSize: 15 }}>{slot.group}組</td>
                        <td style={{ padding: '5px 10px', color: C.muted, fontSize: 15 }}>{slot.position}</td>
                        <td style={{ padding: '5px 10px', color: C.text, fontSize: 15 }}>
                          {slot.isUnused ? (
                            <span style={{ color: C.muted, fontStyle: 'italic' }}>空席</span>
                          ) : slot.member ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                onClick={() => openMoveModal(slot)}
                                title="クリックして組と射順を変更"
                                style={{
                                  cursor: randomPreview ? 'not-allowed' : 'pointer',
                                  color: randomPreview ? '#444' : C.gold,
                                  fontSize: 18,
                                  userSelect: 'none',
                                  padding: '0 4px',
                                  opacity: randomPreview ? 0.4 : 1,
                                }}
                              >⋮⋮</span>
                              {slot.member.name}{slot.member.is_judge ? <span style={{ color: C.gold, marginLeft: 6 }}>⚑</span> : ''}
                            </div>
                          ) : <span style={{ color: C.gold }}>－（空き）</span>}
                        </td>
                        <td style={{ padding: '5px 10px', color: C.muted, fontSize: 15 }}>{slot.member?.belong ?? (slot.isUnused ? '—' : '-')}</td>
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
                          ) : (slot.isUnused ? <span style={{ color: C.muted }}>—</span> : '-')}
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

    </div>
  );
}

function classBadgeBg(c: ClassType): string {
  return { AAA: '#9b59b633', AA: '#e74c3c33', A: `${C.gold}33`, B: '#3498db33', C: '#2ecc7133' }[c] ?? '';
}
function classBadgeColor(c: ClassType): string {
  return { AAA: '#9b59b6', AA: '#e74c3c', A: C.gold, B: '#3498db', C: '#2ecc71' }[c] ?? C.muted;
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '24px 32px', minWidth: 360, maxWidth: 480, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 17, color: C.gold, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
          選手の組・射順を変更
        </h3>

        {/* 現在 */}
        <div style={{ background: C.surface2, padding: '10px 14px', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: C.muted, fontSize: 13, fontWeight: 600, minWidth: 40 }}>現在</span>
          <span style={{ color: C.gold, fontSize: 15, fontWeight: 600 }}>{slot.group}組</span>
          <span style={{ color: C.muted, fontSize: 14 }}>射順</span>
          <span style={{ color: C.gold, fontSize: 15, fontWeight: 600 }}>{slot.position}</span>
          <span style={{ color: C.muted, fontSize: 14 }}>·</span>
          <span style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>
            {slot.member?.name}
            {slot.member?.is_judge ? <span style={{ color: C.gold, marginLeft: 6 }}>⚑</span> : ''}
          </span>
        </div>

        {/* 変更 */}
        <div style={{ background: '#1a1500', padding: '10px 14px', borderRadius: 6, marginBottom: 18, border: `1px solid ${C.gold}66`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.muted, fontSize: 13, fontWeight: 600, minWidth: 40 }}>変更</span>
          <select
            value={targetGroup}
            onChange={e => onChangeGroup(Number(e.target.value))}
            style={{
              background: C.inputBg, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '8px 12px', fontSize: 14, cursor: 'pointer',
            }}
          >
            {Array.from({ length: maxGroup }, (_, i) => i + 1).map(g => (
              <option key={g} value={g}>{g}組</option>
            ))}
          </select>
          <select
            value={targetPosition}
            onChange={e => onChangePosition(Number(e.target.value))}
            style={{
              background: C.inputBg, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '8px 12px', fontSize: 14, cursor: 'pointer',
            }}
          >
            {Array.from({ length: POSITIONS }, (_, i) => i + 1).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <button onClick={onCancel} style={{
            background: C.surface2, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '8px 18px', fontSize: 14, cursor: 'pointer',
          }}>キャンセル</button>
          <button onClick={onConfirm} style={{
            background: C.green, color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>決定</button>
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '28px 36px', minWidth: 480, maxWidth: 680, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, color: C.gold, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
          空席に設定したい射順を選択してください（{day}日目）
        </h3>

        {Array.from({ length: groupCount }, (_, gi) => gi + 1).map(g => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ width: 56, color: '#aaa', fontSize: 14, fontWeight: 600 }}>{g}組</span>
            {Array.from({ length: POSITIONS }, (_, pi) => pi + 1).map(p => {
              const key = `${g}-${p}`;
              const selected = draft.has(key);
              return (
                <button
                  key={p}
                  onClick={() => onToggle(g, p)}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    border: `2px solid ${selected ? '#ef4444' : '#555'}`,
                    background: selected ? '#ef4444' : 'transparent',
                    color: selected ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    fontSize: 14,
                    transition: 'all 0.15s',
                  }}
                >{p}</button>
              );
            })}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            background: C.surface2, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '8px 18px', fontSize: 14, cursor: 'pointer',
          }}>閉じる</button>
          <button onClick={onSave} disabled={saving} style={{
            background: C.gold, color: '#000', border: 'none',
            borderRadius: 6, padding: '8px 22px', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}
