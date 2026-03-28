import Link from "next/link";

const adminMenuItems = [
  { href: "/admin", icon: "🏆", label: "大会管理", desc: "大会の作成・編集・削除" },
  { href: "/admin", icon: "👤", label: "選手管理", desc: "選手情報の登録・編集" },
  { href: "/admin", icon: "📋", label: "成績入力", desc: "射撃成績の入力・修正" },
  { href: "/admin", icon: "📊", label: "集計・順位", desc: "成績集計と順位確定" },
];

const viewerMenuItems = [
  { href: "/viewer", icon: "🥇", label: "成績一覧", desc: "大会の成績・順位を確認" },
  { href: "/viewer", icon: "📈", label: "ランキング", desc: "選手別・種目別ランキング" },
  { href: "/viewer", icon: "📅", label: "大会情報", desc: "大会スケジュールと詳細" },
];

// ↑ hrefが重複するためlabelをkeyとして使用

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* ヘッダー */}
      <header className="border-b" style={{ borderColor: "var(--gold-dark)" }}>
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-widest"
              style={{ color: "var(--gold-light)" }}
            >
              クレー射撃大会
            </h1>
          </div>
          <p
            className="text-base sm:text-lg font-semibold tracking-[0.3em]"
            style={{ color: "var(--gold)" }}
          >
            成績管理システム
          </p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col gap-14">

        {/* 管理者メニュー */}
        <section>
          <div className="flex items-center gap-4 mb-7">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, var(--gold-dark))" }} />
            <h2
              className="text-lg font-bold tracking-widest whitespace-nowrap"
              style={{ color: "var(--gold)" }}
            >
              🔐 管理者メニュー
            </h2>
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, var(--gold-dark))" }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {adminMenuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-3 rounded-xl border p-6 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                style={{
                  background: "#1a1a1a",
                  borderColor: "var(--gold-dark)",
                  boxShadow: "inset 0 1px 0 rgba(212,160,23,0.1)",
                }}
              >
                <span className="text-4xl">{item.icon}</span>
                <span
                  className="text-sm font-bold tracking-wide text-center"
                  style={{ color: "var(--gold-light)" }}
                >
                  {item.label}
                </span>
                <span
                  className="text-xs text-center leading-relaxed"
                  style={{ color: "#888" }}
                >
                  {item.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 区切り線 */}
        <div className="h-px w-full" style={{ background: "#2a2a2a" }} />

        {/* 閲覧者メニュー */}
        <section>
          <div className="flex items-center gap-4 mb-7">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, #444)" }} />
            <h2
              className="text-lg font-bold tracking-widest whitespace-nowrap"
              style={{ color: "#ccc" }}
            >
              👁️ 閲覧メニュー
            </h2>
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, #444)" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {viewerMenuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-3 rounded-xl border p-6 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                style={{
                  background: "#161616",
                  borderColor: "#2e2e2e",
                }}
              >
                <span className="text-4xl">{item.icon}</span>
                <span
                  className="text-sm font-bold tracking-wide text-center"
                  style={{ color: "#e0e0e0" }}
                >
                  {item.label}
                </span>
                <span
                  className="text-xs text-center leading-relaxed"
                  style={{ color: "#777" }}
                >
                  {item.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer
        className="border-t py-5 text-center text-xs"
        style={{ borderColor: "#1e1e1e", color: "#444" }}
      >
        © 2025 クレー射撃大会 成績管理システム
      </footer>
    </div>
  );
}
