'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import { C } from '@/lib/colors';
import type { Tournament, EventType } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

const ORGANIZERS = [
  { cd: 27, name: '大阪' },
  { cd: 26, name: '京都' },
  { cd: 30, name: '和歌山' },
  { cd: 29, name: '奈良' },
  { cd: 25, name: '滋賀' },
  { cd: 28, name: '兵庫' },
];

const DEFAULT_CANCELLATION_NOTICE = '当協会のホームページにて公表いたします。';

// ---------- 日付変換ヘルパー ----------
function isoStrToDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function timeStrToDate(s: string | null): Date | null {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToIsoStr(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${dd}T${h}:${mi}`;
}

function dateToTimeStr(d: Date | null): string | null {
  if (!d) return null;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

// ピッカー基準時刻（00:00）
const MIDNIGHT = new Date(new Date().setHours(0, 0, 0, 0));

// 時刻ピッカー用フィルタ: 05:00〜12:00、10分刻みのみ表示
const filterScheduleTime = (time: Date) => {
  const h = time.getHours();
  const m = time.getMinutes();
  if (h < 5 || h > 12) return false;
  if (h === 12 && m > 0) return false;
  return m % 10 === 0;
};

export default function SettingsTab({ tournamentId, tournament, onUpdated }: Props) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    venue: '',
    day1_date: '',
    day2_date: '',
    event_type: 'trap' as EventType,
    day1_set: '',
    day2_set: '',
    organizer_cd: 27,
  });

  const [applyForm, setApplyForm] = useState<{
    max_participants: string;
    apply_start_at: Date | null;
    apply_end_at: Date | null;
    cancel_end_at: Date | null;
    gate_open_time: Date | null;
    reception_start_time: Date | null;
    practice_clay_time: Date | null;
    competition_start_time: Date | null;
    cancellation_notice: string;
    notes: string;
  }>({
    max_participants: '',
    apply_start_at: null,
    apply_end_at: null,
    cancel_end_at: null,
    gate_open_time: null,
    reception_start_time: null,
    practice_clay_time: null,
    competition_start_time: null,
    cancellation_notice: DEFAULT_CANCELLATION_NOTICE,
    notes: '',
  });

  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingApply, setSavingApply] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);         // 大会情報フォーム用
  const [applyError, setApplyError] = useState<string | null>(null); // 申込設定フォーム用
  const [success, setSuccess] = useState<string | null>(null);
  const [adminCopied, setAdminCopied] = useState(false);
  const [viewerCopied, setViewerCopied] = useState(false);
  const [applyCopied, setApplyCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setForm({
      name: tournament.name ?? '',
      venue: tournament.venue ?? '',
      day1_date: tournament.day1_date ? tournament.day1_date.slice(0, 10) : '',
      day2_date: tournament.day2_date ? tournament.day2_date.slice(0, 10) : '',
      event_type: tournament.event_type ?? 'trap',
      day1_set: tournament.day1_set ?? '',
      day2_set: tournament.day2_set ?? '',
      organizer_cd: tournament.organizer_cd ?? 27,
    });
    setApplyForm({
      max_participants: tournament.max_participants != null ? String(tournament.max_participants) : '',
      apply_start_at: isoStrToDate(tournament.apply_start_at),
      apply_end_at: isoStrToDate(tournament.apply_end_at),
      cancel_end_at: isoStrToDate(tournament.cancel_end_at),
      gate_open_time: timeStrToDate(tournament.gate_open_time),
      reception_start_time: timeStrToDate(tournament.reception_start_time),
      practice_clay_time: timeStrToDate(tournament.practice_clay_time),
      competition_start_time: timeStrToDate(tournament.competition_start_time),
      cancellation_notice: tournament.cancellation_notice ?? DEFAULT_CANCELLATION_NOTICE,
      notes: tournament.notes ?? '',
    });
  }, [tournament]);

  // 開門時間変更 → 受付・クレー・競技を自動設定
  function handleGateOpenChange(date: Date | null) {
    if (!date) {
      setApplyForm(f => ({ ...f, gate_open_time: null }));
      return;
    }
    const reception = addMinutes(date, 60);
    const clay = addMinutes(reception, 55);
    const competition = addMinutes(clay, 10);
    setApplyForm(f => ({
      ...f,
      gate_open_time: date,
      reception_start_time: reception,
      practice_clay_time: clay,
      competition_start_time: competition,
    }));
  }

  // 受付時間変更 → クレー・競技を自動設定
  function handleReceptionChange(date: Date | null) {
    if (!date) {
      setApplyForm(f => ({ ...f, reception_start_time: null }));
      return;
    }
    const clay = addMinutes(date, 55);
    const competition = addMinutes(clay, 10);
    setApplyForm(f => ({
      ...f,
      reception_start_time: date,
      practice_clay_time: clay,
      competition_start_time: competition,
    }));
  }

  // クレー時間変更 → 競技を自動設定
  function handleClayChange(date: Date | null) {
    if (!date) {
      setApplyForm(f => ({ ...f, practice_clay_time: null }));
      return;
    }
    const competition = addMinutes(date, 10);
    setApplyForm(f => ({
      ...f,
      practice_clay_time: date,
      competition_start_time: competition,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.name.trim()) {
      setError('大会名を入力してください');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          venue: form.venue.trim() || undefined,
          day1_date: form.day1_date || undefined,
          day2_date: form.day2_date || '',
          event_type: form.event_type,
          day1_set: form.day1_set.trim() || undefined,
          day2_set: form.day2_set.trim() || undefined,
          organizer_cd: form.organizer_cd,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess('大会情報を保存しました');
      onUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveApply(e: React.FormEvent) {
    e.preventDefault();
    setApplyError(null);
    setSuccess(null);

    // 必須チェック（注意書き以外）
    const missing: string[] = [];
    if (!applyForm.max_participants) missing.push('参加人数上限');
    if (!applyForm.apply_start_at) missing.push('募集開始日時');
    if (!applyForm.apply_end_at) missing.push('募集終了日時');
    if (!applyForm.cancel_end_at) missing.push('キャンセル可能日時');
    if (!applyForm.gate_open_time) missing.push('射撃場開門時間');
    if (!applyForm.reception_start_time) missing.push('受付開始時間');
    if (!applyForm.practice_clay_time) missing.push('テストクレー放出時間');
    if (!applyForm.competition_start_time) missing.push('競技開始時間');
    if (!applyForm.cancellation_notice.trim()) missing.push('中止お知らせ方法');
    if (missing.length > 0) {
      setApplyError(`以下の項目は必須です：${missing.join('、')}`);
      return;
    }

    // 日付整合性チェック
    const errors: string[] = [];
    if (applyForm.apply_start_at && form.day1_date) {
      const day1 = new Date(form.day1_date);
      if (applyForm.apply_start_at >= day1) {
        errors.push('募集開始日時は1日目日付より前に設定してください');
      }
    }
    if (applyForm.apply_start_at && applyForm.apply_end_at) {
      if (applyForm.apply_end_at <= applyForm.apply_start_at) {
        errors.push('募集終了日時は募集開始日時より後に設定してください');
      }
    }
    if (applyForm.apply_end_at && applyForm.cancel_end_at) {
      if (applyForm.cancel_end_at < applyForm.apply_end_at) {
        errors.push('キャンセル可能日時は募集終了日時と同じかそれ以降に設定してください');
      }
    }
    if (errors.length > 0) {
      setApplyError(errors.join('\n'));
      return;
    }

    try {
      setSavingApply(true);
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_participants: applyForm.max_participants ? Number(applyForm.max_participants) : null,
          apply_start_at: dateToIsoStr(applyForm.apply_start_at),
          apply_end_at: dateToIsoStr(applyForm.apply_end_at),
          cancel_end_at: dateToIsoStr(applyForm.cancel_end_at),
          gate_open_time: dateToTimeStr(applyForm.gate_open_time),
          reception_start_time: dateToTimeStr(applyForm.reception_start_time),
          practice_clay_time: dateToTimeStr(applyForm.practice_clay_time),
          competition_start_time: dateToTimeStr(applyForm.competition_start_time),
          cancellation_notice: applyForm.cancellation_notice || null,
          notes: applyForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess('申込設定を保存しました');
      onUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSavingApply(false);
    }
  }

  async function handleReset() {
    const pw = window.prompt('確認のため「repros」と入力してください');
    if (pw !== 'repros') {
      if (pw !== null) alert('パスワードが違います');
      return;
    }
    const confirmed = window.confirm('メンバーと点数データを全て削除します。この操作は取り消せません。本当に実行しますか？');
    if (!confirmed) return;
    setError(null);
    setSuccess(null);
    try {
      setResetting(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess('メンバー・点数データをリセットしました');
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リセットに失敗しました');
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('この大会のすべてのデータが削除されますが良いですか？\nこの操作は取り消せません。');
    if (!confirmed) return;
    setError(null);
    try {
      setDeleting(true);
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    padding: '8px 10px',
    fontSize: 16,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    color: C.muted,
    marginBottom: 5,
  };

  const requiredMark = <span style={{ color: C.red }}>*</span>;

  // 日時ピッカー用（カレンダー＋時刻: readOnly でクリック操作）
  const dpDateTimeInput = <input style={{ ...inputStyle, cursor: 'pointer' }} readOnly />;

  // 時刻ピッカー用（手動入力可能: readOnly なし）
  const dpTimeInput = <input style={{ ...inputStyle, cursor: 'pointer' }} />;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 700, margin: '0 auto' }}>
      {/* Error / Success */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 15,
          whiteSpace: 'pre-line',
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 15,
        }}>{success}</div>
      )}

      {/* Tournament Info Form */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>大会情報</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>主催</label>
              <select
                value={form.organizer_cd}
                onChange={e => setForm(f => ({ ...f, organizer_cd: Number(e.target.value) }))}
                style={inputStyle}
              >
                {ORGANIZERS.map(o => (
                  <option key={o.cd} value={o.cd}>{o.name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>大会名 {requiredMark}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>射撃場名</label>
              <input
                type="text"
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>種目</label>
              <select
                value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                style={inputStyle}
              >
                <option value="trap">トラップ</option>
                <option value="skeet">スキート</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>1日目日付</label>
              <DatePicker
                selected={form.day1_date ? new Date(form.day1_date) : null}
                onChange={(date: Date | null) => setForm(f => ({ ...f, day1_date: date ? date.toISOString().slice(0, 10) : '' }))}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                placeholderText="日付を選択"
                customInput={<input style={{ ...inputStyle, cursor: 'pointer' }} readOnly />}
              />
            </div>
            <div>
              <label style={labelStyle}>2日目日付</label>
              <DatePicker
                selected={form.day2_date ? new Date(form.day2_date) : null}
                onChange={(date: Date | null) => setForm(f => ({ ...f, day2_date: date ? date.toISOString().slice(0, 10) : '' }))}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                placeholderText="日付を選択"
                customInput={<input style={{ ...inputStyle, cursor: 'pointer' }} readOnly />}
              />
            </div>
            <div>
              <label style={labelStyle}>1日目セット番号</label>
              <input
                type="text"
                value={form.day1_set}
                onChange={e => setForm(f => ({ ...f, day1_set: e.target.value }))}
                placeholder="例: 1番セット"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>2日目セット番号</label>
              <input
                type="text"
                value={form.day2_set}
                onChange={e => setForm(f => ({ ...f, day2_set: e.target.value }))}
                placeholder="例: 1番セット"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                padding: '9px 24px', fontWeight: 700, fontSize: 16,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </section>

      {/* Apply Settings Section */}
      {applyError && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 15,
          whiteSpace: 'pre-line',
        }}>{applyError}</div>
      )}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: C.gold }}>申込設定</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
          {requiredMark} 注意書き以外はすべて必須です
        </p>
        <form onSubmit={handleSaveApply}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* 参加人数上限 */}
            <div>
              <label style={labelStyle}>参加人数上限 {requiredMark}</label>
              <input
                type="number"
                min={1}
                value={applyForm.max_participants}
                onChange={e => setApplyForm(f => ({ ...f, max_participants: e.target.value }))}
                placeholder="例: 60"
                style={inputStyle}
              />
            </div>
            <div>{/* spacer */}</div>

            {/* 募集開始日時（1時間刻み） */}
            <div>
              <label style={labelStyle}>募集開始日時 {requiredMark}</label>
              <DatePicker
                selected={applyForm.apply_start_at}
                onChange={(date: Date | null) => setApplyForm(f => ({ ...f, apply_start_at: date }))}
                showTimeSelect
                dateFormat="yyyy/MM/dd HH:mm"
                timeFormat="HH:mm"
                timeIntervals={60}
                locale={ja}
                placeholderText="日付・時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpDateTimeInput}
              />
            </div>

            {/* 募集終了日時（1時間刻み） */}
            <div>
              <label style={labelStyle}>募集終了日時 {requiredMark}</label>
              <DatePicker
                selected={applyForm.apply_end_at}
                onChange={(date: Date | null) => setApplyForm(f => ({ ...f, apply_end_at: date }))}
                showTimeSelect
                dateFormat="yyyy/MM/dd HH:mm"
                timeFormat="HH:mm"
                timeIntervals={60}
                locale={ja}
                placeholderText="日付・時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpDateTimeInput}
              />
            </div>

            {/* キャンセル可能日時（1時間刻み） */}
            <div>
              <label style={labelStyle}>キャンセル可能日時 {requiredMark}</label>
              <DatePicker
                selected={applyForm.cancel_end_at}
                onChange={(date: Date | null) => setApplyForm(f => ({ ...f, cancel_end_at: date }))}
                showTimeSelect
                dateFormat="yyyy/MM/dd HH:mm"
                timeFormat="HH:mm"
                timeIntervals={60}
                locale={ja}
                placeholderText="日付・時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpDateTimeInput}
              />
            </div>
            <div>{/* spacer */}</div>

            {/* --- 当日スケジュール --- */}
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: '4px 0 10px', fontSize: 13, color: C.muted }}>
                ※ 射撃場開門時間を選択すると、受付・クレー・競技開始が自動設定されます（後から修正可）
              </p>
            </div>

            {/* 射撃場開門時間 */}
            <div>
              <label style={labelStyle}>射撃場開門時間 {requiredMark}</label>
              <DatePicker
                selected={applyForm.gate_open_time}
                onChange={handleGateOpenChange}
                showTimeSelect
                showTimeSelectOnly
                timeFormat="HH:mm"
                dateFormat="HH:mm"
                timeIntervals={10}
                filterTime={filterScheduleTime}
                placeholderText="時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpTimeInput}
              />
            </div>

            {/* 受付開始時間 */}
            <div>
              <label style={labelStyle}>受付開始時間 {requiredMark}</label>
              <DatePicker
                selected={applyForm.reception_start_time}
                onChange={handleReceptionChange}
                showTimeSelect
                showTimeSelectOnly
                timeFormat="HH:mm"
                dateFormat="HH:mm"
                timeIntervals={10}
                filterTime={filterScheduleTime}
                placeholderText="時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpTimeInput}
              />
            </div>

            {/* テストクレー放出時間 */}
            <div>
              <label style={labelStyle}>テストクレー放出時間 {requiredMark}</label>
              <DatePicker
                selected={applyForm.practice_clay_time}
                onChange={handleClayChange}
                showTimeSelect
                showTimeSelectOnly
                timeFormat="HH:mm"
                dateFormat="HH:mm"
                timeIntervals={10}
                filterTime={filterScheduleTime}
                placeholderText="時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpTimeInput}
              />
            </div>

            {/* 競技開始時間 */}
            <div>
              <label style={labelStyle}>競技開始時間 {requiredMark}</label>
              <DatePicker
                selected={applyForm.competition_start_time}
                onChange={(date: Date | null) => setApplyForm(f => ({ ...f, competition_start_time: date }))}
                showTimeSelect
                showTimeSelectOnly
                timeFormat="HH:mm"
                dateFormat="HH:mm"
                timeIntervals={10}
                filterTime={filterScheduleTime}
                placeholderText="時刻を選択"
                openToDate={MIDNIGHT}
                customInput={dpTimeInput}
              />
            </div>

            {/* 中止お知らせ方法 */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>中止お知らせ方法（400文字以内）{requiredMark}</label>
              <textarea
                value={applyForm.cancellation_notice}
                onChange={e => setApplyForm(f => ({ ...f, cancellation_notice: e.target.value }))}
                maxLength={400}
                rows={4}
                placeholder="大会中止のお知らせ方法を入力してください。"
                style={{ ...inputStyle, resize: 'vertical', height: 'auto' }}
              />
            </div>

            {/* 注意書き（任意） */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>注意書き（400文字以内）</label>
              <textarea
                value={applyForm.notes}
                onChange={e => setApplyForm(f => ({ ...f, notes: e.target.value }))}
                maxLength={400}
                rows={4}
                placeholder="参加者への注意事項などを入力"
                style={{ ...inputStyle, resize: 'vertical', height: 'auto' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="submit"
              disabled={savingApply}
              style={{
                background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                padding: '9px 24px', fontWeight: 700, fontSize: 16,
                cursor: savingApply ? 'not-allowed' : 'pointer', opacity: savingApply ? 0.7 : 1,
              }}
            >
              {savingApply ? '保存中...' : '申込設定を保存'}
            </button>
          </div>
        </form>
      </section>

      {/* QR Code Section */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>QRコード確認</h3>
        {origin ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            {/* Admin QR */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 15, color: C.muted }}>管理者用QR</p>
              <div style={{ background: '#fff', padding: 10, borderRadius: 8 }}>
                <QRCodeSVG value={`${origin}/admin/${tournamentId}`} size={120} />
              </div>
              <a
                href={`${origin}/admin/${tournamentId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ margin: 0, fontSize: 12, color: '#3498db', textAlign: 'center', wordBreak: 'break-all', textDecoration: 'underline' }}
              >
                {origin}/admin/{tournamentId}
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`${origin}/admin/${tournamentId}`); setAdminCopied(true); setTimeout(() => setAdminCopied(false), 2000); }}
                style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                {adminCopied ? 'コピーしました！' : 'URLをコピー'}
              </button>
            </div>
            {/* Viewer QR */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 15, color: C.muted }}>閲覧者用QR</p>
              <div style={{ background: '#fff', padding: 10, borderRadius: 8 }}>
                <QRCodeSVG value={`${origin}/viewer`} size={120} />
              </div>
              <a
                href={`${origin}/viewer`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ margin: 0, fontSize: 12, color: '#3498db', textAlign: 'center', wordBreak: 'break-all', textDecoration: 'underline' }}
              >
                {origin}/viewer
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`${origin}/viewer`); setViewerCopied(true); setTimeout(() => setViewerCopied(false), 2000); }}
                style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                {viewerCopied ? 'コピーしました！' : 'URLをコピー'}
              </button>
            </div>
            {/* Apply QR */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 15, color: C.muted }}>申込用QR</p>
              <div style={{ background: '#fff', padding: 10, borderRadius: 8 }}>
                <QRCodeSVG value={`${origin}/tournaments/${tournamentId}/apply`} size={120} />
              </div>
              <a
                href={`${origin}/tournaments/${tournamentId}/apply`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ margin: 0, fontSize: 12, color: '#3498db', textAlign: 'center', wordBreak: 'break-all', textDecoration: 'underline' }}
              >
                {origin}/tournaments/{tournamentId}/apply
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`${origin}/tournaments/${tournamentId}/apply`); setApplyCopied(true); setTimeout(() => setApplyCopied(false), 2000); }}
                style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                {applyCopied ? 'コピーしました！' : 'URLをコピー'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ color: C.muted, fontSize: 15 }}>読み込み中...</p>
        )}
      </section>

      {/* Danger Zone */}
      <section style={{
        background: `${C.red}11`, border: `1px solid ${C.red}66`, borderRadius: 8, padding: '20px',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, color: C.red }}>危険ゾーン</h3>
        <p style={{ margin: '0 0 16px', fontSize: 15, color: C.muted }}>
          以下の操作は取り消せません。十分注意して実行してください。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: C.text, fontWeight: 600 }}>メンバー・点数をリセット</p>
            <p style={{ margin: 0, fontSize: 14, color: C.muted }}>大会情報・QRコードは保持されます</p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            style={{
              background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
              borderRadius: 5, padding: '8px 18px', fontSize: 16, fontWeight: 600,
              cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1, whiteSpace: 'nowrap',
            }}
          >
            {resetting ? 'リセット中...' : 'リセット実行'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 16, borderTop: `1px solid ${C.red}33` }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: C.text, fontWeight: 600 }}>大会を削除</p>
            <p style={{ margin: 0, fontSize: 14, color: C.muted }}>この大会のすべてのデータ（選手・点数・申込）を削除します</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: C.red, color: '#fff', border: `1px solid ${C.red}`,
              borderRadius: 5, padding: '8px 18px', fontSize: 16, fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, whiteSpace: 'nowrap',
            }}
          >
            {deleting ? '削除中...' : '大会を削除'}
          </button>
        </div>
      </section>
    </div>
  );
}
