'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/colors';
import type { Tournament } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

const RULE_OPTIONS = [
  'ISSF（地方公式版）',
  'ISSF（全日本版）',
  'ATA',
  'JCSAルール',
];

const CLASS_DIVISION_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'クラス分けなし' },
  { value: 'divided', label: 'クラス分けあり' },
];

export default function InspectionTab({ tournamentId, tournament, onUpdated }: Props) {
  const [form, setForm] = useState({
    rule_type: 'ISSF（地方公式版）',
    weather: '',
    temperature: '',
    wind_speed: '',
    chief_judge: '',
    operation_manager: '',
    record_manager: '',
    set_checker: '',
    clay_name: '',
    class_division: 'none',
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      rule_type: tournament.rule_type ?? 'ISSF（地方公式版）',
      weather: tournament.weather ?? '',
      temperature: tournament.temperature ?? '',
      wind_speed: tournament.wind_speed ?? '',
      chief_judge: tournament.chief_judge ?? '',
      operation_manager: tournament.operation_manager ?? '',
      record_manager: tournament.record_manager ?? '',
      set_checker: tournament.set_checker ?? '',
      clay_name: tournament.clay_name ?? '',
      class_division: tournament.class_division ?? 'none',
    });
  }, [tournament]);

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, _save_type: 'inspection' }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? '保存に失敗しました');
      } else {
        setSuccess(true);
        onUpdated();
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // --- styles ---
  const cardStyle: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '24px 20px',
    marginBottom: 16,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: C.gold,
    marginBottom: 14,
    paddingBottom: 6,
    borderBottom: `1px solid ${C.border}`,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: C.muted,
    marginBottom: 4,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    color: C.text,
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px 16px',
  };

  const fieldWrapStyle: React.CSSProperties = {
    marginBottom: 0,
  };

  const readOnlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: C.surface2,
    cursor: 'default',
    color: C.muted,
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* ルール */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>ルール設定</div>
        <div style={fieldWrapStyle}>
          <label style={labelStyle}>ルール</label>
          <select
            style={selectStyle}
            value={form.rule_type}
            onChange={e => handleChange('rule_type', e.target.value)}
          >
            {RULE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 環境情報 */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>環境情報</div>
        <div style={gridStyle}>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>天候</label>
            <input
              style={inputStyle}
              value={form.weather}
              placeholder="例: 晴れ"
              onChange={e => handleChange('weather', e.target.value)}
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>気温</label>
            <input
              style={inputStyle}
              value={form.temperature}
              placeholder="例: 18℃"
              onChange={e => handleChange('temperature', e.target.value)}
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>風速</label>
            <input
              style={inputStyle}
              value={form.wind_speed}
              placeholder="例: 3m/s"
              onChange={e => handleChange('wind_speed', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 審査担当者 */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>審査担当者</div>
        <div style={gridStyle}>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>審査委員長</label>
            <input
              style={inputStyle}
              value={form.chief_judge}
              onChange={e => handleChange('chief_judge', e.target.value)}
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>大会運営責任者</label>
            <input
              style={inputStyle}
              value={form.operation_manager}
              onChange={e => handleChange('operation_manager', e.target.value)}
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>記録責任者</label>
            <input
              style={inputStyle}
              value={form.record_manager}
              onChange={e => handleChange('record_manager', e.target.value)}
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>セット確認者</label>
            <input
              style={inputStyle}
              value={form.set_checker}
              onChange={e => handleChange('set_checker', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 射場設定 */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>射場設定</div>
        <div style={gridStyle}>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>使用クレー名</label>
            <input
              style={inputStyle}
              value={form.clay_name}
              onChange={e => handleChange('clay_name', e.target.value)}
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>トラップセットNo.</label>
            <input
              style={readOnlyStyle}
              value={`1日目: ${tournament.day1_set ?? '未設定'} / 2日目: ${tournament.day2_set ?? '未設定'}`}
              readOnly
            />
          </div>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>クラス分け</label>
            <select
              style={selectStyle}
              value={form.class_division}
              onChange={e => handleChange('class_division', e.target.value)}
            >
              {CLASS_DIVISION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* エラー / 成功メッセージ */}
      {error && (
        <div style={{ color: C.red, fontSize: 14, marginBottom: 12 }}>{error}</div>
      )}
      {success && (
        <div style={{ color: '#2ecc71', fontSize: 14, marginBottom: 12 }}>保存しました</div>
      )}

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 32px',
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          background: saving ? C.muted : C.gold,
          border: 'none',
          borderRadius: 8,
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  );
}
