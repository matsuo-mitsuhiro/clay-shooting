'use client';

import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/colors';
import type { Member, Score } from '@/lib/types';

interface Props {
  tournamentId: number;
}

type RoundKey = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8';
type ScoreMap = { [memberCode: string]: { r1: string; r2: string; r3: string; r4: string; r5: string; r6: string; r7: string; r8: string } };

const emptyScoreEntry = () => ({ r1: '', r2: '', r3: '', r4: '', r5: '', r6: '', r7: '', r8: '' });

export default function ScoresTab({ tournamentId }: Props) {
  const [selectedDay, setSelectedDay] = useState<1 | 2>(1);
  const [groupFilter, setGroupFilter] = useState<'all' | number>('all');
  const [members, setMembers] = useState<Member[]>([]);
  const [scoreMap, setScoreMap] = useState<ScoreMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  function updateScore(memberCode: string, round: RoundKey, value: string) {
    setScoreMap(prev => ({
      ...prev,
      [memberCode]: {
        ...(prev[memberCode] ?? emptyScoreEntry()),
        [round]: value,
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
      if (v !== '') {
        hasAny = true;
        total += Number(v);
      }
    }
    return hasAny ? String(total) : '-';
  }

  async function handleSaveGroup(groupNum: number) {
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
        // For day 1, preserve existing r5-r8; for day 2, preserve r1-r4
        const existing = scoreMap[m.member_code!] ?? emptyScoreEntry();
        return {
          member_code: m.member_code!,
          name: m.name,
          r1: selectedDay === 1 ? toNum(entry.r1) : (existing.r1 !== '' ? Number(existing.r1) : null),
          r2: selectedDay === 1 ? toNum(entry.r2) : (existing.r2 !== '' ? Number(existing.r2) : null),
          r3: selectedDay === 1 ? toNum(entry.r3) : (existing.r3 !== '' ? Number(existing.r3) : null),
          r4: selectedDay === 1 ? toNum(entry.r4) : (existing.r4 !== '' ? Number(existing.r4) : null),
          r5: selectedDay === 2 ? toNum(entry.r5) : (existing.r5 !== '' ? Number(existing.r5) : null),
          r6: selectedDay === 2 ? toNum(entry.r6) : (existing.r6 !== '' ? Number(existing.r6) : null),
          r7: selectedDay === 2 ? toNum(entry.r7) : (existing.r7 !== '' ? Number(existing.r7) : null),
          r8: selectedDay === 2 ? toNum(entry.r8) : (existing.r8 !== '' ? Number(existing.r8) : null),
        };
      });

    // Validate
    for (const s of scores) {
      for (const r of rounds) {
        const v = s[r as keyof typeof s];
        if (v !== null && (Number(v) < 0 || Number(v) > 25)) {
          setError(`点数は0〜25の範囲で入力してください`);
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
        body: JSON.stringify({ scores }),
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

  const inputStyle = (value: string): React.CSSProperties => ({
    background: C.inputBg,
    border: `1px solid ${isInvalid(value) ? C.red : C.border}`,
    borderRadius: 4,
    color: value !== '' && Number(value) >= 23 ? '#e74c3c' : C.text,
    padding: '4px 6px',
    fontSize: 13,
    width: 44,
    textAlign: 'center',
    boxSizing: 'border-box',
    fontWeight: value !== '' && Number(value) >= 23 ? 700 : 400,
  });

  return (
    <div style={{ padding: '20px 16px', maxWidth: 960, margin: '0 auto' }}>
      {/* Day Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {([1, 2] as const).map(day => (
          <button
            key={day}
            onClick={() => { setSelectedDay(day); setGroupFilter('all'); }}
            style={{
              background: selectedDay === day ? (day === 1 ? C.gold : C.blue2) : C.surface,
              color: selectedDay === day ? (day === 1 ? '#000' : '#fff') : C.muted,
              border: `1px solid ${selectedDay === day ? (day === 1 ? C.gold : C.blue2) : C.border}`,
              borderRadius: 6,
              padding: '7px 18px',
              fontSize: 14,
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
            background: 'transparent',
            color: C.muted,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 13,
            cursor: 'pointer',
            marginLeft: 8,
          }}
        >
          ↺ 再読込
        </button>
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
      ) : dayMembers.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '40px 24px', textAlign: 'center', color: C.muted,
        }}>
          {selectedDay}日目のメンバーが登録されていません。先にメンバー登録を行ってください。
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
                borderRadius: 5, padding: '5px 14px', fontSize: 13,
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
                  borderRadius: 5, padding: '5px 14px', fontSize: 13,
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
                  <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
                    {selectedDay}日目 {groupNum}組
                  </span>
                  <button
                    onClick={() => handleSaveGroup(groupNum)}
                    disabled={saving === groupNum}
                    style={{
                      background: selectedDay === 1 ? C.gold : C.blue2,
                      color: selectedDay === 1 ? '#000' : '#fff',
                      border: 'none', borderRadius: 5,
                      padding: '6px 16px', fontSize: 13, fontWeight: 700,
                      cursor: saving === groupNum ? 'not-allowed' : 'pointer',
                      opacity: saving === groupNum ? 0.7 : 1,
                    }}
                  >
                    {saving === groupNum ? '保存中...' : 'この組を保存'}
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: `${C.surface2}88` }}>
                        <th style={thStyle}>氏名</th>
                        {roundLabels.map(l => (
                          <th key={l} style={thStyle}>{l}</th>
                        ))}
                        <th style={thStyle}>小計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gMembers.map(m => {
                        const code = m.member_code ?? '';
                        const entry = scoreMap[code] ?? emptyScoreEntry();
                        const subtotal = calcSubtotal(code, rounds);
                        return (
                          <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}33` }}>
                            <td style={{ padding: '6px 10px', fontSize: 13, color: C.text, whiteSpace: 'nowrap' }}>
                              {m.is_judge ? <span style={{ color: C.gold }}>⚑ </span> : ''}
                              {m.name}
                              {!code && (
                                <span style={{ fontSize: 11, color: C.red, marginLeft: 6 }}>(会員番号なし)</span>
                              )}
                            </td>
                            {rounds.map(r => (
                              <td key={r} style={{ padding: '4px 6px', textAlign: 'center' }}>
                                {code ? (
                                  <input
                                    type="number"
                                    min={0}
                                    max={25}
                                    value={entry[r]}
                                    onChange={e => updateScore(code, r, e.target.value)}
                                    style={inputStyle(entry[r])}
                                  />
                                ) : (
                                  <span style={{ color: C.muted, fontSize: 12 }}>-</span>
                                )}
                              </td>
                            ))}
                            <td style={{
                              padding: '6px 10px', textAlign: 'center', fontSize: 13,
                              color: subtotal !== '-' ? C.text : C.muted,
                              fontWeight: 600,
                            }}>
                              {subtotal}
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
  );
}

const thStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  color: C.muted,
  fontWeight: 600,
  textAlign: 'center',
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};
