'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/colors';
import LoadingOverlay from '@/components/LoadingOverlay';
import ContactButton from '@/components/ContactButton';

interface Question {
  id: number;
  member_code: string;
  name: string;
  affiliation: string | null;
  email: string;
  body: string;
  status: string;
  created_at: string;
  answer_id: number | null;
  answer_body: string | null;
  answered_at: string | null;
}

const FAQ_CATEGORIES = ['閲覧者の機能', '大会管理者の機能'];

const inputStyle: React.CSSProperties = {
  background: '#0d0f14',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  padding: '10px 14px',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
};

export default function AdminSupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isSystem = session?.user?.role === 'system';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedQ, setSelectedQ] = useState<Question | null>(null);
  const [answerBody, setAnswerBody] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [answerDone, setAnswerDone] = useState(false);

  // FAQ掲載
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqCategory, setFaqCategory] = useState(FAQ_CATEGORIES[0]);
  const [faqTitle, setFaqTitle] = useState('');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqError, setFaqError] = useState('');
  const [faqDone, setFaqDone] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/support/questions');
      const json = await res.json();
      if (json.success) setQuestions(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      if (!isSystem) { router.push('/admin'); return; }
      fetchQuestions();
    }
  }, [status, isSystem, router, fetchQuestions]);

  function openDetail(q: Question) {
    setSelectedQ(q);
    setAnswerBody(q.answer_body ?? '');
    setAnswerError('');
    setAnswerDone(false);
  }

  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQ || !answerBody.trim()) { setAnswerError('回答を入力してください'); return; }
    setSaving(true);
    setAnswerError('');
    try {
      const res = await fetch('/api/admin/support/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: selectedQ.id, body: answerBody.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setAnswerDone(true);
        await fetchQuestions();
      } else {
        setAnswerError(json.error ?? '送信に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  }

  function openFaqModal() {
    if (!selectedQ) return;
    setFaqTitle('');
    setFaqQuestion(selectedQ.body);
    setFaqAnswer(selectedQ.answer_body ?? '');
    setFaqCategory(FAQ_CATEGORIES[0]);
    setFaqError('');
    setFaqDone(false);
    setShowFaqModal(true);
  }

  async function handlePublishFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!faqTitle.trim() || !faqQuestion.trim() || !faqAnswer.trim()) { setFaqError('タイトル・質問・回答をすべて入力してください'); return; }
    setSaving(true);
    setFaqError('');
    try {
      const res = await fetch('/api/admin/support/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: faqTitle.trim(), question: faqQuestion.trim(), answer: faqAnswer.trim(), category: faqCategory }),
      });
      const json = await res.json();
      if (json.success) { setFaqDone(true); }
      else { setFaqError(json.error ?? '掲載に失敗しました'); }
    } finally {
      setSaving(false);
    }
  }

  const filtered = filterStatus ? questions.filter(q => q.status === filterStatus) : questions;
  const pendingCount = questions.filter(q => q.status === 'pending').length;

  if (status === 'loading') return <LoadingOverlay show message="読み込み中..." />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <LoadingOverlay show={loading || saving} message={saving ? '処理中...' : '読み込み中...'} />

      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 12px', fontSize: 15, cursor: 'pointer' }}>
          ← 大会一覧
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.gold, flex: 1 }}>
          質問管理
          {pendingCount > 0 && (
            <span style={{ background: C.red, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 700, marginLeft: 10 }}>{pendingCount} 件未回答</span>
          )}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ContactButton />
          {session?.user && (
            <>
              <span style={{ fontSize: 13, color: C.muted }}>{session.user.name ?? session.user.email}</span>
              <span style={{ background: `${C.gold}33`, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>システム管理者</span>
            </>
          )}
          <button onClick={() => signOut({ callbackUrl: '/admin/login' })} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            ログアウト
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 16px' }}>

        {/* フィルタ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['', 'すべて'], ['pending', '未回答'], ['answered', '回答済み']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              style={{ background: filterStatus === val ? C.gold : C.surface2, color: filterStatus === val ? '#000' : C.muted, border: `1px solid ${filterStatus === val ? C.gold : C.border}`, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {label}
              {val === '' && ` (${questions.length})`}
              {val === 'pending' && ` (${pendingCount})`}
              {val === 'answered' && ` (${questions.filter(q => q.status === 'answered').length})`}
            </button>
          ))}
        </div>

        {/* 質問一覧 */}
        {!loading && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>質問はありません</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {['受付日時', '会員番号', '氏名', '所属', '状態', '操作'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 13, color: C.muted, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(q => (
                    <tr key={q.id} style={{ borderBottom: `1px solid ${C.border}33` }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>
                        {new Date(q.created_at).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 14 }}>{q.member_code}</td>
                      <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>{q.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: C.muted }}>{q.affiliation ?? '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: q.status === 'answered' ? '#2ecc7133' : `${C.red}33`, color: q.status === 'answered' ? '#2ecc71' : '#e74c3c', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                          {q.status === 'answered' ? '回答済み' : '未回答'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => openDetail(q)}
                          style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 14px', fontSize: 13, cursor: 'pointer' }}
                        >
                          詳細・回答
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* 詳細・回答モーダル */}
      {selectedQ && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '20px 16px', overflowY: 'auto' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: '100%', maxWidth: 580, position: 'relative' }}>
            <button onClick={() => setSelectedQ(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>

            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: C.gold }}>質問詳細</h3>

            {/* 質問者情報 */}
            <div style={{ background: C.surface2, borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: C.muted }}>
              <div>会員番号：<span style={{ color: C.text }}>{selectedQ.member_code}</span></div>
              <div>氏名：<span style={{ color: C.text }}>{selectedQ.name}</span></div>
              <div>所属：<span style={{ color: C.text }}>{selectedQ.affiliation ?? '—'}</span></div>
              <div>メール：<span style={{ color: C.text }}>{selectedQ.email}</span></div>
            </div>

            {/* 質問内容 */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: C.muted, fontWeight: 600 }}>質問内容</p>
              <div style={{ background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 14px', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: C.text }}>
                {selectedQ.body}
              </div>
            </div>

            {/* 回答フォーム */}
            {!answerDone ? (
              <form onSubmit={handleAnswer}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
                    回答 {selectedQ.status === 'answered' && <span style={{ color: '#2ecc71', fontWeight: 400 }}>（回答済み・上書き可）</span>}
                  </label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
                    value={answerBody}
                    onChange={e => setAnswerBody(e.target.value)}
                    placeholder="回答を入力してください"
                  />
                </div>
                {answerError && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 10 }}>⚠ {answerError}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="submit" style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>
                    回答を送信
                  </button>
                  {selectedQ.answer_body && (
                    <button type="button" onClick={openFaqModal} style={{ background: `${C.blue2}22`, color: C.blue2, border: `1px solid ${C.blue2}`, borderRadius: 6, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>
                      📋 Q&Aに掲載
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedQ(null)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 16px', cursor: 'pointer' }}>
                    閉じる
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <p style={{ color: '#2ecc71', fontWeight: 600, marginBottom: 16 }}>回答を送信しました</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={openFaqModal} style={{ background: `${C.blue2}22`, color: C.blue2, border: `1px solid ${C.blue2}`, borderRadius: 6, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>
                    📋 Q&Aに掲載
                  </button>
                  <button onClick={() => setSelectedQ(null)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 16px', cursor: 'pointer' }}>
                    閉じる
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAQ掲載モーダル */}
      {showFaqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: '100%', maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: C.gold }}>📋 Q&Aに掲載</h3>

            {!faqDone ? (
              <form onSubmit={handlePublishFaq}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>カテゴリ</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={faqCategory} onChange={e => setFaqCategory(e.target.value)}>
                    {FAQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>タイトル <span style={{ color: '#e74c3c' }}>*</span></label>
                  <input style={inputStyle} value={faqTitle} onChange={e => setFaqTitle(e.target.value)} placeholder="例：スコアの確認方法について" required />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>質問文（編集可）</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.6 }} value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 6 }}>回答文（編集可）</label>
                  <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }} value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} required />
                </div>
                {faqError && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 10 }}>⚠ {faqError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>掲載する</button>
                  <button type="button" onClick={() => setShowFaqModal(false)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 16px', cursor: 'pointer' }}>キャンセル</button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <p style={{ color: '#2ecc71', fontWeight: 600, marginBottom: 4 }}>Q&Aに掲載しました</p>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
                  <a href="/faq" target="_blank" style={{ color: C.gold }}>Q&A一覧ページ</a>で確認できます
                </p>
                <button onClick={() => { setShowFaqModal(false); setSelectedQ(null); }} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
