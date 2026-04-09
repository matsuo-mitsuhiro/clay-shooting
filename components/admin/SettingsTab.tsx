'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import { C } from '@/lib/colors';
import type { Tournament, EventType, Association, ShootingRange } from '@/lib/types';

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

  // 招待QRコード
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // 組発表
  const [squadComment, setSquadComment] = useState('');
  const [squadPublishedAt, setSquadPublishedAt] = useState<string | null>(null);
  const [previousComment, setPreviousComment] = useState<string | null>(null);
  const [squadSaving, setSquadSaving] = useState(false);

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

  // 組発表データ取得
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
      const ok = window.confirm('1日目と2日目が連続していません。間違えていませんか？');
      if (!ok) return;
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
        body: JSON.stringify({ saved_by: session?.user?.name ?? session?.user?.email ?? '' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess('メンバー・点数データをリセットしました');
      onUpdated();
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

  async function handleSquadPublish(action: 'publish' | 'unpublish') {
    setError(null);
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
      setSuccess(action === 'publish' ? '組発表を公開しました' : '組発表を非公開にしました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSquadSaving(false);
    }
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
                onChange={e => handleOrganizerChange(Number(e.target.value))}
                style={inputStyle}
              >
                <option value={0}>— 選択 —</option>
                {associations.map(o => (
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
              <select
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— 未選択 —</option>
                {venueOptions.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
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
              <label style={labelStyle}>1日目</label>
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
              <label style={labelStyle}>2日目</label>
              <DatePicker
                selected={form.day2_date ? new Date(form.day2_date) : null}
                onChange={(date: Date | null) => setForm(f => ({ ...f, day2_date: date ? date.toISOString().slice(0, 10) : '' }))}
                dateFormat="yyyy/MM/dd"
                locale={ja}
                placeholderText="日付を選択"
                isClearable
                customInput={<input style={{ ...inputStyle, cursor: 'pointer' }} readOnly />}
              />
              {validateDates(form.day1_date, form.day2_date) === 'error' && (
                <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 4 }}>
                  2日目の日付は1日目より後にしか設定できません。
                </div>
              )}
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
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving || validateDates(form.day1_date, form.day2_date) === 'error'}
              style={{
                background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                padding: '9px 24px', fontWeight: 700, fontSize: 16,
                cursor: (saving || validateDates(form.day1_date, form.day2_date) === 'error') ? 'not-allowed' : 'pointer',
                opacity: (saving || validateDates(form.day1_date, form.day2_date) === 'error') ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {tournament.info_saved_by && tournament.info_saved_at && (
              <span style={{ fontSize: 13, color: C.muted }}>
                最終保存: {tournament.info_saved_by} {formatSavedAt(tournament.info_saved_at)}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* QR Code Section */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 17, color: C.gold }}>QRコード確認</h3>
        {origin ? (() => {
          const qrTabs: { key: 'viewer' | 'admin' | 'apply' | 'invite'; label: string; url?: string }[] = [
            { key: 'viewer', label: '閲覧用Top', url: `${origin}/viewer` },
            { key: 'apply', label: '申込用', url: `${origin}/tournaments/${tournamentId}/apply` },
            { key: 'admin', label: '運営管理者', url: `${origin}/admin` },
            { key: 'invite', label: '管理者招待' },
          ];
          const activeTab = qrTabs.find(t => t.key === qrTab)!;
          return (
            <div>
              {/* タブ */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {qrTabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setQrTab(t.key); setQrCopied(false); }}
                    style={{
                      background: qrTab === t.key ? C.surface2 : 'transparent',
                      color: qrTab === t.key ? C.gold : C.muted,
                      border: `1px solid ${qrTab === t.key ? C.gold : C.border}`,
                      borderRadius: 5, padding: '7px 18px', fontSize: 14,
                      fontWeight: qrTab === t.key ? 700 : 400, cursor: 'pointer',
                      flex: 1,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* コンテンツ */}
              {qrTab === 'invite' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  {!inviteToken ? (
                    <button
                      onClick={handleIssueInvite}
                      disabled={inviteLoading}
                      style={{
                        background: `${C.blue2}22`, color: C.blue2, border: `1px solid ${C.blue2}`,
                        borderRadius: 6, padding: '9px 20px', fontWeight: 700, fontSize: 15,
                        cursor: inviteLoading ? 'not-allowed' : 'pointer', opacity: inviteLoading ? 0.7 : 1,
                      }}
                    >
                      {inviteLoading ? '発行中...' : '📱 招待QRコードを発行'}
                    </button>
                  ) : (
                    <>
                      <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                        <QRCodeSVG value={getInviteUrl(inviteToken)} size={160} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480 }}>
                        <input
                          readOnly
                          value={getInviteUrl(inviteToken)}
                          style={{ ...inputStyle, fontSize: 11, flex: 1 }}
                        />
                        <button
                          onClick={() => handleCopyInviteUrl(inviteToken)}
                          style={{
                            background: inviteCopied ? '#2ecc7133' : C.surface2,
                            color: inviteCopied ? '#2ecc71' : C.text,
                            border: `1px solid ${C.border}`, borderRadius: 5,
                            padding: '8px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {inviteCopied ? '✓ コピー済み' : 'URLをコピー'}
                        </button>
                      </div>
                      <div style={{
                        background: `${C.gold}11`, border: `1px solid ${C.gold}44`, borderRadius: 6,
                        padding: '10px 16px', maxWidth: 480, width: '100%',
                      }}>
                        <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
                          ⚠️ 使用期限24時間、利用者は1名に限定します。<br />
                          複数名を登録する場合は人数分、QRコードを発行してください。<br />
                          他府県所属の選手にも招待QRによって運営管理者になることはできますが、利用できるのは選手が所属する協会の大会のみです。
                        </p>
                      </div>
                      <button
                        onClick={() => { setInviteToken(null); setInviteCopied(false); }}
                        style={{
                          background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                          borderRadius: 5, padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        再発行する場合はこちら
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                    <QRCodeSVG value={activeTab.url!} size={160} />
                  </div>
                  <a
                    href={activeTab.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ margin: 0, fontSize: 12, color: '#3498db', textAlign: 'center', wordBreak: 'break-all', textDecoration: 'underline' }}
                  >
                    {activeTab.url}
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(activeTab.url!); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); }}
                    style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '8px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {qrCopied ? 'コピーしました！' : 'URLをコピー'}
                  </button>
                </div>
              )}
            </div>
          );
        })() : (
          <p style={{ color: C.muted, fontSize: 15 }}>読み込み中...</p>
        )}
      </section>

      {/* 組発表 */}
      <section style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px', marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 17, color: C.gold }}>組発表</h3>
        <div style={{ marginBottom: 14 }}>
          <span style={{
            background: squadPublishedAt ? `${C.green}22` : `${C.surface2}`,
            color: squadPublishedAt ? C.green : C.muted,
            border: `1px solid ${squadPublishedAt ? C.green : C.border}`,
            borderRadius: 4, padding: '3px 12px', fontSize: 13, fontWeight: 700,
          }}>
            {squadPublishedAt ? `公開中（${formatSavedAt(squadPublishedAt)}）` : '非公開'}
          </span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <label style={labelStyle}>コメント（組一覧の前に表示）</label>
            {previousComment && previousComment !== squadComment && (
              <button
                type="button"
                onClick={() => setSquadComment(previousComment)}
                style={{
                  background: 'transparent', color: C.gold, border: `1px solid ${C.gold}`,
                  borderRadius: 4, padding: '2px 10px', fontSize: 12, cursor: 'pointer',
                }}
              >
                前回のコメントを使用
              </button>
            )}
          </div>
          <textarea
            value={squadComment}
            onChange={e => setSquadComment(e.target.value)}
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="コメントを入力（空欄でも可）"
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleSquadPublish('publish')}
            disabled={squadSaving}
            style={{
              background: C.green, color: '#000', border: 'none', borderRadius: 5,
              padding: '9px 24px', fontWeight: 700, fontSize: 15,
              cursor: squadSaving ? 'not-allowed' : 'pointer', opacity: squadSaving ? 0.7 : 1,
            }}
          >
            {squadSaving ? '処理中...' : squadPublishedAt ? '再公開（更新）' : '公開する'}
          </button>
          {squadPublishedAt && (
            <button
              type="button"
              onClick={() => handleSquadPublish('unpublish')}
              disabled={squadSaving}
              style={{
                background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 5, padding: '9px 24px', fontSize: 15,
                cursor: squadSaving ? 'not-allowed' : 'pointer', opacity: squadSaving ? 0.7 : 1,
              }}
            >
              非公開にする
            </button>
          )}
        </div>
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
          {tournament.reset_by && tournament.reset_at && (
            <span style={{ fontSize: 13, color: C.muted }}>
              最終リセット: {tournament.reset_by} {formatSavedAt(tournament.reset_at)}
            </span>
          )}
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
