'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ja } from 'date-fns/locale';
import { C } from '@/lib/colors';
import type { Tournament, EventType, Association, ShootingRange } from '@/lib/types';
import ContactButton from '@/components/ContactButton';

export default function AdminPage() {
  const { data: session } = useSession();
  const isSystem = session?.user?.role === 'system';
  const userAffiliation = session?.user?.affiliation ?? null;
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const orgInitRef = useRef(false);

  const [associations, setAssociations] = useState<Association[]>([]);
  const [allRanges, setAllRanges] = useState<ShootingRange[]>([]);
  const [assocRangeIds, setAssocRangeIds] = useState<number[]>([]);

  const [form, setForm] = useState({
    name: '',
    venue: '',
    day1_date: '',
    day2_date: '',
    event_type: 'trap' as EventType,
    organizer_cd: 0,
  });

  // モバイル検出
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 初期データ取得
  useEffect(() => {
    fetchTournaments();
    fetchAssociations();
  }, []);

  // session が確定したら organizer_cd を設定（1回のみ実行してスクロールリセットを防ぐ）
  useEffect(() => {
    if (!session?.user) return;
    if (associations.length === 0) return;
    if (orgInitRef.current) return;
    orgInitRef.current = true;
    updateOrganizerCd(associations);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, associations]);

  async function fetchAssociations() {
    try {
      const [assocRes, rangesRes] = await Promise.all([
        fetch('/api/associations'),
        fetch('/api/shooting-ranges'),
      ]);
      const assocJson = await assocRes.json();
      const rangesJson = await rangesRes.json();
      if (assocJson.success) setAssociations(assocJson.data as Association[]);
      if (rangesJson.success) setAllRanges(rangesJson.data as ShootingRange[]);
    } catch { /* ignore */ }
  }

  function updateOrganizerCd(assocList: Association[]) {
    if (isSystem) {
      const defaultCd = assocList[0]?.cd ?? 0;
      setForm(f => ({ ...f, organizer_cd: defaultCd }));
      // system adminは全射撃場
      setAssocRangeIds([]);
    } else {
      const found = assocList.find(a => a.name === userAffiliation);
      if (found) {
        setForm(f => ({ ...f, organizer_cd: found.cd }));
        // 協会の射撃場リストを取得
        fetch(`/api/associations/${found.cd}`)
          .then(r => r.json())
          .then(j => {
            if (j.success) setAssocRangeIds((j.data.shooting_range_ids as number[]) ?? []);
          })
          .catch(() => {});
      }
    }
  }

  async function fetchTournaments() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tournaments');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setTournaments(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('大会名を入力してください');
      return;
    }
    try {
      setCreating(true);
      setError(null);
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          venue: form.venue.trim() || undefined,
          day1_date: form.day1_date || undefined,
          day2_date: form.day2_date || undefined,
          event_type: form.event_type,
          organizer_cd: form.organizer_cd || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const defaultCd = isSystem ? (associations[0]?.cd ?? 0) : (associations.find(a => a.name === userAffiliation)?.cd ?? 0);
      setForm({ name: '', venue: '', day1_date: '', day2_date: '', event_type: 'trap', organizer_cd: defaultCd });
      setShowForm(false);
      await fetchTournaments();
    } catch (e) {
      setError(e instanceof Error ? e.message : '大会の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  }

  // 主催変更時に射撃場リストを更新
  async function handleOrganizerChange(cd: number) {
    setForm(f => ({ ...f, organizer_cd: cd, venue: '' }));
    if (isSystem) {
      try {
        const res = await fetch(`/api/associations/${cd}`);
        const json = await res.json();
        if (json.success) setAssocRangeIds((json.data.shooting_range_ids as number[]) ?? []);
        else setAssocRangeIds([]);
      } catch { setAssocRangeIds([]); }
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // 進捗に応じた遷移先タブを判定
  function getInitialTab(t: Tournament): string {
    if ((t.score_count ?? 0) > 0) return 'scores';
    if ((t.member_count ?? 0) > 0) return 'members';
    if (t.apply_start_at) return 'registrations';
    return 'settings';
  }

  // 選択中主催の射撃場を表示
  const venueOptions: ShootingRange[] = isSystem
    ? (assocRangeIds.length > 0
        ? allRanges.filter(r => assocRangeIds.includes(r.id))
        : allRanges)
    : allRanges.filter(r => assocRangeIds.includes(r.id));

  // 大会一覧フィルタ
  const userOrganizerCd = isSystem ? null : (associations.find(a => a.name === userAffiliation)?.cd ?? null);
  const filteredTournaments = isSystem
    ? tournaments
    : tournaments.filter(t => t.organizer_cd === userOrganizerCd);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: isMobile ? '12px 16px' : '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 16 : 22, fontWeight: 700, color: C.gold, flex: 1, minWidth: 0 }}>
          {isMobile ? 'クレー射撃 管理' : 'クレー射撃 成績管理システム'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ContactButton />
          {!isMobile && session?.user && (
            <>
              <span style={{ fontSize: 14, color: C.muted }}>
                {session.user.name ?? session.user.email}
              </span>
              <span style={{
                background: isSystem ? `${C.gold}33` : `${C.blue2}33`,
                color: isSystem ? C.gold : C.blue2,
                border: `1px solid ${isSystem ? C.gold : C.blue2}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {isSystem ? 'システム管理者' : '大会管理者'}
              </span>
            </>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            style={{
              background: 'transparent',
              color: C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '5px 12px',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ログアウト
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        {/* 管理ボタン群 */}
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => router.push('/admin/players')}
            style={{
              background: C.surface, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '14px 20px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div>選手マスター管理</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>会員番号・氏名・所属・クラス・審判フラグを管理</div>
            </div>
            <span style={{ marginLeft: 'auto', color: C.muted }}>→</span>
          </button>
          <button
            onClick={() => router.push('/admin/admins')}
            style={{
              background: C.surface, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '14px 20px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>🔑</span>
            <div>
              <div>大会管理者マスター</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>大会管理者のアカウント・パスワードを管理</div>
            </div>
            <span style={{ marginLeft: 'auto', color: C.muted }}>→</span>
          </button>
          <button
            onClick={() => router.push('/admin/shooting-ranges')}
            style={{
              background: C.surface, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '14px 20px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>🎯</span>
            <div>
              <div>射撃場マスター</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>射撃場の登録・管理</div>
            </div>
            <span style={{ marginLeft: 'auto', color: C.muted }}>→</span>
          </button>
          <button
            onClick={() => router.push('/admin/associations')}
            style={{
              background: C.surface, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '14px 20px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>🏢</span>
            <div>
              <div>協会マスター</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>協会ごとの射撃場・中止連絡方法・注意書きを管理</div>
            </div>
            <span style={{ marginLeft: 'auto', color: C.muted }}>→</span>
          </button>
          {isSystem && (
            <button
              onClick={() => router.push('/admin/support')}
              style={{
                background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '14px 20px', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20 }}>💬</span>
              <div>
                <div>質問・Q&amp;A管理</div>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>利用者からの質問を受付・回答・Q&A掲載</div>
              </div>
              <span style={{ marginLeft: 'auto', color: C.muted }}>→</span>
            </button>
          )}
        </div>

        {/* Title + Create Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: C.text }}>大会一覧</h2>
          <button
            onClick={() => { setShowForm(!showForm); setError(null); }}
            style={{
              background: C.gold, color: '#000', border: 'none', borderRadius: 6,
              padding: '9px 20px', fontWeight: 700, fontSize: 16, cursor: 'pointer',
            }}
          >
            ＋ 新規大会作成
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
            borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 16,
          }}>
            {error}
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 24, marginBottom: 28,
          }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 18, color: C.gold }}>新規大会作成</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>主催</label>
                  <select
                    value={form.organizer_cd}
                    onChange={e => handleOrganizerChange(Number(e.target.value))}
                    style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box' }}
                  >
                    {associations.map(o => (
                      <option key={o.cd} value={o.cd}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>
                    大会名 <span style={{ color: C.red }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="例: 第○回○○大会"
                    style={{
                      width: '100%', background: C.inputBg, border: `1px solid ${C.border}`,
                      borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>射撃場名</label>
                  <select
                    value={form.venue}
                    onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                    style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box' }}
                  >
                    <option value="">— 未選択 —</option>
                    {venueOptions.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>1日目日付</label>
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
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>2日目日付（任意）</label>
                  <DatePicker
                    selected={form.day2_date ? new Date(form.day2_date) : null}
                    onChange={(date: Date | null) => setForm(f => ({ ...f, day2_date: date ? date.toISOString().slice(0, 10) : '' }))}
                    dateFormat="yyyy/MM/dd"
                    locale={ja}
                    placeholderText="1日開催の場合は空欄"
                    isClearable
                    customInput={<input style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box' as const }} />}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>種目</label>
                  <select
                    value={form.event_type}
                    onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                    style={{
                      width: '100%', background: C.inputBg, border: `1px solid ${C.border}`,
                      borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box',
                    }}
                  >
                    <option value="trap">トラップ</option>
                    <option value="skeet">スキート</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                    padding: '9px 22px', fontWeight: 700, fontSize: 16,
                    cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? '作成中...' : '作成する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null); }}
                  style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 5, padding: '9px 18px', fontSize: 16, cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tournament List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
            読み込み中...
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '48px 24px', textAlign: 'center', color: C.muted,
          }}>
            大会が登録されていません。「＋ 新規大会作成」から作成してください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredTournaments.map(t => (
              <div
                key={t.id}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '16px 20px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{t.name}</span>
                    <span style={{
                      background: t.event_type === 'trap' ? `${C.gold}33` : `${C.blue2}33`,
                      color: t.event_type === 'trap' ? C.gold : C.blue2,
                      border: `1px solid ${t.event_type === 'trap' ? C.gold : C.blue2}`,
                      borderRadius: 4, padding: '2px 8px', fontSize: 13, fontWeight: 600,
                    }}>
                      {t.event_type === 'trap' ? 'トラップ' : 'スキート'}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, color: '#ffffff', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {t.venue && <span>📍 {t.venue}</span>}
                    {t.day1_date && (
                      <span>📅 {formatDate(t.day1_date)}{t.day2_date ? ` / ${formatDate(t.day2_date)}` : ''}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/admin/${t.id}?tab=${getInitialTab(t)}`)}
                  style={{
                    background: C.surface2, color: C.gold, border: `1px solid ${C.gold}`,
                    borderRadius: 6, padding: '8px 18px', fontSize: 16, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  管理する →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
