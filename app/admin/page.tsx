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
import Footer from '@/components/Footer';

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

  const [listTab, setListTab] = useState<'current' | 'past'>('current');
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

  // コピー作成フォーム
  const [copySource, setCopySource] = useState<Tournament | null>(null);
  const [showCopyForm, setShowCopyForm] = useState(false);
  const [copyCreating, setCopyCreating] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyForm, setCopyForm] = useState({
    name: '',
    venue: '',
    day1_date: '',
    day2_date: '',
    day1_set: '',
    day2_set: '',
    event_type: 'trap' as EventType,
    organizer_cd: 0,
    max_participants: '' as string,
    apply_start_at: null as Date | null,
    apply_end_at: null as Date | null,
    cancel_end_at: null as Date | null,
    gate_open_time: '',
    reception_start_time: '',
    practice_clay_time: '',
    competition_start_time: '',
    cancellation_notice: '',
    notes: '',
    rule_type: 'ISSF（地方公式版）',
    chief_judge: '',
    operation_manager: '',
    record_manager: '',
    set_checker: '',
    clay_name: '',
    class_division: 'none',
    squad_comment: '',
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

  // コピー作成フォームを開く
  function handleOpenCopy(t: Tournament) {
    setCopySource(t);
    setCopyError(null);
    setCopyForm({
      name: t.name,
      venue: t.venue ?? '',
      day1_date: '',
      day2_date: '',
      day1_set: '',
      day2_set: '',
      event_type: t.event_type,
      organizer_cd: t.organizer_cd ?? 0,
      max_participants: t.max_participants != null ? String(t.max_participants) : '',
      apply_start_at: t.apply_start_at ? new Date(t.apply_start_at) : null,
      apply_end_at: t.apply_end_at ? new Date(t.apply_end_at) : null,
      cancel_end_at: t.cancel_end_at ? new Date(t.cancel_end_at) : null,
      gate_open_time: t.gate_open_time ?? '',
      reception_start_time: t.reception_start_time ?? '',
      practice_clay_time: t.practice_clay_time ?? '',
      competition_start_time: t.competition_start_time ?? '',
      cancellation_notice: t.cancellation_notice ?? '',
      notes: t.notes ?? '',
      rule_type: t.rule_type ?? 'ISSF（地方公式版）',
      chief_judge: t.chief_judge ?? '',
      operation_manager: t.operation_manager ?? '',
      record_manager: t.record_manager ?? '',
      set_checker: t.set_checker ?? '',
      clay_name: t.clay_name ?? '',
      class_division: t.class_division ?? 'none',
      squad_comment: t.squad_comment ?? '',
    });
    setShowCopyForm(true);
    setShowForm(false);
    setTimeout(() => {
      document.getElementById('copy-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // コピー作成実行
  async function handleCopyCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!copyForm.name.trim()) {
      setCopyError('大会名を入力してください');
      return;
    }
    if (!copyForm.day1_date) {
      setCopyError('1日目の日付は必須です');
      return;
    }
    if (!copyForm.apply_start_at) {
      setCopyError('募集開始日時は必須です');
      return;
    }
    if (!copyForm.apply_end_at) {
      setCopyError('募集終了日時は必須です');
      return;
    }
    if (!copyForm.cancel_end_at) {
      setCopyError('キャンセル可能日時は必須です');
      return;
    }
    const dateStatus = validateDates(copyForm.day1_date, copyForm.day2_date);
    if (dateStatus === 'error') {
      setCopyError('2日目の日付は1日目より後にしか設定できません。');
      return;
    }
    if (dateStatus === 'warn') {
      const ok = window.confirm('1日目と2日目が連続していません。間違えていませんか？');
      if (!ok) return;
    }
    try {
      setCopyCreating(true);
      setCopyError(null);
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: copyForm.name.trim(),
          venue: copyForm.venue || undefined,
          day1_date: copyForm.day1_date || undefined,
          day2_date: copyForm.day2_date || undefined,
          day1_set: copyForm.day1_set || undefined,
          day2_set: copyForm.day2_set || undefined,
          event_type: copyForm.event_type,
          organizer_cd: copyForm.organizer_cd || undefined,
          max_participants: copyForm.max_participants ? Number(copyForm.max_participants) : undefined,
          apply_start_at: copyForm.apply_start_at ? copyForm.apply_start_at.toISOString() : undefined,
          apply_end_at: copyForm.apply_end_at ? copyForm.apply_end_at.toISOString() : undefined,
          cancel_end_at: copyForm.cancel_end_at ? copyForm.cancel_end_at.toISOString() : undefined,
          gate_open_time: copyForm.gate_open_time || undefined,
          reception_start_time: copyForm.reception_start_time || undefined,
          practice_clay_time: copyForm.practice_clay_time || undefined,
          competition_start_time: copyForm.competition_start_time || undefined,
          cancellation_notice: copyForm.cancellation_notice || undefined,
          notes: copyForm.notes || undefined,
          rule_type: copyForm.rule_type || undefined,
          chief_judge: copyForm.chief_judge || undefined,
          operation_manager: copyForm.operation_manager || undefined,
          record_manager: copyForm.record_manager || undefined,
          set_checker: copyForm.set_checker || undefined,
          clay_name: copyForm.clay_name || undefined,
          class_division: copyForm.class_division || 'none',
          squad_comment: copyForm.squad_comment || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowCopyForm(false);
      setCopySource(null);
      await fetchTournaments();
      router.push(`/admin/${(json.data as Tournament).id}?tab=settings`);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : '大会の作成に失敗しました');
    } finally {
      setCopyCreating(false);
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

  function validateDates(day1: string, day2: string): 'ok' | 'error' | 'warn' {
    if (!day1 || !day2) return 'ok';
    const d1 = new Date(day1);
    const d2 = new Date(day2);
    if (d2 <= d1) return 'error';
    const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays !== 1) return 'warn';
    return 'ok';
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

  // 今日の日付（時刻なし）
  const todayStr = new Date().toISOString().slice(0, 10);

  // 大会の最終日（day2_date があれば day2、なければ day1）
  const lastDate = (t: Tournament) => t.day2_date ?? t.day1_date ?? '';

  // 現在・今後（最終日 >= 今日）: 日付昇順
  const currentTournaments = filteredTournaments
    .filter(t => !lastDate(t) || lastDate(t) >= todayStr)
    .sort((a, b) => (lastDate(a) < lastDate(b) ? -1 : lastDate(a) > lastDate(b) ? 1 : 0));

  // 過去（最終日 < 今日）: 日付降順
  const pastTournaments = filteredTournaments
    .filter(t => lastDate(t) && lastDate(t) < todayStr)
    .sort((a, b) => (lastDate(a) > lastDate(b) ? -1 : lastDate(a) < lastDate(b) ? 1 : 0));

  const displayTournaments = listTab === 'current' ? currentTournaments : pastTournaments;

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
                {isSystem ? 'システム管理者' : '運営管理者'}
              </span>
            </>
          )}
          <a
            href="/manual/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: C.muted,
              fontSize: 18,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            title="マニュアル"
          >
            ℹ️
          </a>
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
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>会員番号・氏名・所属協会・クラス・審判フラグを管理</div>
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
              <div>運営管理者マスター</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>運営管理者のアカウント・パスワードを管理</div>
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
          <button
            onClick={() => router.push('/admin/logs')}
            style={{
              background: C.surface, color: C.text, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '14px 20px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>📋</span>
            <div>
              <div>ログイン・操作ログ</div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginTop: 2 }}>{isSystem ? '全大会の操作履歴を確認' : '自協会の操作履歴を確認'}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: C.muted }}>→</span>
          </button>
        </div>

        {/* Title + Tabs + Create Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['current', 'past'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setListTab(tab)}
                style={{
                  background: listTab === tab ? C.gold : 'transparent',
                  color: listTab === tab ? '#000' : C.muted,
                  border: `1px solid ${listTab === tab ? C.gold : C.border}`,
                  borderRadius: 6,
                  padding: '6px 16px',
                  fontSize: 16,
                  fontWeight: listTab === tab ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {tab === 'current' ? '大会一覧' : '過去の大会'}
              </button>
            ))}
          </div>
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
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>1日目</label>
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
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>2日目（任意）</label>
                  <DatePicker
                    selected={form.day2_date ? new Date(form.day2_date) : null}
                    onChange={(date: Date | null) => setForm(f => ({ ...f, day2_date: date ? date.toISOString().slice(0, 10) : '' }))}
                    dateFormat="yyyy/MM/dd"
                    locale={ja}
                    placeholderText="1日開催の場合は空欄"
                    isClearable
                    customInput={<input style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 16, boxSizing: 'border-box' as const }} />}
                  />
                  {validateDates(form.day1_date, form.day2_date) === 'error' && (
                    <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 4 }}>
                      2日目の日付は1日目より後にしか設定できません。
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={creating || validateDates(form.day1_date, form.day2_date) === 'error'}
                  style={{
                    background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                    padding: '9px 22px', fontWeight: 700, fontSize: 16,
                    cursor: (creating || validateDates(form.day1_date, form.day2_date) === 'error') ? 'not-allowed' : 'pointer',
                    opacity: (creating || validateDates(form.day1_date, form.day2_date) === 'error') ? 0.7 : 1,
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

        {/* Copy Form */}
        {showCopyForm && copySource && (
          <div id="copy-form-top" style={{
            background: C.surface, border: `2px solid ${C.gold}`, borderRadius: 8,
            padding: 24, marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: C.gold }}>
                📋 コピーして新規作成
              </h3>
              <span style={{ fontSize: 13, color: C.muted }}>コピー元：{copySource.name}</span>
            </div>

            {copyError && (
              <div style={{
                background: `${C.red}22`, border: `1px solid ${C.red}`, color: '#e74c3c',
                borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 15,
              }}>
                {copyError}
              </div>
            )}

            <form onSubmit={handleCopyCreate}>
              {/* 大会設定 */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>大会設定</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>主催</label>
                    <select
                      value={copyForm.organizer_cd}
                      onChange={e => setCopyForm(f => ({ ...f, organizer_cd: Number(e.target.value), venue: '' }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    >
                      {associations.map(o => <option key={o.cd} value={o.cd}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>
                      大会名 <span style={{ color: C.red }}>*</span>
                      <span style={{ color: C.gold, fontSize: 12, marginLeft: 8 }}>← 必要に応じて修正してください</span>
                    </label>
                    <input
                      type="text"
                      value={copyForm.name}
                      onChange={e => setCopyForm(f => ({ ...f, name: e.target.value }))}
                      style={{
                        width: '100%', background: C.inputBg, border: `2px solid ${C.gold}`,
                        borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>射撃場名</label>
                    <select
                      value={copyForm.venue}
                      onChange={e => setCopyForm(f => ({ ...f, venue: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    >
                      <option value="">— 未選択 —</option>
                      {allRanges.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>種目</label>
                    <select
                      value={copyForm.event_type}
                      onChange={e => setCopyForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    >
                      <option value="trap">トラップ</option>
                      <option value="skeet">スキート</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 日程 */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                  日程・セット番号
                  <span style={{ color: C.red, fontSize: 13, fontWeight: 400, marginLeft: 8 }}>※ 日付は必須入力</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>
                      1日目 <span style={{ color: C.red }}>*</span>
                    </label>
                    <DatePicker
                      selected={copyForm.day1_date ? new Date(copyForm.day1_date) : null}
                      onChange={(date: Date | null) => setCopyForm(f => ({ ...f, day1_date: date ? date.toISOString().slice(0, 10) : '' }))}
                      dateFormat="yyyy/MM/dd"
                      locale={ja}
                      placeholderText="日付を選択（必須）"
                      customInput={<input style={{ width: '100%', background: C.inputBg, border: `2px solid ${copyForm.day1_date ? C.border : C.red}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' as const }} />}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>2日目（任意）</label>
                    <DatePicker
                      selected={copyForm.day2_date ? new Date(copyForm.day2_date) : null}
                      onChange={(date: Date | null) => setCopyForm(f => ({ ...f, day2_date: date ? date.toISOString().slice(0, 10) : '' }))}
                      dateFormat="yyyy/MM/dd"
                      locale={ja}
                      placeholderText="1日開催の場合は空欄"
                      isClearable
                      customInput={<input style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' as const }} />}
                    />
                    {validateDates(copyForm.day1_date, copyForm.day2_date) === 'error' && (
                      <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 4 }}>2日目の日付は1日目より後にしか設定できません。</div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>1日目セット番号</label>
                    <input
                      type="text"
                      value={copyForm.day1_set}
                      onChange={e => setCopyForm(f => ({ ...f, day1_set: e.target.value }))}
                      placeholder="例: 1番セット"
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>2日目セット番号</label>
                    <input
                      type="text"
                      value={copyForm.day2_set}
                      onChange={e => setCopyForm(f => ({ ...f, day2_set: e.target.value }))}
                      placeholder="例: 10番セット裏"
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* 申込設定 */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>申込設定</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>募集人数（日程ごと）</label>
                    <input
                      type="number"
                      value={copyForm.max_participants}
                      onChange={e => setCopyForm(f => ({ ...f, max_participants: e.target.value }))}
                      placeholder="例: 50"
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div />
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>
                      募集開始日時 <span style={{ color: C.red }}>*</span>
                    </label>
                    <DatePicker
                      selected={copyForm.apply_start_at}
                      onChange={(date: Date | null) => setCopyForm(f => ({ ...f, apply_start_at: date }))}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy/MM/dd HH:mm"
                      locale={ja}
                      placeholderText="日付・時刻を選択（必須）"
                      isClearable
                      customInput={<input style={{ width: '100%', background: C.inputBg, border: `2px solid ${copyForm.apply_start_at ? C.border : C.red}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' as const }} />}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>
                      募集終了日時 <span style={{ color: C.red }}>*</span>
                    </label>
                    <DatePicker
                      selected={copyForm.apply_end_at}
                      onChange={(date: Date | null) => setCopyForm(f => ({ ...f, apply_end_at: date }))}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy/MM/dd HH:mm"
                      locale={ja}
                      placeholderText="日付・時刻を選択（必須）"
                      isClearable
                      customInput={<input style={{ width: '100%', background: C.inputBg, border: `2px solid ${copyForm.apply_end_at ? C.border : C.red}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' as const }} />}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>
                      キャンセル可能日時 <span style={{ color: C.red }}>*</span>
                    </label>
                    <DatePicker
                      selected={copyForm.cancel_end_at}
                      onChange={(date: Date | null) => setCopyForm(f => ({ ...f, cancel_end_at: date }))}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy/MM/dd HH:mm"
                      locale={ja}
                      placeholderText="日付・時刻を選択（必須）"
                      isClearable
                      customInput={<input style={{ width: '100%', background: C.inputBg, border: `2px solid ${copyForm.cancel_end_at ? C.border : C.red}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' as const }} />}
                    />
                  </div>
                  <div />
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>射撃場開門時間</label>
                    <input
                      type="time"
                      value={copyForm.gate_open_time}
                      onChange={e => setCopyForm(f => ({ ...f, gate_open_time: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>受付開始時間</label>
                    <input
                      type="time"
                      value={copyForm.reception_start_time}
                      onChange={e => setCopyForm(f => ({ ...f, reception_start_time: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>テストクレー放出時間</label>
                    <input
                      type="time"
                      value={copyForm.practice_clay_time}
                      onChange={e => setCopyForm(f => ({ ...f, practice_clay_time: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>競技開始時間</label>
                    <input
                      type="time"
                      value={copyForm.competition_start_time}
                      onChange={e => setCopyForm(f => ({ ...f, competition_start_time: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ gridColumn: isMobile ? undefined : 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>中止お知らせ方法</label>
                    <textarea
                      value={copyForm.cancellation_notice}
                      onChange={e => setCopyForm(f => ({ ...f, cancellation_notice: e.target.value }))}
                      rows={3}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ gridColumn: isMobile ? undefined : 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>申込注意書き</label>
                    <textarea
                      value={copyForm.notes}
                      onChange={e => setCopyForm(f => ({ ...f, notes: e.target.value }))}
                      rows={4}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* 記録審査 */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>記録審査</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>ルール</label>
                    <select
                      value={copyForm.rule_type}
                      onChange={e => setCopyForm(f => ({ ...f, rule_type: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    >
                      {['ISSF（地方公式版）', 'ISSF（国際公式版）', 'ビギナー', 'マスター', 'その他'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>クラス分け</label>
                    <select
                      value={copyForm.class_division}
                      onChange={e => setCopyForm(f => ({ ...f, class_division: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    >
                      <option value="none">なし</option>
                      <option value="divided">あり</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>使用クレー名</label>
                    <input
                      type="text"
                      value={copyForm.clay_name}
                      onChange={e => setCopyForm(f => ({ ...f, clay_name: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div />
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>審査委員長</label>
                    <input
                      type="text"
                      value={copyForm.chief_judge}
                      onChange={e => setCopyForm(f => ({ ...f, chief_judge: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>大会運営責任者</label>
                    <input
                      type="text"
                      value={copyForm.operation_manager}
                      onChange={e => setCopyForm(f => ({ ...f, operation_manager: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>記録責任者</label>
                    <input
                      type="text"
                      value={copyForm.record_manager}
                      onChange={e => setCopyForm(f => ({ ...f, record_manager: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>セット確認者</label>
                    <input
                      type="text"
                      value={copyForm.set_checker}
                      onChange={e => setCopyForm(f => ({ ...f, set_checker: e.target.value }))}
                      style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* 組発表 */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: C.muted, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>組発表</h4>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: C.muted, marginBottom: 5 }}>組発表コメント（テンプレート）</label>
                  <textarea
                    value={copyForm.squad_comment}
                    onChange={e => setCopyForm(f => ({ ...f, squad_comment: e.target.value }))}
                    rows={4}
                    style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={copyCreating || !copyForm.day1_date || !copyForm.apply_start_at || !copyForm.apply_end_at || !copyForm.cancel_end_at || validateDates(copyForm.day1_date, copyForm.day2_date) === 'error'}
                  style={{
                    background: C.gold, color: '#000', border: 'none', borderRadius: 5,
                    padding: '10px 24px', fontWeight: 700, fontSize: 16,
                    cursor: (copyCreating || !copyForm.day1_date || !copyForm.apply_start_at || !copyForm.apply_end_at || !copyForm.cancel_end_at || validateDates(copyForm.day1_date, copyForm.day2_date) === 'error') ? 'not-allowed' : 'pointer',
                    opacity: (copyCreating || !copyForm.day1_date || !copyForm.apply_start_at || !copyForm.apply_end_at || !copyForm.cancel_end_at || validateDates(copyForm.day1_date, copyForm.day2_date) === 'error') ? 0.7 : 1,
                  }}
                >
                  {copyCreating ? '作成中...' : '作成する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCopyForm(false); setCopySource(null); setCopyError(null); }}
                  style={{
                    background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                    borderRadius: 5, padding: '10px 18px', fontSize: 16, cursor: 'pointer',
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
        ) : displayTournaments.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '48px 24px', textAlign: 'center', color: C.muted,
          }}>
            {listTab === 'current' ? '大会が登録されていません。「＋ 新規大会作成」から作成してください。' : '過去の大会はありません。'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayTournaments.map(t => (
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
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
                  <button
                    onClick={() => handleOpenCopy(t)}
                    style={{
                      background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    ＋ この大会をコピーして新規作成
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
