'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import type { Tournament, ClassType } from '@/lib/types';
import { AlertModal, ErrorModal } from '@/components/ModalDialog';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

const RULE_OPTIONS = [
  'ISSF（地方公式版）',
  'ISSF（本部同等）',
  'ビギナー・マスター',
];

const CLASS_DIVISION_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'クラス分けなし' },
  { value: 'divided', label: 'クラス分けあり' },
];

const ALL_CLASSES: ClassType[] = ['AAA', 'AA', 'A', 'B', 'C'];

// --- Tailwind class constants (lib/colors.ts と @theme を経由したカラー) ---
const cardClass = 'bg-surface border border-border rounded-[10px] px-5 py-6 mb-4';
const sectionTitleClass = 'text-[15px] font-bold text-gold mb-[14px] pb-1.5 border-b border-border';
const labelClass = 'block text-[13px] text-muted mb-1';
const inputClass = 'w-full px-2.5 py-2 text-[14px] text-text bg-input-bg border border-border rounded-md outline-none box-border';
const selectClass = `${inputClass} cursor-pointer`;
const readOnlyClass = 'w-full px-2.5 py-2 text-[14px] text-muted bg-surface-2 border border-border rounded-md outline-none box-border cursor-default';
const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-y-3 gap-x-4';
const exportBtnClass = 'px-6 py-2.5 text-[14px] font-bold text-text bg-surface-2 border border-gold rounded-lg cursor-pointer';

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
  const [alertModal, setAlertModal] = useState<string | null>(null);

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
        setAlertModal(json?.error ?? 'レポート生成に失敗しました');
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
      setAlertModal('ダウンロードに失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const downloadDisabled = generating || (form.class_division === 'divided' && selectedClasses.length === 0);

  return (
    <div>
      <div className={`p-5${showExcelDialog ? ' pointer-events-none' : ''}`}>
      {/* ルール */}
      <div className={cardClass}>
        <div className={sectionTitleClass}>ルール設定</div>
        <div>
          <label className={labelClass}>ルール</label>
          <select
            className={selectClass}
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
      <div className={cardClass}>
        <div className={sectionTitleClass}>環境情報</div>
        <div className={gridClass}>
          <div>
            <label className={labelClass}>天候</label>
            <input
              className={inputClass}
              value={form.weather}
              placeholder="例: 晴れ"
              onChange={e => handleChange('weather', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>気温</label>
            <input
              className={inputClass}
              value={form.temperature}
              placeholder="例: 18℃"
              onChange={e => handleChange('temperature', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>風速</label>
            <input
              className={inputClass}
              value={form.wind_speed}
              placeholder="例: 3m/s"
              onChange={e => handleChange('wind_speed', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 審査担当者 */}
      <div className={cardClass}>
        <div className={sectionTitleClass}>審査担当者</div>
        <div className={gridClass}>
          <div>
            <label className={labelClass}>審査委員長</label>
            <input
              className={inputClass}
              value={form.chief_judge}
              onChange={e => handleChange('chief_judge', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>大会運営責任者</label>
            <input
              className={inputClass}
              value={form.operation_manager}
              onChange={e => handleChange('operation_manager', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>記録責任者</label>
            <input
              className={inputClass}
              value={form.record_manager}
              onChange={e => handleChange('record_manager', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>セット確認者</label>
            <input
              className={inputClass}
              value={form.set_checker}
              onChange={e => handleChange('set_checker', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 射場設定 */}
      <div className={cardClass}>
        <div className={sectionTitleClass}>射場設定</div>
        <div className={gridClass}>
          <div>
            <label className={labelClass}>使用クレー名</label>
            <input
              className={inputClass}
              value={form.clay_name}
              onChange={e => handleChange('clay_name', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>トラップセットNo.</label>
            <input
              className={readOnlyClass}
              value={`1日目: ${tournament.day1_set ?? '未設定'} / 2日目: ${tournament.day2_set ?? '未設定'}`}
              readOnly
            />
          </div>
          <div>
            <label className={labelClass}>クラス分け</label>
            <select
              className={selectClass}
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
      <ErrorModal message={error} onClose={() => setError(null)} />
      {success && (
        <div className="text-[#2ecc71] text-[14px] mb-3">保存しました</div>
      )}

      {/* ボタン行 */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-8 py-2.5 text-[15px] font-bold text-white border-none rounded-lg ${saving ? 'bg-muted cursor-default opacity-70' : 'bg-gold cursor-pointer opacity-100'}`}
        >
          {saving ? '保存中...' : '保存'}
        </button>

        {/* Excel ダウンロードボタン */}
        <button onClick={openExcelDialog} className={exportBtnClass}>
          大会記録審査表 Excel
        </button>
      </div>
      </div>

      {/* ===== Excel作成ダイアログ ===== */}
      {showExcelDialog && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
          onClick={e => { if (e.target === e.currentTarget) setShowExcelDialog(false); }}
        >
          <div className="bg-surface border border-border rounded-xl px-6 py-7 w-[380px] max-w-[95vw]">
            <h3 className="m-0 mb-5 text-[19px] font-bold text-gold">
              大会記録審査表 Excel
            </h3>

            {/* 作成日 */}
            <div className="mb-4">
              <label className="block text-[15px] text-muted mb-1.5">作成日</label>
              <DatePicker
                selected={excelDate}
                onChange={(date: Date | null) => { if (date) setExcelDate(date); }}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                wrapperClassName=""
                customInput={
                  <input className="w-[180px] px-2.5 py-2 text-[16px] text-text bg-input-bg border border-border rounded-md outline-none box-border cursor-pointer" readOnly />
                }
              />
            </div>

            {/* 注意書き */}
            <p className="m-0 mb-4 text-[14px] leading-[1.6] text-muted">
              ※Excelダウンロード後に点数を修正する場合は、必ず、点数登録を修正してから、再度、ダウンロードしてください。Excel側では、点数の修正は絶対にしないでください。
            </p>

            {/* クラス選択 (クラス分けありの場合のみ) */}
            {form.class_division === 'divided' && availableClasses.length > 0 && (
              <div className="mb-4">
                <label className="block text-[13px] text-muted mb-2">
                  作成するクラスを選択してください。
                </label>
                <div className="flex gap-5 flex-wrap">
                  {availableClasses.map(cls => (
                    <label
                      key={cls}
                      className="flex items-center gap-1.5 cursor-pointer text-[15px] text-text"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls)}
                        onChange={() => toggleClass(cls)}
                        className="w-4 h-4 accent-gold"
                      />
                      {cls}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGenerateExcel}
                disabled={downloadDisabled}
                className={`px-7 py-2.5 text-[17px] font-bold text-black border-none rounded-lg ${generating ? 'bg-muted cursor-default' : 'bg-gold cursor-pointer'} ${downloadDisabled ? 'opacity-50' : 'opacity-100'}`}
              >
                {generating ? 'ダウンロード中...' : 'ダウンロード'}
              </button>
              <button
                onClick={() => setShowExcelDialog(false)}
                className="px-7 py-2.5 text-[17px] font-semibold text-muted bg-transparent border border-border rounded-lg cursor-pointer"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <AlertModal message={alertModal} onClose={() => setAlertModal(null)} />
      )}
    </div>
  );
}
