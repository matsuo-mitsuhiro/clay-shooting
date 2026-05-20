'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import { ErrorModal } from '@/components/ModalDialog';
import type { Tournament, Association } from '@/lib/types';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

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

// 保存日時フォーマット: YYYY/MM/DD HH:mm
function formatSavedAt(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${dd} ${h}:${mi}`;
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

// --- Tailwind class constants (lib/colors.ts と @theme を経由したカラー) ---
const inputClass = 'w-full bg-input-bg border border-border rounded-[5px] text-text px-2.5 py-2 text-[16px] box-border';
const labelClass = 'block text-[14px] text-muted mb-[5px]';
const dpInputClass = `${inputClass} cursor-pointer`;
const sectionClass = 'bg-surface border border-border rounded-lg p-5 mb-5';

export default function ApplySettingsTab({ tournamentId, tournament, onUpdated }: Props) {
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

  const [savingApply, setSavingApply] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 射順発表
  const [squadComment, setSquadComment] = useState('');
  const [squadPublishedAt, setSquadPublishedAt] = useState<string | null>(null);
  const [previousComment, setPreviousComment] = useState<string | null>(null);
  const [squadSaving, setSquadSaving] = useState(false);
  const [squadUrlCopied, setSquadUrlCopied] = useState(false);

  // 射順ページURLをクリップボードにコピー（一時的に「✓ コピー済」表示）
  async function handleCopySquadUrl() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/tournaments/${tournamentId}/apply#squad`;
    try {
      await navigator.clipboard.writeText(url);
      setSquadUrlCopied(true);
      setTimeout(() => setSquadUrlCopied(false), 2000);
    } catch {
      setApplyError('クリップボードへのコピーに失敗しました');
    }
  }

  useEffect(() => {
    // 協会マスターから cancellation_notice / notes のデフォルト値を取得
    const orgCd = tournament.organizer_cd;
    if (orgCd) {
      fetch(`/api/associations/${orgCd}`)
        .then(r => r.json())
        .then(j => {
          if (j.success) {
            const assoc = j.data as Association;
            setApplyForm({
              max_participants: tournament.max_participants != null ? String(tournament.max_participants) : '',
              apply_start_at: isoStrToDate(tournament.apply_start_at),
              apply_end_at: isoStrToDate(tournament.apply_end_at),
              cancel_end_at: isoStrToDate(tournament.cancel_end_at),
              gate_open_time: timeStrToDate(tournament.gate_open_time),
              reception_start_time: timeStrToDate(tournament.reception_start_time),
              practice_clay_time: timeStrToDate(tournament.practice_clay_time),
              competition_start_time: timeStrToDate(tournament.competition_start_time),
              cancellation_notice: tournament.cancellation_notice ?? assoc.cancellation_notice ?? DEFAULT_CANCELLATION_NOTICE,
              notes: tournament.notes ?? assoc.notes ?? '',
            });
          } else {
            setApplyFormDefault();
          }
        })
        .catch(() => setApplyFormDefault());
    } else {
      setApplyFormDefault();
    }
  }, [tournament]); // eslint-disable-line react-hooks/exhaustive-deps

  // 射順発表データ取得
  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/squad`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const d = j.data;
          setSquadPublishedAt(d.squad_published_at ?? null);
          setPreviousComment(d.previous_comment ?? null);
          const defaultComment = 'Aクラスの人数が6名未満につき、本公式はクラス分けなしとして順位を決定致します';
          setSquadComment(d.squad_comment ?? d.previous_comment ?? defaultComment);
        }
      })
      .catch(() => {});
  }, [tournamentId]);

  async function handleSquadPublish(action: 'publish' | 'unpublish') {
    setApplyError(null);
    setSuccess(null);
    setSquadSaving(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/squad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: squadComment }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSquadPublishedAt(action === 'publish' ? new Date().toISOString() : null);
      setSuccess(action === 'publish' ? '射順発表を公開しました' : '射順発表を非公開にしました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSquadSaving(false);
    }
  }

  function setApplyFormDefault() {
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
  }

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

  async function handleSaveApply(e: React.FormEvent) {
    e.preventDefault();
    setApplyError(null);
    setSuccess(null);

    // 必須チェック（注意書き以外）
    const missing: string[] = [];
    if (!applyForm.max_participants) missing.push('募集人数');
    if (!applyForm.apply_start_at) missing.push('募集開始日時');
    if (!applyForm.apply_end_at) missing.push('募集終了日時');
    if (!applyForm.cancel_end_at) missing.push('キャンセル可能日時');
    if (!applyForm.gate_open_time) missing.push('射撃場開門時間');
    if (!applyForm.reception_start_time) missing.push('受付開始時間');
    if (!applyForm.practice_clay_time) missing.push('テストクレー放出時間');
    if (!applyForm.competition_start_time) missing.push('競技開始時間');
    if (!applyForm.cancellation_notice.trim()) missing.push('中止のお知らせ方法');
    if (missing.length > 0) {
      setApplyError(`以下の項目は必須です：${missing.join('、')}`);
      return;
    }

    // 日付整合性チェック
    const errors: string[] = [];
    if (applyForm.apply_start_at && tournament.day1_date) {
      const day1 = new Date(tournament.day1_date);
      if (applyForm.apply_start_at >= day1) {
        errors.push('募集開始日時は1日目より前に設定してください');
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
          _save_type: 'apply',
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

  const requiredMark = <span className="text-red">*</span>;

  // 日時ピッカー用（カレンダー＋時刻: readOnly でクリック操作）
  const dpDateTimeInput = <input className={dpInputClass} readOnly />;

  // 時刻ピッカー用（手動入力可能: readOnly なし）
  const dpTimeInput = <input className={dpInputClass} />;

  return (
    <div className="px-4 py-5 max-w-[700px] mx-auto">
      {/* Error Modal */}
      {applyError && (
        <ErrorModal message={applyError} onClose={() => setApplyError(null)} />
      )}
      {success && (
        <div className="bg-[#27ae6022] border border-green text-green rounded-md px-3 py-2 mb-4 text-[15px]">{success}</div>
      )}

      {/* Apply Settings Section */}
      <section className={sectionClass}>
        <h3 className="m-0 mb-1 text-[17px] text-gold">申込設定</h3>
        <p className="m-0 mb-4 text-[13px] text-muted">
          {requiredMark} 注意書き以外はすべて必須です
        </p>
        <form onSubmit={handleSaveApply}>
          <div className="grid grid-cols-2 gap-[14px]">

            {/* 募集人数 */}
            <div>
              <label className={labelClass}>募集人数 {requiredMark}</label>
              <input
                type="number"
                min={1}
                value={applyForm.max_participants}
                onChange={e => setApplyForm(f => ({ ...f, max_participants: e.target.value }))}
                placeholder="例: 60"
                className={inputClass}
              />
            </div>
            <div>{/* spacer */}</div>

            {/* 募集開始日時（1時間刻み） */}
            <div>
              <label className={labelClass}>募集開始日時 {requiredMark}</label>
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
              <label className={labelClass}>募集終了日時 {requiredMark}</label>
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
              <label className={labelClass}>キャンセル可能日時 {requiredMark}</label>
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
            <div className="col-span-2">
              <p className="mt-1 mb-2.5 mx-0 text-[13px] text-muted">
                ※ 射撃場開門時間を選択すると、受付・クレー・競技開始が自動設定されます（後から修正可）
              </p>
            </div>

            {/* 射撃場開門時間 */}
            <div>
              <label className={labelClass}>射撃場開門時間 {requiredMark}</label>
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
              <label className={labelClass}>受付開始時間 {requiredMark}</label>
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
              <label className={labelClass}>テストクレー放出時間 {requiredMark}</label>
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
              <label className={labelClass}>競技開始時間 {requiredMark}</label>
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

            {/* 中止のお知らせ方法 */}
            <div className="col-span-2">
              <label className={labelClass}>中止のお知らせ方法（400文字以内）{requiredMark}</label>
              <textarea
                value={applyForm.cancellation_notice}
                onChange={e => setApplyForm(f => ({ ...f, cancellation_notice: e.target.value }))}
                maxLength={400}
                rows={4}
                placeholder="大会中止のお知らせ方法を入力してください。"
                className={`${inputClass} resize-y h-auto`}
              />
            </div>

            {/* 注意書き（任意） */}
            <div className="col-span-2">
              <label className={labelClass}>注意書き（400文字以内）</label>
              <textarea
                value={applyForm.notes}
                onChange={e => setApplyForm(f => ({ ...f, notes: e.target.value }))}
                maxLength={400}
                rows={4}
                placeholder="参加者への注意事項などを入力"
                className={`${inputClass} resize-y h-auto`}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={savingApply}
              className={`bg-gold text-black border-none rounded-[5px] px-6 py-[9px] font-bold text-[16px] ${savingApply ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
            >
              {savingApply ? '保存中...' : '申込設定を保存'}
            </button>
            {tournament.apply_saved_by && tournament.apply_saved_at && (
              <span className="text-[13px] text-muted">
                最終保存: {tournament.apply_saved_by} {formatSavedAt(tournament.apply_saved_at)}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* 射順発表 */}
      <section className={sectionClass}>
        <h3 className="m-0 mb-3 text-[17px] text-gold">射順発表</h3>
        <div className="mb-[14px]">
          <span className={`${squadPublishedAt ? 'bg-[#27ae6022] text-green border-green' : 'bg-surface-2 text-muted border-border'} border rounded px-3 py-[3px] text-[13px] font-bold`}>
            {squadPublishedAt ? `公開中（${formatSavedAt(squadPublishedAt)}）` : '非公開'}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label className="text-[14px] text-muted">コメント（組一覧の前に表示されます）</label>
            {previousComment && previousComment !== squadComment && (
              <button
                type="button"
                onClick={() => setSquadComment(previousComment)}
                className="bg-transparent text-gold border border-gold rounded px-2.5 py-0.5 text-[12px] cursor-pointer"
              >
                前回のコメントを使用
              </button>
            )}
          </div>
          <textarea
            value={squadComment}
            onChange={e => setSquadComment(e.target.value)}
            rows={3}
            className="w-full bg-[#1a1a2e] border border-border rounded-[5px] text-text px-2.5 py-2 text-[15px] box-border resize-y font-[inherit]"
            placeholder="コメントを入力（空欄でも可）"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => handleSquadPublish('publish')}
            disabled={squadSaving}
            className={`bg-green text-black border-none rounded-[5px] px-6 py-[9px] font-bold text-[15px] ${squadSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
          >
            {squadSaving ? '処理中...' : squadPublishedAt ? '再公開（更新）' : '公開する'}
          </button>
          {squadPublishedAt && (
            <button
              type="button"
              onClick={() => handleSquadPublish('unpublish')}
              disabled={squadSaving}
              className={`bg-transparent text-muted border border-border rounded-[5px] px-6 py-[9px] text-[15px] ${squadSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
            >
              非公開にする
            </button>
          )}
          {/* 射順ページURLコピー（公開中のみボタン、非公開時は「準備中」テキスト） */}
          {squadPublishedAt ? (
            <button
              type="button"
              onClick={handleCopySquadUrl}
              className={`${squadUrlCopied ? 'bg-[#27ae6033] text-green border-green' : 'bg-transparent text-gold border-gold'} border rounded-[5px] px-6 py-[9px] text-[15px] cursor-pointer font-semibold`}
            >
              {squadUrlCopied ? '✓ コピー済' : '🔗 射順URLをコピー'}
            </button>
          ) : (
            <span className="self-center text-muted text-[14px] italic">
              射順URL: 準備中
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
