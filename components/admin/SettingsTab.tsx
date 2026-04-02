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

  const [applyForm, setApplyForm] = useState({
    max_participants: '',
    apply_start_at: '',
    apply_end_at: '',
    cancel_end_at: '',
    competition_start_time: '',
    gate_open_time: '',
    reception_start_time: '',
    practice_clay_time: '',
    cancellation_notice: '',
    notes: '',
  });

  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingApply, setSavingApply] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      apply_start_at: tournament.apply_start_at ? tournament.apply_start_at.slice(0, 16) : '',
      apply_end_at: tournament.apply_end_at ? tournament.apply_end_at.slice(0, 16) : '',
      cancel_end_at: tournament.cancel_end_at ? tournament.cancel_end_at.slice(0, 16) : '',
      competition_start_time: tournament.competition_start_time ?? '',
      gate_open_time: tournament.gate_open_time ?? '',
      reception_start_time: tournament.reception_start_time ?? '',
      practice_clay_time: tournament.practice_clay_time ?? '',
      cancellation_notice: tournament.cancellation_notice ?? '',
      notes: tournament.notes ?? '',
    });
  }, [tournament]);

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
    setError(null);
    setSuccess(null);
    try {
      setSavingApply(true);
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_participants: applyForm.max_participants ? Number(applyForm.max_participants) : null,
          apply_start_at: applyForm.apply_start_at || null,
          apply_end_at: applyForm.apply_end_at || null,
          cancel_end_at: applyForm.cancel_end_at || null,
          competition_start_time: applyForm.competition_start_time || null,
          gate_open_time: applyForm.gate_open_time || null,
          reception_start_time: applyForm.reception_start_time || null,
          practice_clay_time: applyForm.practice_clay_time || null,
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
      setError(e instanceof Error ? e.message : '保存に失敗しました');
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

  return (
    <div style={{ padding: '20px 16px', maxWidth: 700, margin: '0 auto' }}>
      {/* Error / Success */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 15,
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
              <label style={labelStyle}>大会名 <span style={{ color: C.red }}>*</span></label>
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
                customInput={<input style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box' as const }} />}
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
                customInput={<input style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box' as const }} />}
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
                background: C.gold,
                color: '#000',
                border: 'none',
                borderRadius: 5,
                padding: '9px 24px',
                fontWeight: 700,
                fontSize: 16,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </section>

      {/* Apply Settings Section */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>申込設定</h3>
        <form onSubmit={handleSaveApply}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>参加人数上限</label>
              <input
                type="number"
                min={1}
                value={applyForm.max_participants}
                onChange={e => setApplyForm(f => ({ ...f, max_participants: e.target.value }))}
                placeholder="例: 60"
                style={inputStyle}
              />
            </div>
            <div>
              {/* spacer */}
            </div>
            <div>
              <label style={labelStyle}>募集開始日時</label>
              <input
                type="datetime-local"
                value={applyForm.apply_start_at}
                onChange={e => setApplyForm(f => ({ ...f, apply_start_at: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>募集終了日時</label>
              <input
                type="datetime-local"
                value={applyForm.apply_end_at}
                onChange={e => setApplyForm(f => ({ ...f, apply_end_at: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>キャンセル可能日時</label>
              <input
                type="datetime-local"
                value={applyForm.cancel_end_at}
                onChange={e => setApplyForm(f => ({ ...f, cancel_end_at: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              {/* spacer */}
            </div>
            <div>
              <label style={labelStyle}>射撃場開門時間</label>
              <input
                type="time"
                value={applyForm.gate_open_time}
                onChange={e => setApplyForm(f => ({ ...f, gate_open_time: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>受付開始時間</label>
              <input
                type="time"
                value={applyForm.reception_start_time}
                onChange={e => setApplyForm(f => ({ ...f, reception_start_time: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>テストクレー放出時間</label>
              <input
                type="time"
                value={applyForm.practice_clay_time}
                onChange={e => setApplyForm(f => ({ ...f, practice_clay_time: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>競技開始時間</label>
              <input
                type="time"
                value={applyForm.competition_start_time}
                onChange={e => setApplyForm(f => ({ ...f, competition_start_time: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>中止お知らせ方法（400文字以内）</label>
              <textarea
                value={applyForm.cancellation_notice}
                onChange={e => setApplyForm(f => ({ ...f, cancellation_notice: e.target.value }))}
                maxLength={400}
                rows={4}
                placeholder="大会中止・中断時のお知らせ方法を入力"
                style={{ ...inputStyle, resize: 'vertical', height: 'auto' }}
              />
            </div>
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
              <p style={{ margin: 0, fontSize: 12, color: C.muted, textAlign: 'center', wordBreak: 'break-all' }}>
                {origin}/admin/{tournamentId}
              </p>
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
              <p style={{ margin: 0, fontSize: 12, color: C.muted, textAlign: 'center', wordBreak: 'break-all' }}>
                {origin}/viewer
              </p>
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
              <p style={{ margin: 0, fontSize: 12, color: C.muted, textAlign: 'center', wordBreak: 'break-all' }}>
                {origin}/tournaments/{tournamentId}/apply
              </p>
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
        background: `${C.red}11`,
        border: `1px solid ${C.red}66`,
        borderRadius: 8,
        padding: '20px',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, color: C.red }}>危険ゾーン</h3>
        <p style={{ margin: '0 0 16px', fontSize: 15, color: C.muted }}>
          以下の操作は取り消せません。十分注意して実行してください。
        </p>

        {/* Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: C.text, fontWeight: 600 }}>
              メンバー・点数をリセット
            </p>
            <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
              大会情報・QRコードは保持されます
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            style={{
              background: 'transparent', color: C.red, border: `1px solid ${C.red}`,
              borderRadius: 5, padding: '8px 18px', fontSize: 16, fontWeight: 600,
              cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {resetting ? 'リセット中...' : 'リセット実行'}
          </button>
        </div>

        {/* Delete tournament */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 16, borderTop: `1px solid ${C.red}33` }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: C.text, fontWeight: 600 }}>
              大会を削除
            </p>
            <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
              この大会のすべてのデータ（選手・点数・申込）を削除します
            </p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: C.red, color: '#fff', border: `1px solid ${C.red}`,
              borderRadius: 5, padding: '8px 18px', fontSize: 16, fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {deleting ? '削除中...' : '大会を削除'}
          </button>
        </div>
      </section>
    </div>
  );
}
