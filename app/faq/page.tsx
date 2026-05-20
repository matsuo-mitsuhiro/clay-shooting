'use client';

import { useState, useEffect } from 'react';
import ContactButton from '@/components/ContactButton';
import Footer from '@/components/Footer';

interface FaqItem {
  id: number;
  category: string;
  title: string;
  question: string;
  answer: string;
  published_at: string;
}

const CATEGORIES = ['閲覧者の機能', '運営管理者の機能'];

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
        ? <mark key={i} className="bg-[#e8a02055] text-text rounded-[2px] px-[2px] py-0">{p}</mark>
        : p
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text font-[Arial,sans-serif]">
      <header className="bg-surface border-b border-border px-5 py-4">
        <div className="max-w-[800px] mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="mt-0 mb-1 text-[22px] text-gold font-bold">よくある質問（Q&A）</h1>
            <p className="m-0 text-[13px] text-muted">クレー射撃大会運営システム</p>
          </div>
          <ContactButton />
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 py-7">
        {/* 検索バー */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <input
            type="text"
            value={inputWord}
            onChange={e => setInputWord(e.target.value)}
            placeholder="キーワードで検索..."
            className="flex-1 bg-input-bg border border-border rounded-[6px] text-text px-[14px] py-[10px] text-[15px] outline-none"
          />
          <button
            type="submit"
            className="bg-gold text-black border-0 rounded-[6px] px-5 py-[10px] text-[15px] font-bold cursor-pointer whitespace-nowrap"
          >
            検索
          </button>
          {(searchWord || selectedCategory) && (
            <button
              type="button"
              onClick={() => { setInputWord(''); setSearchWord(''); setSelectedCategory(''); fetchFaq('', ''); }}
              className="bg-surface-2 text-muted border border-border rounded-[6px] px-[14px] py-[10px] text-[14px] cursor-pointer whitespace-nowrap"
            >
              クリア
            </button>
          )}
        </form>

        {/* カテゴリタブ */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => handleCategory('')}
            className={`rounded-[20px] px-4 py-[6px] text-[13px] font-semibold cursor-pointer border ${
              selectedCategory === ''
                ? 'bg-gold text-black border-gold'
                : 'bg-surface-2 text-muted border-border'
            }`}
          >
            すべて
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className={`rounded-[20px] px-4 py-[6px] text-[13px] font-semibold cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-gold text-black border-gold'
                  : 'bg-surface-2 text-muted border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 検索結果情報 */}
        {searchWord && (
          <p className="text-muted text-[13px] mb-4">
            「{searchWord}」の検索結果：{items.length} 件
          </p>
        )}

        {/* Q&Aリスト */}
        {loading ? (
          <div className="text-center p-12 text-muted">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="text-center p-12 text-muted">
            <div className="text-[32px] mb-3">🔍</div>
            <p>該当するQ&Aが見つかりません</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
              <div
                key={item.id}
                className={`bg-surface rounded-[10px] overflow-hidden transition-colors border ${
                  openId === item.id ? 'border-[#e8a02066]' : 'border-border'
                }`}
              >
                {/* タイトル行 */}
                {item.title && (
                  <div className="pt-[14px] px-5 pb-0 flex items-center gap-2">
                    <span className="text-gold font-bold text-[15px]">
                      {highlight(item.title, searchWord)}
                    </span>
                  </div>
                )}

                {/* 質問行 */}
                <button
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  className={`w-full bg-transparent border-0 cursor-pointer flex items-start gap-3 text-left ${
                    item.title ? 'pt-2 px-5 pb-4' : 'px-5 py-4'
                  }`}
                >
                  <span className="text-gold font-bold text-[18px] leading-[1.4] shrink-0">Q</span>
                  <span className="text-text text-[15px] leading-[1.6] flex-1">
                    {highlight(item.question, searchWord)}
                  </span>
                  <span className="text-muted text-[18px] shrink-0 mt-[2px]">
                    {openId === item.id ? '▲' : '▼'}
                  </span>
                </button>

                {/* 回答（展開時） */}
                {openId === item.id && (
                  <div className="border-t border-border px-5 py-4 flex gap-3">
                    <span className="text-blue-2 font-bold text-[18px] leading-[1.4] shrink-0">A</span>
                    <p className="m-0 text-text text-[15px] leading-[1.8] whitespace-pre-wrap flex-1">
                      {highlight(item.answer, searchWord)}
                    </p>
                  </div>
                )}

                {/* カテゴリバッジ */}
                <div className="pt-0 px-5 pb-3 flex justify-end">
                  <span className="bg-[#e8a02022] text-gold border border-[#e8a02044] rounded-[4px] px-2 py-[2px] text-[11px]">
                    {item.category}
                  </span>
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
