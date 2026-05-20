'use client';

import { useState, useEffect, useCallback } from 'react';
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

// --- Tailwind class constants (lib/colors.ts と @theme を経由したカラー) ---
const overlayClass = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]';
const thBaseClass = 'px-2.5 py-[7px] text-[14px] text-muted font-semibold border-b border-border whitespace-nowrap';

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
  const isRed = variant === 'score' && value !== '' && Number(value) >= 23;

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

  return (
    <div className={overlayClass}>
      <div className={`relative bg-surface border border-border rounded-xl p-5 ${variant === 'cb' ? 'min-w-[260px]' : 'min-w-[220px]'}`}>
        <button
          onClick={onClose}
          className="absolute top-[10px] right-[10px] bg-transparent border-none text-muted text-[20px] cursor-pointer"
        >×</button>
        <div className="text-center mb-3">
          <div className="text-[17px] text-text font-semibold">{member.name}</div>
          <div className="text-[13px] text-muted mb-1">
            {roundLabel}
            {variant === 'cb' && <span className="text-[11px] ml-1.5">(1〜6)</span>}
            {variant === 'fr' && <span className="text-[11px] ml-1.5">(1〜99)</span>}
          </div>
          <div className={`text-[36px] font-bold min-h-[50px] flex items-center justify-center ${isRed ? 'text-[#e74c3c]' : 'text-[#3498db]'}`}>
            {value === '' ? '　' : value}
          </div>
        </div>
        <div className={`grid gap-2 ${variant === 'cb' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {keys.map(k => (
            <button
              key={k}
              onClick={() => handleKey(k)}
              className={`rounded-md px-2 py-3.5 text-[17px] font-semibold cursor-pointer border ${
                k === '決定'
                  ? 'bg-gold text-black border-gold'
                  : 'bg-surface-2 text-text border-border'
              }`}
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
        <div className={overlayClass}>
          <div className="bg-surface border border-border rounded-xl px-7 py-8 min-w-[280px] text-center">
            <div className="text-[18px] text-text font-semibold mb-7">
              {saveConfirm.groupNum}組{saveConfirm.fieldLabel}を保存しますか？
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={async () => {
                  const gn = saveConfirm.groupNum;
                  const fld = saveConfirm.field;
                  setSaveConfirm(null);
                  await handleSaveGroup(gn, fld);
                }}
                className="bg-gold text-black border-none rounded-md px-7 py-2.5 text-[16px] font-bold cursor-pointer"
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
                className="bg-transparent text-muted border border-border rounded-md px-7 py-2.5 text-[16px] cursor-pointer"
              >
                クリア
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`px-4 py-5 max-w-[1060px] mx-auto ${anyModalOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}>
      {/* Day Tabs — 2日開催時のみ表示 */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {hasTwoDays && ([1, 2] as const).map(day => {
          const active = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => { setSelectedDay(day); setGroupFilter('all'); }}
              className={`rounded-md px-[18px] py-[7px] text-[16px] border cursor-pointer ${
                active
                  ? (day === 1
                      ? 'bg-gold text-black border-gold font-bold'
                      : 'bg-blue-2 text-white border-blue-2 font-bold')
                  : 'bg-surface text-muted border-border font-normal'
              }`}
            >
              {day}日目 (R{day === 1 ? '1-4' : '5-8'})
            </button>
          );
        })}
        <button
          onClick={fetchData}
          className="bg-transparent text-muted border border-border rounded-md px-3 py-[7px] text-[15px] cursor-pointer"
        >
          ↺ 再読込
        </button>
      </div>

      {/* Error / Success */}
      <ErrorModal message={error} onClose={() => setError(null)} />
      {success && (
        <div className="bg-[#27ae6022] border border-green text-green rounded-md px-3 py-2 mb-3 text-[15px]">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-muted">読み込み中...</div>
      ) : dayMembers.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg px-6 py-10 text-center text-muted">
          {selectedDay}日目の選手が登録されていません。先に選手管理で登録を行ってください。
        </div>
      ) : (
        <>
          {/* Group Filter */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            <button
              onClick={() => setGroupFilter('all')}
              className={`rounded-[5px] px-3.5 py-[5px] text-[15px] cursor-pointer border ${
                groupFilter === 'all'
                  ? 'bg-surface-2 text-gold border-gold font-bold'
                  : 'bg-surface text-muted border-border font-normal'
              }`}
            >
              全組
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className={`rounded-[5px] px-3.5 py-[5px] text-[15px] cursor-pointer border ${
                  groupFilter === g
                    ? 'bg-surface-2 text-gold border-gold font-bold'
                    : 'bg-surface text-muted border-border font-normal'
                }`}
              >
                {g}組
              </button>
            ))}
          </div>

          {/* Score Tables per group */}
          {filteredGroups.map(groupNum => {
            const gMembers = dayMembers.filter(m => m.group_number === groupNum);
            return (
              <div key={groupNum} className="bg-surface border border-border rounded-lg overflow-hidden mb-5">
                <div className="px-3.5 py-2.5 border-b border-border flex justify-between items-center bg-surface-2">
                  <span className="font-semibold text-text text-[16px]">
                    {hasTwoDays ? `${selectedDay}日目 ` : ''}{groupNum}組
                  </span>
                  <button
                    onClick={() => handleSaveGroup(groupNum)}
                    disabled={saving === groupNum}
                    className={`border-none rounded-[5px] px-4 py-1.5 text-[15px] font-bold ${
                      selectedDay === 1 ? 'bg-gold text-black' : 'bg-blue-2 text-white'
                    } ${saving === groupNum ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
                  >
                    {saving === groupNum ? '保存中...' : 'この組の点数を保存'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[680px]">
                    <thead>
                      <tr className="bg-[#22262f88]">
                        <th className={`${thBaseClass} text-left sticky left-0 z-[2] bg-surface-2`}>氏名（ 🚩審判）</th>
                        <th className={`${thBaseClass} text-center`}>所属協会</th>
                        {roundLabels.map(l => (
                          <th key={l} className={`${thBaseClass} text-center`}>{l}</th>
                        ))}
                        <th className={`${thBaseClass} text-center`}>小計</th>
                        <th className={`${thBaseClass} text-center !text-[#e67e22]`}>CB</th>
                        <th className={`${thBaseClass} text-center !text-[#9b59b6]`}>FR</th>
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
                            className={`border-b border-[#2e334033] ${isDQ ? 'bg-[#e74c3c08]' : 'bg-transparent'}`}
                          >
                            {/* 氏名（審判フラグは氏名の後ろに表示） */}
                            <td className={`px-2.5 py-1.5 text-[15px] whitespace-nowrap sticky left-0 z-[1] bg-surface ${isDQ ? 'text-[#e74c3c]' : 'text-text'}`}>
                              {m.position}. {m.name}
                              {m.is_judge && <span className="ml-1.5">🚩</span>}
                              {!code && (
                                <span className="text-[13px] text-red ml-1.5">(会員番号なし)</span>
                              )}
                            </td>

                            {/* 所属協会 */}
                            <td className="px-2.5 py-1.5 text-[13px] text-muted whitespace-nowrap">
                              {m.belong ?? '-'}
                            </td>

                            {/* ラウンド点数 */}
                            {rounds.map(r => (
                              <td key={r} className="px-1.5 py-1 text-center">
                                {code ? (
                                  <button
                                    onClick={() => openNumpad(m, r)}
                                    disabled={isDQ}
                                    className={`bg-input-bg rounded-[4px] px-2 py-1.5 text-[15px] w-[66px] text-center border ${
                                      isInvalid(entry[r]) ? 'border-red' : 'border-border'
                                    } ${
                                      entry[r] !== '' && Number(entry[r]) >= 23
                                        ? 'text-[#e74c3c] font-bold'
                                        : isDQ ? 'text-muted font-normal' : 'text-text font-normal'
                                    } ${isDQ ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
                                  >
                                    {entry[r] === '' ? '　' : entry[r]}
                                  </button>
                                ) : (
                                  <span className="text-muted text-[13px]">-</span>
                                )}
                              </td>
                            ))}

                            {/* 小計 */}
                            <td className={`px-2.5 py-1.5 text-center text-[15px] font-semibold ${
                              subtotal !== '-' ? 'text-text' : 'text-muted'
                            }`}>
                              {subtotal}
                            </td>

                            {/* CB */}
                            <td className="px-1.5 py-1 text-center">
                              {code ? (
                                <button
                                  onClick={() => openNumpad(m, 'cb')}
                                  disabled={isDQ}
                                  className={`rounded-[4px] px-2 py-1.5 text-[15px] w-[54px] text-center border ${
                                    entry.cb !== ''
                                      ? 'bg-[#e67e2222] border-[#e67e22] text-[#e67e22] font-bold'
                                      : `bg-input-bg border-border font-normal ${isDQ ? 'text-muted' : 'text-text'}`
                                  } ${isDQ ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
                                >
                                  {entry.cb === '' ? '　' : entry.cb}
                                </button>
                              ) : (
                                <span className="text-muted text-[13px]">-</span>
                              )}
                            </td>

                            {/* FR */}
                            <td className="px-1.5 py-1 text-center">
                              {code ? (
                                <button
                                  onClick={() => openNumpad(m, 'fr')}
                                  disabled={isDQ}
                                  className={`rounded-[4px] px-2 py-1.5 text-[15px] w-[54px] text-center border ${
                                    entry.fr !== ''
                                      ? 'bg-[#9b59b622] border-[#9b59b6] text-[#9b59b6] font-bold'
                                      : `bg-input-bg border-border font-normal ${isDQ ? 'text-muted' : 'text-text'}`
                                  } ${isDQ ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
                                >
                                  {entry.fr === '' ? '　' : entry.fr}
                                </button>
                              ) : (
                                <span className="text-muted text-[13px]">-</span>
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
