'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/colors';
import type { Tournament, EventType } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

export default function SettingsTab({ tournamentId, tournament, onUpdated }: Props) {
  const [form, setForm] = useState({
    name: '',
    venue: '',
    day1_date: '',
    day2_date: '',
    event_type: 'trap' as EventType,
    day1_set: '',
    day2_set: '',
  });
  const [adminQrPreview, setAdminQrPreview] = useState<string | null>(null);
  const [viewerQrPreview, setViewerQrPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingQr, setSavingQr] = useState<'admin' | 'viewer' | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: tournament.name ?? '',
      venue: tournament.venue ?? '',
      day1_date: tournament.day1_date ?? '',
      day2_date: tournament.day2_date ?? '',
      event_type: tournament.event_type ?? 'trap',
      day1_set: tournament.day1_set ?? '',
      day2_set: tournament.day2_set ?? '',
    });
    setAdminQrPreview(tournament.admin_qr ?? null);
    setViewerQrPreview(tournament.viewer_qr ?? null);
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

  function handleFileChange(type: 'admin' | 'viewer', file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target?.result as string;
      if (type === 'admin') setAdminQrPreview(base64);
      else setViewerQrPreview(base64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveQr(type: 'admin' | 'viewer') {
    const qrData = type === 'admin' ? adminQrPreview : viewerQrPreview;
    if (!qrData) {
      setError('QR画像を選択してください');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      setSavingQr(type);
      const body = type === 'admin' ? { admin_qr: qrData } : { viewer_qr: qrData };
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess(`${type === 'admin' ? '管理者' : '閲覧者'}用QRコードを保存しました`);
      onUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'QRコードの保存に失敗しました');
    } finally {
      setSavingQr(null);
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    color: C.text,
    padding: '8px 10px',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: C.muted,
    marginBottom: 5,
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: 700, margin: '0 auto' }}>
      {/* Error / Success */}
      {error && (
        <div style={{
          background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
          borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13,
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          background: `${C.green}22`, border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13,
        }}>{success}</div>
      )}

      {/* Tournament Info Form */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.gold }}>大会情報</h3>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
              <input
                type="date"
                value={form.day1_date}
                onChange={e => setForm(f => ({ ...f, day1_date: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>2日目日付</label>
              <input
                type="date"
                value={form.day2_date}
                onChange={e => setForm(f => ({ ...f, day2_date: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>1日目セット番号</label>
              <input
                type="text"
                value={form.day1_set}
                onChange={e => setForm(f => ({ ...f, day1_set: e.target.value }))}
                placeholder="例: 第1回"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>2日目セット番号</label>
              <input
                type="text"
                value={form.day2_set}
                onChange={e => setForm(f => ({ ...f, day2_set: e.target.value }))}
                placeholder="例: 第2回"
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
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </section>

      {/* QR Code Section */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: C.gold }}>QRコード登録</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Admin QR */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: C.muted }}>管理者用QR</p>
            {adminQrPreview && (
              <div style={{ marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={adminQrPreview}
                  alt="管理者用QR"
                  style={{ width: 120, height: 120, border: `1px solid ${C.border}`, borderRadius: 6 }}
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => handleFileChange('admin', e.target.files?.[0] ?? null)}
              style={{ fontSize: 13, color: C.text, marginBottom: 8, width: '100%' }}
            />
            <button
              onClick={() => handleSaveQr('admin')}
              disabled={savingQr === 'admin' || !adminQrPreview}
              style={{
                background: C.surface2,
                color: C.gold,
                border: `1px solid ${C.gold}`,
                borderRadius: 5,
                padding: '6px 14px',
                fontSize: 13,
                cursor: (savingQr === 'admin' || !adminQrPreview) ? 'not-allowed' : 'pointer',
                opacity: (savingQr === 'admin' || !adminQrPreview) ? 0.6 : 1,
              }}
            >
              {savingQr === 'admin' ? '保存中...' : 'QRを保存'}
            </button>
          </div>
          {/* Viewer QR */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: C.muted }}>閲覧者用QR</p>
            {viewerQrPreview && (
              <div style={{ marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewerQrPreview}
                  alt="閲覧者用QR"
                  style={{ width: 120, height: 120, border: `1px solid ${C.border}`, borderRadius: 6 }}
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => handleFileChange('viewer', e.target.files?.[0] ?? null)}
              style={{ fontSize: 13, color: C.text, marginBottom: 8, width: '100%' }}
            />
            <button
              onClick={() => handleSaveQr('viewer')}
              disabled={savingQr === 'viewer' || !viewerQrPreview}
              style={{
                background: C.surface2,
                color: C.gold,
                border: `1px solid ${C.gold}`,
                borderRadius: 5,
                padding: '6px 14px',
                fontSize: 13,
                cursor: (savingQr === 'viewer' || !viewerQrPreview) ? 'not-allowed' : 'pointer',
                opacity: (savingQr === 'viewer' || !viewerQrPreview) ? 0.6 : 1,
              }}
            >
              {savingQr === 'viewer' ? '保存中...' : 'QRを保存'}
            </button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section style={{
        background: `${C.red}11`,
        border: `1px solid ${C.red}66`,
        borderRadius: 8,
        padding: '20px',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, color: C.red }}>危険ゾーン</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
          以下の操作は取り消せません。十分注意して実行してください。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: C.text, fontWeight: 600 }}>
              メンバー・点数をリセット
            </p>
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
              大会情報・QRコードは保持されます
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            style={{
              background: 'transparent',
              color: C.red,
              border: `1px solid ${C.red}`,
              borderRadius: 5,
              padding: '8px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: resetting ? 'not-allowed' : 'pointer',
              opacity: resetting ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {resetting ? 'リセット中...' : 'リセット実行'}
          </button>
        </div>
      </section>
    </div>
  );
}
