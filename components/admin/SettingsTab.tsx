'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import type { Tournament, EventType, Association, ShootingRange } from '@/lib/types';
import { ConfirmModal, AlertModal, PromptModal, ErrorModal } from '@/components/ModalDialog';

interface Props {
  tournamentId: number;
  tournament: Tournament;
  onUpdated: () => void;
}

function validateDates(day1: string, day2: string): 'ok' | 'error' | 'warn' {
  if (!day1 || !day2) return 'ok';
  const d1 = new Date(day1);
  const d2 = new Date(day2);
  if (d2 <= d1) return 'error';
  const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays !== 1) return 'warn';
  return 'ok';
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

const inputClass = 'w-full bg-input-bg border border-border rounded-[5px] text-text px-[10px] py-[8px] text-[16px] box-border';
const labelClass = 'block text-[14px] text-muted mb-[5px]';
const sectionClass = 'bg-surface border border-border rounded-[8px] p-5 mb-5';
const sectionHeadingClass = 'mt-0 mb-4 text-[17px] text-gold';

export default function SettingsTab({ tournamentId, tournament, onUpdated }: Props) {
  const router = useRouter();
  const { data: session } = useSession();

  const [associations, setAssociations] = useState<Association[]>([]);
  const [allRanges, setAllRanges] = useState<ShootingRange[]>([]);
  const [assocRangeIds, setAssocRangeIds] = useState<number[]>([]);

  const [form, setForm] = useState({
    name: '',
    venue: '',
    day1_date: '',
    day2_date: '',
    event_type: 'trap' as EventType,
    day1_set: '',
    day2_set: '',
    organizer_cd: 0,
  });

  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);
  const [qrTab, setQrTab] = useState<'viewer' | 'admin' | 'apply' | 'invite'>('viewer');

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{ message: string; onOk: () => void; okLabel?: string; okColor?: string } | null>(null);
  const [alertModal, setAlertModal] = useState<string | null>(null);
  const [promptModal, setPromptModal] = useState<{ message: string; onOk: (v: string) => void; placeholder?: string } | null>(null);

  // 招待QRコード
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);


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
      organizer_cd: tournament.organizer_cd ?? 0,
    });

    // 主催に応じた射撃場リスト取得
    const orgCd = tournament.organizer_cd;
    if (orgCd) {
      fetch(`/api/associations/${orgCd}`)
        .then(r => r.json())
        .then(j => {
          if (j.success) {
            const assoc = j.data as Association & { shooting_range_ids: number[] };
            setAssocRangeIds(assoc.shooting_range_ids ?? []);
          }
        })
        .catch(() => {});
    }
  }, [tournament]);


  // 協会一覧と射撃場一覧を取得
  useEffect(() => {
    Promise.all([
      fetch('/api/associations').then(r => r.json()),
      fetch('/api/shooting-ranges').then(r => r.json()),
    ]).then(([assocJson, rangesJson]) => {
      if (assocJson.success) setAssociations(assocJson.data as Association[]);
      if (rangesJson.success) setAllRanges(rangesJson.data as ShootingRange[]);
    }).catch(() => {});
  }, []);

  // 主催変更時に射撃場リストを更新
  async function handleOrganizerChange(cd: number) {
    setForm(f => ({ ...f, organizer_cd: cd, venue: '' }));
    try {
      const res = await fetch(`/api/associations/${cd}`);
      const json = await res.json();
      if (json.success) setAssocRangeIds((json.data.shooting_range_ids as number[]) ?? []);
      else setAssocRangeIds([]);
    } catch { setAssocRangeIds([]); }
  }

  // 選択中主催の射撃場を表示
  const venueOptions: ShootingRange[] = assocRangeIds.length > 0
    ? allRanges.filter(r => assocRangeIds.includes(r.id))
    : allRanges;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.name.trim()) {
      setError('大会名を入力してください');
      return;
    }
    const dateStatus = validateDates(form.day1_date, form.day2_date);
    if (dateStatus === 'error') {
      setError('2日目の日付は1日目より後にしか設定できません。');
      return;
    }
    if (dateStatus === 'warn') {
      setConfirmModal({
        message: '1日目と2日目が連続していません。間違えていませんか？',
        okLabel: 'このまま保存',
        onOk: () => { setConfirmModal(null); executeSave(); },
      });
      return;
    }
    executeSave();
  }

  async function executeSave() {
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
          _save_type: 'info',
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

  function handleReset() {
    setPromptModal({
      message: '確認のため「repros」と入力してください',
      placeholder: 'repros',
      onOk: (pw) => {
        setPromptModal(null);
        if (pw !== 'repros') {
          setAlertModal('パスワードが違います');
          return;
        }
        setConfirmModal({
          message: 'メンバー・点数・申込データを全て削除します。この操作は取り消せません。本当に実行しますか？',
          okLabel: 'リセット', okColor: '#ff4d4d',
          onOk: async () => {
            setConfirmModal(null);
            setError(null);
            setSuccess(null);
            try {
              setResetting(true);
              const res = await fetch(`/api/tournaments/${tournamentId}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saved_by: session?.user?.name ?? session?.user?.email ?? '' }),
              });
              const json = await res.json();
              if (!json.success) throw new Error(json.error);
              setSuccess('メンバー・点数・申込データをリセットしました');
              onUpdated();
              setTimeout(() => setSuccess(null), 5000);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'リセットに失敗しました');
            } finally {
              setResetting(false);
            }
          },
        });
      },
    });
  }

  function handleDelete() {
    setConfirmModal({
      message: 'この大会のすべてのデータが削除されますが良いですか？\nこの操作は取り消せません。',
      okLabel: '削除', okColor: '#ff4d4d',
      onOk: async () => {
        setConfirmModal(null);
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
      },
    });
  }


  async function handleIssueInvite() {
    setInviteLoading(true);
    setInviteToken(null);
    try {
      const res = await fetch('/api/admin/invitations', { method: 'POST' });
      const json = await res.json();
      if (json.success) setInviteToken(json.token);
    } finally {
      setInviteLoading(false);
    }
  }

  function getInviteUrl(token: string) {
    return `${origin}/admin/register?token=${token}`;
  }

  async function handleCopyInviteUrl(token: string) {
    await navigator.clipboard.writeText(getInviteUrl(token));
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  const requiredMark = <span className="text-red">*</span>;

  return (
    <div className="px-4 py-5 max-w-[700px] mx-auto">
      {/* Error / Success */}
      <ErrorModal message={error} onClose={() => setError(null)} />
      {success && (
        <div className="bg-[#27ae6022] border border-green text-green rounded-[6px] px-3 py-2 mb-4 text-[15px]">
          {success}
        </div>
      )}

      {/* Tournament Info Form */}
      <section className={sectionClass}>
        <h3 className={sectionHeadingClass}>大会情報</h3>
        <div className="text-[13px] text-muted mb-3">
          大会ID: <span className="text-text font-mono">{tournamentId}</span>
          <span className="ml-2 opacity-60">（編集不可）</span>
        </div>
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-2 gap-[14px]">
            <div>
              <label className={labelClass}>主催</label>
              <select
                value={form.organizer_cd}
                onChange={e => handleOrganizerChange(Number(e.target.value))}
                className={inputClass}
              >
                <option value={0}>— 選択 —</option>
                {associations.map(o => (
                  <option key={o.cd} value={o.cd}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-full">
              <label className={labelClass}>大会名 {requiredMark}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>射撃場名</label>
              <select
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                className={inputClass}
              >
                <option value="">— 未選択 —</option>
                {venueOptions.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>種目</label>
              <select
                value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                className={inputClass}
              >
                <option value="trap">トラップ</option>
                <option value="skeet">スキート</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>1日目</label>
              <DatePicker
                selected={form.day1_date ? new Date(form.day1_date) : null}
                onChange={(date: Date | null) => setForm(f => ({ ...f, day1_date: date ? date.toISOString().slice(0, 10) : '' }))}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                placeholderText="日付を選択"
                customInput={<input className={`${inputClass} cursor-pointer`} readOnly />}
              />
            </div>
            <div>
              <label className={labelClass}>2日目</label>
              <DatePicker
                selected={form.day2_date ? new Date(form.day2_date) : null}
                onChange={(date: Date | null) => setForm(f => ({ ...f, day2_date: date ? date.toISOString().slice(0, 10) : '' }))}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                placeholderText="日付を選択"
                isClearable
                customInput={<input className={`${inputClass} cursor-pointer`} readOnly />}
              />
              {validateDates(form.day1_date, form.day2_date) === 'error' && (
                <div className="text-[#e74c3c] text-[13px] mt-1">
                  2日目の日付は1日目より後にしか設定できません。
                </div>
              )}
            </div>
            {form.event_type !== 'skeet' && (
              <>
                <div>
                  <label className={labelClass}>1日目セット番号</label>
                  <input
                    type="text"
                    value={form.day1_set}
                    onChange={e => setForm(f => ({ ...f, day1_set: e.target.value }))}
                    placeholder="例: 1番セット"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>2日目セット番号</label>
                  <input
                    type="text"
                    value={form.day2_set}
                    onChange={e => setForm(f => ({ ...f, day2_set: e.target.value }))}
                    placeholder="例: 1番セット"
                    className={inputClass}
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={saving || validateDates(form.day1_date, form.day2_date) === 'error'}
              className="bg-gold text-black border-0 rounded-[5px] px-6 py-[9px] font-bold text-[16px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {tournament.info_saved_by && tournament.info_saved_at && (
              <span className="text-[13px] text-muted">
                最終保存: {tournament.info_saved_by} {formatSavedAt(tournament.info_saved_at)}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* QR Code Section */}
      <section className={sectionClass}>
        <h3 className={sectionHeadingClass}>QRコード確認</h3>
        {origin ? (() => {
          const qrTabs: { key: 'viewer' | 'admin' | 'apply' | 'invite'; label: string; url?: string }[] = [
            { key: 'viewer', label: '閲覧用Top', url: `${origin}/` },
            { key: 'apply', label: '申込用', url: `${origin}/tournaments/${tournamentId}/apply` },
            { key: 'admin', label: '運営管理者', url: `${origin}/admin` },
            { key: 'invite', label: '管理者招待' },
          ];
          const activeTab = qrTabs.find(t => t.key === qrTab)!;
          return (
            <div>
              {/* タブ */}
              <div className="flex gap-1 mb-5">
                {qrTabs.map(t => {
                  const active = qrTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setQrTab(t.key); setQrCopied(false); }}
                      className={`rounded-[5px] px-[18px] py-[7px] text-[14px] cursor-pointer flex-1 border ${
                        active
                          ? 'bg-surface-2 text-gold border-gold font-bold'
                          : 'bg-transparent text-muted border-border font-normal'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {/* コンテンツ */}
              {qrTab === 'invite' ? (
                <div className="flex flex-col items-center gap-3">
                  {!inviteToken ? (
                    <button
                      onClick={handleIssueInvite}
                      disabled={inviteLoading}
                      className="bg-[#2a7a9a22] text-blue-2 border border-blue-2 rounded-[6px] px-5 py-[9px] font-bold text-[15px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {inviteLoading ? '発行中...' : '📱 招待QRコードを発行'}
                    </button>
                  ) : (
                    <>
                      <div className="bg-white p-3 rounded-[8px]">
                        <QRCodeSVG value={getInviteUrl(inviteToken)} size={160} />
                      </div>
                      <div className="flex items-center gap-2 w-full max-w-[480px]">
                        <input
                          readOnly
                          value={getInviteUrl(inviteToken)}
                          className={`${inputClass} !text-[11px] flex-1`}
                        />
                        <button
                          onClick={() => handleCopyInviteUrl(inviteToken)}
                          className={`border border-border rounded-[5px] px-[14px] py-[8px] text-[13px] cursor-pointer whitespace-nowrap ${
                            inviteCopied ? 'bg-[#2ecc7133] text-[#2ecc71]' : 'bg-surface-2 text-text'
                          }`}
                        >
                          {inviteCopied ? '✓ コピー済み' : 'URLをコピー'}
                        </button>
                      </div>
                      <div className="bg-[#e8a02011] border border-[#e8a02044] rounded-[6px] px-4 py-[10px] max-w-[480px] w-full">
                        <p className="m-0 text-[13px] text-muted leading-[1.8]">
                          ⚠️ 使用期限24時間、利用者は1名に限定します。<br />
                          複数名を登録する場合は人数分、QRコードを発行してください。<br />
                          他府県所属の選手にも招待QRによって運営管理者になることはできますが、利用できるのは選手が所属する協会の大会のみです。
                        </p>
                      </div>
                      <button
                        onClick={() => { setInviteToken(null); setInviteCopied(false); }}
                        className="bg-transparent text-muted border border-border rounded-[5px] px-4 py-[6px] text-[13px] cursor-pointer"
                      >
                        再発行する場合はこちら
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-[8px]">
                    <QRCodeSVG value={activeTab.url!} size={160} />
                  </div>
                  <a
                    href={activeTab.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="m-0 text-[12px] text-[#3498db] text-center break-all underline"
                  >
                    {activeTab.url}
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(activeTab.url!); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); }}
                    className="bg-gold text-black border-0 rounded-[5px] px-6 py-[8px] text-[14px] font-bold cursor-pointer"
                  >
                    {qrCopied ? 'コピーしました！' : 'URLをコピー'}
                  </button>
                </div>
              )}
            </div>
          );
        })() : (
          <p className="text-muted text-[15px]">読み込み中...</p>
        )}
      </section>

      {/* Danger Zone */}
      <section className="bg-[#ff4d4d11] border border-[#ff4d4d66] rounded-[8px] p-5">
        <h3 className="mt-0 mb-2 text-[17px] text-red">危険ゾーン</h3>
        <p className="mt-0 mb-4 text-[15px] text-muted">
          以下の操作は取り消せません。十分注意して実行してください。
        </p>
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div>
            <p className="mt-0 mb-1 text-[15px] text-text font-semibold">メンバー・点数・申込をリセット</p>
            <p className="m-0 text-[14px] text-muted">大会情報・QRコードは保持されます</p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="bg-transparent text-red border border-red rounded-[5px] px-[18px] py-[8px] text-[16px] font-semibold cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-70"
          >
            {resetting ? 'リセット中...' : 'リセット実行'}
          </button>
          {tournament.reset_by && tournament.reset_at && (
            <span className="text-[13px] text-muted">
              最終リセット: {tournament.reset_by} {formatSavedAt(tournament.reset_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-4 border-t border-[#ff4d4d33]">
          <div>
            <p className="mt-0 mb-1 text-[15px] text-text font-semibold">大会を削除</p>
            <p className="m-0 text-[14px] text-muted">この大会のすべてのデータ（選手・点数・申込）を削除します</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red text-white border border-red rounded-[5px] px-[18px] py-[8px] text-[16px] font-semibold cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting ? '削除中...' : '大会を削除'}
          </button>
        </div>
      </section>

      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onOk={confirmModal.onOk}
          onCancel={() => setConfirmModal(null)}
          okLabel={confirmModal.okLabel}
          okColor={confirmModal.okColor}
        />
      )}
      {alertModal && (
        <AlertModal message={alertModal} onClose={() => setAlertModal(null)} />
      )}
      {promptModal && (
        <PromptModal
          message={promptModal.message}
          onOk={promptModal.onOk}
          onCancel={() => setPromptModal(null)}
          placeholder={promptModal.placeholder}
          okLabel="確認"
        />
      )}
    </div>
  );
}
