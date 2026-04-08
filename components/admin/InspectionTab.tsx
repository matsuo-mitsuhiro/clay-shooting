'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import { C } from '@/lib/colors';
import type { Tournament, ClassType } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

const RULE_OPTIONS = [
  'ISSF（地方公式版）',
  'ビギナー・マスター',
];

const CLASS_DIVISION_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'クラス分けなし' },
  { value: 'divided', label: 'クラス分けあり' },
];

const ALL_CLASSES: ClassType[] = ['AA', 'A', 'B', 'C'];

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

  // Excel ダイアログ
  const [showExcelDialog, setShowExcelDialog] = useState(false);
  const [excelDate, setExcelDate] = useState<Date>(new Date());
  const [availableClasses, setAvailableClasses] = useState<ClassType[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<ClassType[]>([]);
  const [generating, setGenerating] = useState(false);

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

  // Excel ダイアログを開く
  const openExcelDialog = async () => {
    setExcelDate(new Date());
    setGenerating(false);

    // クラス分けありの場合、選手に登録されているクラスを取得
    if (form.class_division === 'divided') {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/results`);
        const json = await res.json();
        if (json.success && json.data?.results) {
          const classes = new Set<ClassType>();
          for (const r of json.data.results) {
            if (r.class && ALL_CLASSES.includes(r.class)) {
              classes.add(r.class as ClassType);
            }
          }
          // ALL_CLASSES の順序で並べる
          const sorted = ALL_CLASSES.filter(c => classes.has(c));
          setAvailableClasses(sorted);
          setSelectedClasses([...sorted]); // デフォルト全チェック
        }
      } catch {
        setAvailableClasses([]);
        setSelectedClasses([]);
      }
    } else {
      setAvailableClasses([]);
      setSelectedClasses([]);
    }

    setShowExcelDialog(true);
  };

  const toggleClass = (cls: ClassType) => {
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const handleGenerateExcel = async () => {
    setGenerating(true);
    try {
      const dateStr = excelDate.toISOString().slice(0, 10);
      const params = new URLSearchParams({ date: dateStr });
      if (form.class_division === 'divided' && selectedClasses.length > 0) {
        // ALL_CLASSES の順序でソート
        const sorted = ALL_CLASSES.filter(c => selectedClasses.includes(c));
        params.set('classes', sorted.join(','));
      }

      const res = await fetch(`/api/tournaments/${tournamentId}/inspection-report?${params}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        alert(json?.error ?? 'レポート生成に失敗しました');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Content-Disposition からファイル名を取得
      const disposition = res.headers.get('Content-Disposition');
      let fileName = '記録審査表.xlsx';
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)/);
        if (match) fileName = decodeURIComponent(match[1]);
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExcelDialog(false);
    } catch {
      alert('ダウンロードに失敗しました');
    } finally {
      setGenerating(false);
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

  const exportBtnStyle: React.CSSProperties = {
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    background: C.surface2,
    border: `1px solid ${C.gold}`,
    borderRadius: 8,
    cursor: 'pointer',
  };

  return (
    <div>
      <div style={{ padding: '20px', pointerEvents: showExcelDialog ? 'none' as const : 'auto' as const }}>
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

      {/* ボタン行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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

        {/* Excel ダウンロードボタン */}
        <button onClick={openExcelDialog} style={exportBtnStyle}>
          大会記録審査表 Excel
        </button>
      </div>
      </div>

      {/* ===== Excel作成ダイアログ ===== */}
      {showExcelDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowExcelDialog(false); }}
        >
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '28px 24px',
            width: 380,
            maxWidth: '95vw',
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 19, fontWeight: 700, color: C.gold }}>
              大会記録審査表 Excel
            </h3>

            {/* 作成日 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, fontSize: 15, marginBottom: 6 }}>作成日</label>
              <DatePicker
                selected={excelDate}
                onChange={(date: Date | null) => { if (date) setExcelDate(date); }}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                wrapperClassName=""
                customInput={
                  <input style={{ ...inputStyle, fontSize: 16, width: 180, cursor: 'pointer' }} readOnly />
                }
              />
            </div>

            {/* 注意書き */}
            <p style={{
              margin: '0 0 16px',
              fontSize: 14,
              lineHeight: 1.6,
              color: C.muted,
            }}>
              ※Excelダウンロード後に点数を修正する場合は、必ず、点数登録を修正してから、再度、ダウンロードしてください。Excel側では、点数の修正は絶対にしないでください。
            </p>

            {/* クラス選択 (クラス分けありの場合のみ) */}
            {form.class_division === 'divided' && availableClasses.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>
                  作成するクラスを選択してください。
                </label>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {availableClasses.map(cls => (
                    <label
                      key={cls}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        fontSize: 15,
                        color: C.text,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls)}
                        onChange={() => toggleClass(cls)}
                        style={{ width: 16, height: 16, accentColor: C.gold }}
                      />
                      {cls}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ボタン */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleGenerateExcel}
                disabled={generating || (form.class_division === 'divided' && selectedClasses.length === 0)}
                style={{
                  padding: '10px 28px',
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#000',
                  background: generating ? C.muted : C.gold,
                  border: 'none',
                  borderRadius: 8,
                  cursor: generating ? 'default' : 'pointer',
                  opacity: (generating || (form.class_division === 'divided' && selectedClasses.length === 0)) ? 0.5 : 1,
                }}
              >
                {generating ? 'ダウンロード中...' : 'ダウンロード'}
              </button>
              <button
                onClick={() => setShowExcelDialog(false)}
                style={{
                  padding: '10px 28px',
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.muted,
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
