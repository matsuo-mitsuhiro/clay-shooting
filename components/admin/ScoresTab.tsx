'use client';

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/colors';
import { ErrorModal } from '@/components/ModalDialog';
import type { Member, Score, ScoreStatus, Tournament } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament | null;
}

type RoundKey = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8';
type ExtraKey = 'cb' | 'fr';
type NumpadField = RoundKey | ExtraKey;

type ScoreEntry = {
  r1: string; r2: string; r3: string; r4: string;
  r5: string; r6: string; r7: string; r8: string;
  cb: string; fr: string;
  status: ScoreStatus;
};
type ScoreMap = { [memberCode: string]: ScoreEntry };

const emptyScoreEntry = (): ScoreEntry => ({
  r1: '', r2: '', r3: '', r4: '', r5: '', r6: '', r7: '', r8: '',
  cb: '', fr: '',
  status: 'valid',
});

// ---- NumPad ----
// variant='score': keys 0-9, max 25, 赤色閾値23
// variant='cb':    keys 1-6 only, max 6
// variant='fr':    keys 0-9, max 99
function NumPad({ member, value, onChange, onConfirm, onClose, variant = 'score' }: {
  member: { name: string; round: string };
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  variant?: 'score' | 'cb' | 'fr';
}) {
  const maxVal = variant === 'cb' ? 6 : variant === 'fr' ? 99 : 25;
  const numColor = variant === 'score' && value !== '' && Number(value) >= 23
    ? '#e74c3c'
    : '#3498db';

  const roundLabel =
    variant === 'cb' ? 'CB' :
    variant === 'fr' ? 'FR' :
    member.round.toUpperCase();

  function handleKey(k: string) {
    if (k === 'C') { onChange(''); return; }
    if (k === '決定') { onConfirm(); return; }
    // FR の先頭 0 を防ぐ
    if (variant === 'fr' && value === '' && k === '0') return;
    const next = value + k;
    if (Number(next) > maxVal) return;
    onChange(next);
  }

  // CB: 1〜6 + C + 決定（4列グリッド）
  const cbKeys = ['1', '2', '3', '4', '5', '6', 'C', '決定'];
  // 通常: 0〜9 + C + 決定（3列グリッド）
  const defaultKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'C', '決定'];

  const keys = variant === 'cb' ? cbKeys : defaultKeys;
  const gridCols = variant === 'cb' ? 4 : 3;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 20, minWidth: variant === 'cb' ? 260 : 220,
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}
        >×</button>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 17, color: C.text, fontWeight: 600 }}>{member.name}</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
            {roundLabel}
            {variant === 'cb' && <span style={{ fontSize: 11, marginLeft: 6 }}>(1〜6)</span>}
            {variant === 'fr' && <span style={{ fontSize: 11, marginLeft: 6 }}>(1〜99)</span>}
          </div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: numColor,
            minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {value === '' ? '　' : value}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 8 }}>
          {keys.map(k => (
            <button
              key={k}
              onClick={() => handleKey(k)}
              style={{
                background: k === '決定' ? C.gold : C.surface2,
                color: k === '決定' ? '#000' : C.text,
                border: `1px solid ${k === '決定' ? C.gold : C.border}`,
                borderRadius: 6, padding: '14px 8px', fontSize: 17, fontWeight: 600, cursor: 'pointer',
              }}
            >{k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScoresTab({ tournamentId, tournament }: Props) {
  const hasTwoDays = !!(tournament?.day2_date);
  const [selectedDay, setSelectedDay] = useState<1 | 2>(1);
  const [groupFilter, setGroupFilter] = useState<'all' | number>('all');
  const [members, setMembers] = useState<Member[]>([]);
  const [scoreMap, setScoreMap] = useState<ScoreMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Numpad state
  const [numpadOpen, setNumpadOpen] = useState(false);
  const [numpadField, setNumpadField] = useState<NumpadField>('r1');
  const [numpadMember, setNumpadMember] = useState<{ code: string; name: string } | null>(null);
  const [numpadValue, setNumpadValue] = useState('');

  // 保存確認ダイアログ state
  const [saveConfirm, setSaveConfirm] = useState<{ groupNum: number; field: NumpadField; fieldLabel: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [membersRes, scoresRes] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}/members`),
        fetch(`/api/tournaments/${tournamentId}/scores`),
      ]);
      const membersJson = await membersRes.json();
      const scoresJson = await scoresRes.json();
      if (!membersJson.success) throw new Error(membersJson.error);
      if (!scoresJson.success) throw new Error(scoresJson.error);

      setMembers(membersJson.data);

      const map: ScoreMap = {};
      for (const s of (scoresJson.data as Score[])) {
        map[s.member_code] = {
          r1: s.r1 !== null && s.r1 !== undefined ? String(s.r1) : '',
          r2: s.r2 !== null && s.r2 !== undefined ? String(s.r2) : '',
          r3: s.r3 !== null && s.r3 !== undefined ? String(s.r3) : '',
          r4: s.r4 !== null && s.r4 !== undefined ? String(s.r4) : '',
          r5: s.r5 !== null && s.r5 !== undefined ? String(s.r5) : '',
          r6: s.r6 !== null && s.r6 !== undefined ? String(s.r6) : '',
          r7: s.r7 !== null && s.r7 !== undefined ? String(s.r7) : '',
          r8: s.r8 !== null && s.r8 !== undefined ? String(s.r8) : '',
          cb: s.cb !== null && s.cb !== undefined ? String(s.cb) : '',
          fr: s.fr !== null && s.fr !== undefined ? String(s.fr) : '',
          status: s.status ?? 'valid',
        };
      }
      setScoreMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dayMembers = members.filter(m => m.day === selectedDay);
  const groups = Array.from(new Set(dayMembers.map(m => m.group_number))).sort((a, b) => a - b);
  const filteredGroups = groupFilter === 'all' ? groups : groups.filter(g => g === groupFilter);

  function updateField(memberCode: string, field: NumpadField, value: string) {
    setScoreMap(prev => ({
      ...prev,
      [memberCode]: {
        ...(prev[memberCode] ?? emptyScoreEntry()),
        [field]: value,
      },
    }));
  }

  function isInvalid(value: string): boolean {
    if (value === '') return false;
    const n = Number(value);
    return isNaN(n) || n < 0 || n > 25;
  }

  function calcSubtotal(memberCode: string, rounds: RoundKey[]): string {
    const entry = scoreMap[memberCode];
    if (!entry) return '-';
    let total = 0;
    let hasAny = false;
    for (const r of rounds) {
      const v = entry[r];
      if (v !== '') { hasAny = true; total += Number(v); }
    }
    return hasAny ? String(total) : '-';
  }

  function openNumpad(member: Member, field: NumpadField) {
    const code = member.member_code ?? '';
    setNumpadMember({ code, name: member.name });
    setNumpadField(field);
    setNumpadValue((scoreMap[code] as ScoreEntry)?.[field] ?? '');
    setNumpadOpen(true);
  }

  function confirmNumpad() {
    if (!numpadMember) return;
    updateField(numpadMember.code, numpadField, numpadValue);

    // 現在のメンバーの組を特定
    const currentMember = dayMembers.find(m => m.member_code === numpadMember.code);
    const currentGroupNum = currentMember?.group_number;

    // 同じ組の中で member_code があるメンバーのみ（空きスロットを除く）
    const groupMembersWithCode = dayMembers.filter(
      m => m.group_number === currentGroupNum && m.member_code
    );

    const currentIdx = groupMembersWithCode.findIndex(m => m.member_code === numpadMember.code);
    const next = groupMembersWithCode[currentIdx + 1];

    if (next && next.member_code) {
      // 同じ組の次のメンバーへナビゲーション
      setNumpadMember({ code: next.member_code, name: next.name });
      setNumpadValue((scoreMap[next.member_code] as ScoreEntry)?.[numpadField] ?? '');
    } else {
      // 最後の選手 → 保存確認ダイアログを表示
      const fieldLabel =
        numpadField === 'cb' ? 'CB' :
        numpadField === 'fr' ? 'FR' :
        numpadField.toUpperCase(); // r1 → R1
      setNumpadOpen(false);
      setNumpadMember(null);
      setSaveConfirm({ groupNum: currentGroupNum!, field: numpadField, fieldLabel });
    }
  }

  async function handleSaveGroup(groupNum: number, savedField?: NumpadField | 'status') {
    setError(null);
    setSuccess(null);
    const groupMembers = dayMembers.filter(m => m.group_number === groupNum);
    const rounds: RoundKey[] = selectedDay === 1
      ? ['r1', 'r2', 'r3', 'r4']
      : ['r5', 'r6', 'r7', 'r8'];

    const scores = groupMembers
      .filter(m => m.member_code)
      .map(m => {
        const entry = scoreMap[m.member_code!] ?? emptyScoreEntry();
        const toNum = (v: string) => v === '' ? null : Number(v);
        return {
          member_code: m.member_code!,
          name: m.name,
          r1: selectedDay === 1 ? toNum(entry.r1) : (entry.r1 !== '' ? Number(entry.r1) : null),
          r2: selectedDay === 1 ? toNum(entry.r2) : (entry.r2 !== '' ? Number(entry.r2) : null),
          r3: selectedDay === 1 ? toNum(entry.r3) : (entry.r3 !== '' ? Number(entry.r3) : null),
          r4: selectedDay === 1 ? toNum(entry.r4) : (entry.r4 !== '' ? Number(entry.r4) : null),
          r5: selectedDay === 2 ? toNum(entry.r5) : (entry.r5 !== '' ? Number(entry.r5) : null),
          r6: selectedDay === 2 ? toNum(entry.r6) : (entry.r6 !== '' ? Number(entry.r6) : null),
          r7: selectedDay === 2 ? toNum(entry.r7) : (entry.r7 !== '' ? Number(entry.r7) : null),
          r8: selectedDay === 2 ? toNum(entry.r8) : (entry.r8 !== '' ? Number(entry.r8) : null),
          cb: entry.cb === '' ? null : Number(entry.cb),
          fr: entry.fr === '' ? null : Number(entry.fr),
          status: entry.status,
        };
      });

    for (const s of scores) {
      for (const r of rounds) {
        const v = s[r as keyof typeof s];
        if (v !== null && (Number(v) < 0 || Number(v) > 25)) {
          setError(`${groupNum}組、${s.name}、${r.toUpperCase()} は現在 ${v} です。0〜25 以内の数字を入力してください`);
          return;
        }
      }
    }

    if (scores.length === 0) {
      setError('会員番号が登録されていないメンバーは点数を保存できません');
      return;
    }

    try {
      setSaving(groupNum);
      const res = await fetch(`/api/tournaments/${tournamentId}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores, group_number: groupNum, round: savedField }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess(`${groupNum}組の点数を保存しました`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '点数の保存に失敗しました');
    } finally {
      setSaving(null);
    }
  }

  const rounds: RoundKey[] = selectedDay === 1 ? ['r1', 'r2', 'r3', 'r4'] : ['r5', 'r6', 'r7', 'r8'];
  const roundLabels = selectedDay === 1
    ? ['R1', 'R2', 'R3', 'R4']
    : ['R5', 'R6', 'R7', 'R8'];

  const numpadVariant: 'score' | 'cb' | 'fr' =
    numpadField === 'cb' ? 'cb' :
    numpadField === 'fr' ? 'fr' :
    'score';

  const anyModalOpen = numpadOpen || !!saveConfirm;

  return (
    <div>
      {/* Numpad Popup */}
      {numpadOpen && numpadMember && (
        <NumPad
          member={{ name: numpadMember.name, round: numpadField }}
          value={numpadValue}
          onChange={setNumpadValue}
          onConfirm={confirmNumpad}
          onClose={() => { setNumpadOpen(false); setNumpadMember(null); }}
          variant={numpadVariant}
        />
      )}

      {/* 保存確認ダイアログ */}
      {saveConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '32px 28px', minWidth: 280,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, color: C.text, fontWeight: 600, marginBottom: 28 }}>
              {saveConfirm.groupNum}組{saveConfirm.fieldLabel}を保存しますか？
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={async () => {
                  const gn = saveConfirm.groupNum;
                  const fld = saveConfirm.field;
                  setSaveConfirm(null);
                  await handleSaveGroup(gn, fld);
                }}
                style={{
                  background: C.gold, color: '#000', border: 'none',
                  borderRadius: 6, padding: '10px 28px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                }}
              >
                はい
              </button>
              <button
                onClick={() => {
                  // 該当組の該当フィールドをクリア
                  const groupMems = dayMembers.filter(
                    m => m.group_number === saveConfirm.groupNum && m.member_code
                  );
                  groupMems.forEach(m => updateField(m.member_code!, saveConfirm.field, ''));
                  setSaveConfirm(null);
                }}
                style={{
                  background: 'transparent', color: C.muted,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: '10px 28px', fontSize: 16, cursor: 'pointer',
                }}
              >
                クリア
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 16px', maxWidth: 1060, margin: '0 auto', pointerEvents: anyModalOpen ? 'none' as const : 'auto' as const }}>
      {/* Day Tabs — 2日開催時のみ表示 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {hasTwoDays && ([1, 2] as const).map(day => (
          <button
            key={day}
            onClick={() => { setSelectedDay(day); setGroupFilter('all'); }}
            style={{
              background: selectedDay === day ? (day === 1 ? C.gold : C.blue2) : C.surface,
              color: selectedDay === day ? (day === 1 ? '#000' : '#fff') : C.muted,
              border: `1px solid ${selectedDay === day ? (day === 1 ? C.gold : C.blue2) : C.border}`,
              borderRadius: 6,
              padding: '7px 18px',
              fontSize: 16,
              fontWeight: selectedDay === day ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {day}日目 (R{day === 1 ? '1-4' : '5-8'})
          </button>
        ))}
        <button
          onClick={fetchData}
          style={{
            background: 'transparent', color: C.muted,
            border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '7px 12px', fontSize: 15, cursor: 'pointer',
          }}
        >
          ↺ 再読込
        </button>
      </div>

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
      ) : dayMembers.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '40px 24px', textAlign: 'center', color: C.muted,
        }}>
          {selectedDay}日目の選手が登録されていません。先に選手管理で登録を行ってください。
        </div>
      ) : (
        <>
          {/* Group Filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => setGroupFilter('all')}
              style={{
                background: groupFilter === 'all' ? C.surface2 : C.surface,
                color: groupFilter === 'all' ? C.gold : C.muted,
                border: `1px solid ${groupFilter === 'all' ? C.gold : C.border}`,
                borderRadius: 5, padding: '5px 14px', fontSize: 15,
                fontWeight: groupFilter === 'all' ? 700 : 400, cursor: 'pointer',
              }}
            >
              全組
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                style={{
                  background: groupFilter === g ? C.surface2 : C.surface,
                  color: groupFilter === g ? C.gold : C.muted,
                  border: `1px solid ${groupFilter === g ? C.gold : C.border}`,
                  borderRadius: 5, padding: '5px 14px', fontSize: 15,
                  fontWeight: groupFilter === g ? 700 : 400, cursor: 'pointer',
                }}
              >
                {g}組
              </button>
            ))}
          </div>

          {/* Score Tables per group */}
          {filteredGroups.map(groupNum => {
            const gMembers = dayMembers.filter(m => m.group_number === groupNum);
            return (
              <div key={groupNum} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, overflow: 'hidden', marginBottom: 20,
              }}>
                <div style={{
                  padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: C.surface2,
                }}>
                  <span style={{ fontWeight: 600, color: C.text, fontSize: 16 }}>
                    {hasTwoDays ? `${selectedDay}日目 ` : ''}{groupNum}組
                  </span>
                  <button
                    onClick={() => handleSaveGroup(groupNum)}
                    disabled={saving === groupNum}
                    style={{
                      background: selectedDay === 1 ? C.gold : C.blue2,
                      color: selectedDay === 1 ? '#000' : '#fff',
                      border: 'none', borderRadius: 5,
                      padding: '6px 16px', fontSize: 15, fontWeight: 700,
                      cursor: saving === groupNum ? 'not-allowed' : 'pointer',
                      opacity: saving === groupNum ? 0.7 : 1,
                    }}
                  >
                    {saving === groupNum ? '保存中...' : 'この組の点数を保存'}
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                    <thead>
                      <tr style={{ background: `${C.surface2}88` }}>
                        <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, background: C.surface2 }}>氏名</th>
                        <th style={thStyle}>所属協会</th>
                        {roundLabels.map(l => (
                          <th key={l} style={thStyle}>{l}</th>
                        ))}
                        <th style={thStyle}>小計</th>
                        <th style={{ ...thStyle, color: '#e67e22' }}>CB</th>
                        <th style={{ ...thStyle, color: '#9b59b6' }}>FR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gMembers.map(m => {
                        const code = m.member_code ?? '';
                        const entry = scoreMap[code] ?? emptyScoreEntry();
                        const subtotal = calcSubtotal(code, rounds);
                        const isDQ = entry.status === 'disqualified' || entry.status === 'withdrawn';

                        return (
                          <tr
                            key={m.id}
                            style={{
                              borderBottom: `1px solid ${C.border}33`,
                              background: isDQ ? '#e74c3c08' : 'transparent',
                            }}
                          >
                            {/* 氏名 */}
                            <td style={{ padding: '6px 10px', fontSize: 15, color: isDQ ? '#e74c3c' : C.text, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: isDQ ? '#1a1d24' : C.surface }}>
                              {m.is_judge ? <span style={{ color: C.gold }}>⚑ </span> : ''}
                              {m.position}. {m.name}
                              {!code && (
                                <span style={{ fontSize: 13, color: C.red, marginLeft: 6 }}>(会員番号なし)</span>
                              )}
                            </td>

                            {/* 所属協会 */}
                            <td style={{ padding: '6px 10px', fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>
                              {m.belong ?? '-'}
                            </td>

                            {/* ラウンド点数 */}
                            {rounds.map(r => (
                              <td key={r} style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {code ? (
                                  <button
                                    onClick={() => openNumpad(m, r)}
                                    disabled={isDQ}
                                    style={{
                                      background: C.inputBg,
                                      border: `1px solid ${isInvalid(entry[r]) ? C.red : C.border}`,
                                      borderRadius: 4,
                                      color: entry[r] !== '' && Number(entry[r]) >= 23 ? '#e74c3c' : isDQ ? C.muted : C.text,
                                      padding: '6px 8px',
                                      fontSize: 15,
                                      width: 66,
                                      textAlign: 'center',
                                      cursor: isDQ ? 'not-allowed' : 'pointer',
                                      fontWeight: entry[r] !== '' && Number(entry[r]) >= 23 ? 700 : 400,
                                      opacity: isDQ ? 0.5 : 1,
                                    }}
                                  >
                                    {entry[r] === '' ? '　' : entry[r]}
                                  </button>
                                ) : (
                                  <span style={{ color: C.muted, fontSize: 13 }}>-</span>
                                )}
                              </td>
                            ))}

                            {/* 小計 */}
                            <td style={{
                              padding: '6px 10px', textAlign: 'center', fontSize: 15,
                              color: subtotal !== '-' ? C.text : C.muted, fontWeight: 600,
                            }}>
                              {subtotal}
                            </td>

                            {/* CB */}
                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                              {code ? (
                                <button
                                  onClick={() => openNumpad(m, 'cb')}
                                  disabled={isDQ}
                                  style={{
                                    background: entry.cb !== '' ? `#e67e2222` : C.inputBg,
                                    border: `1px solid ${entry.cb !== '' ? '#e67e22' : C.border}`,
                                    borderRadius: 4,
                                    color: entry.cb !== '' ? '#e67e22' : isDQ ? C.muted : C.text,
                                    padding: '6px 8px',
                                    fontSize: 15,
                                    width: 54,
                                    textAlign: 'center',
                                    cursor: isDQ ? 'not-allowed' : 'pointer',
                                    fontWeight: entry.cb !== '' ? 700 : 400,
                                    opacity: isDQ ? 0.5 : 1,
                                  }}
                                >
                                  {entry.cb === '' ? '　' : entry.cb}
                                </button>
                              ) : (
                                <span style={{ color: C.muted, fontSize: 13 }}>-</span>
                              )}
                            </td>

                            {/* FR */}
                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                              {code ? (
                                <button
                                  onClick={() => openNumpad(m, 'fr')}
                                  disabled={isDQ}
                                  style={{
                                    background: entry.fr !== '' ? `#9b59b622` : C.inputBg,
                                    border: `1px solid ${entry.fr !== '' ? '#9b59b6' : C.border}`,
                                    borderRadius: 4,
                                    color: entry.fr !== '' ? '#9b59b6' : isDQ ? C.muted : C.text,
                                    padding: '6px 8px',
                                    fontSize: 15,
                                    width: 54,
                                    textAlign: 'center',
                                    cursor: isDQ ? 'not-allowed' : 'pointer',
                                    fontWeight: entry.fr !== '' ? 700 : 400,
                                    opacity: isDQ ? 0.5 : 1,
                                  }}
                                >
                                  {entry.fr === '' ? '　' : entry.fr}
                                </button>
                              ) : (
                                <span style={{ color: C.muted, fontSize: 13 }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 14,
  color: C.muted,
  fontWeight: 600,
  textAlign: 'center',
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};
