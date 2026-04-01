'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/colors';

interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  published_at: string;
}

const CATEGORIES = ['閲覧者の機能', '大会管理者の機能'];

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchWord, setSearchWord] = useState('');
  const [inputWord, setInputWord] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  function fetchFaq(q: string, category: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    fetch(`/api/faq?${params.toString()}`)
      .then(r => r.json())
      .then(j => { if (j.success) setItems(j.data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchFaq('', ''); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchWord(inputWord);
    fetchFaq(inputWord, selectedCategory);
  }

  function handleCategory(cat: string) {
    setSelectedCategory(cat);
    fetchFaq(searchWord, cat);
  }

  function highlight(text: string, word: string) {
    if (!word) return text;
    const parts = text.split(new RegExp(`(${word})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === word.toLowerCase()
        ? <mark key={i} style={{ background: `${C.gold}55`, color: C.text, borderRadius: 2, padding: '0 2px' }}>{p}</mark>
        : p
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Arial, sans-serif' }}>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, color: C.gold, fontWeight: 700 }}>よくある質問（Q&A）</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>クレー射撃 成績管理システム</p>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px' }}>
        {/* 検索バー */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            value={inputWord}
            onChange={e => setInputWord(e.target.value)}
            placeholder="キーワードで検索..."
            style={{ flex: 1, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '10px 14px', fontSize: 15, outline: 'none' }}
          />
          <button
            type="submit"
            style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            検索
          </button>
          {(searchWord || selectedCategory) && (
            <button
              type="button"
              onClick={() => { setInputWord(''); setSearchWord(''); setSelectedCategory(''); fetchFaq('', ''); }}
              style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              クリア
            </button>
          )}
        </form>

        {/* カテゴリタブ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleCategory('')}
            style={{ background: selectedCategory === '' ? C.gold : C.surface2, color: selectedCategory === '' ? '#000' : C.muted, border: `1px solid ${selectedCategory === '' ? C.gold : C.border}`, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            すべて
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              style={{ background: selectedCategory === cat ? C.gold : C.surface2, color: selectedCategory === cat ? '#000' : C.muted, border: `1px solid ${selectedCategory === cat ? C.gold : C.border}`, borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 検索結果情報 */}
        {searchWord && (
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
            「{searchWord}」の検索結果：{items.length} 件
          </p>
        )}

        {/* Q&Aリスト */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>読み込み中...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p>該当するQ&Aが見つかりません</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => (
              <div
                key={item.id}
                style={{ background: C.surface, border: `1px solid ${openId === item.id ? C.gold + '66' : C.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}
              >
                {/* 質問行 */}
                <button
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  style={{ width: '100%', background: 'transparent', border: 'none', padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}
                >
                  <span style={{ color: C.gold, fontWeight: 700, fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>Q</span>
                  <span style={{ color: C.text, fontSize: 15, lineHeight: 1.6, flex: 1 }}>
                    {highlight(item.question, searchWord)}
                  </span>
                  <span style={{ color: C.muted, fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                    {openId === item.id ? '▲' : '▼'}
                  </span>
                </button>

                {/* 回答（展開時） */}
                {openId === item.id && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 20px', display: 'flex', gap: 12 }}>
                    <span style={{ color: C.blue2, fontWeight: 700, fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>A</span>
                    <p style={{ margin: 0, color: C.text, fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap', flex: 1 }}>
                      {highlight(item.answer, searchWord)}
                    </p>
                  </div>
                )}

                {/* カテゴリバッジ */}
                <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ background: `${C.gold}22`, color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
