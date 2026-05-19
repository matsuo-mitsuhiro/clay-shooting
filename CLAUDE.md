# このプロジェクトについて

## セッション起動プロトコル（「起動」キーワード）

ユーザーが新セッションで「**起動**」または「現状把握」と送ったら、以下を**順番に**実行する。コーディングはしない。

1. `lib/version.ts` を読み、現在バージョンを把握
2. `docs/07_AI引き継ぎメモ.md` を読み、最新機能一覧を把握
3. `docs/05_開発履歴.md` の **最新3バージョン** を読む（直近の変更を理解）
4. memory（user-private）は補助情報として扱い、矛盾時は **コード/docs を優先**
5. 以下のフォーマットで現状報告:

   ```
   📍 現在バージョン: vX.X.X
   📝 最終コミット: <短い説明>
   🆕 直近3バージョンの変更:
      - vX.X.X: <概要>
      - vX.X.X: <概要>
      - vX.X.X: <概要>
   ✅ 残タスク（memory project_pending.md より）: <あれば箇条書き、なければ「なし」>
   💡 次の着手候補: <提案を1〜2点>
   ```

6. 報告後、ユーザーの指示を待つ。「go」または「55」までコードは触らない。

---

## 作業開始時（「起動」を使わない場合）
作業開始時に最低限以下を読む:

```
docs/07_AI引き継ぎメモ.md
```

その後、必要に応じて以下も参照する。

- `docs/01_システム概要.md` — 全体構成・URL・ファイル構成
- `docs/02_画面遷移.md` — 画面フローとUIレイアウト
- `docs/03_DBスキーマ.md` — データベース設計
- `docs/04_ビジネスルール.md` — 仕様・ルール詳細
- `docs/05_開発履歴.md` — 変更履歴・却下案の記録
- `docs/06_環境設定.md` — セットアップ・デプロイ手順
- `docs/08_API一覧.md` — API エンドポイント一覧

---

## ブランチ戦略・デプロイフロー（v3.78.5〜、3環境運用）

```
feature/* （Claudeが作業）
   │ PR
   ▼
staging  （ユーザーがレビュー後マージ）→ Vercel staging（clay-shooting-stg.vercel.app）+ Neon staging branch
   │ PR
   ▼
main     （ユーザーがレビュー後マージ）→ Vercel 本番（clay-shooting.vercel.app）+ Neon production
```

### Claude の作業ルール
- **main / staging に直 push しない**（ブランチ保護で禁止済み）
- 変更は必ず `feature/<目的>` ブランチで作業
- 完了したら `gh pr create --base staging` で staging 向けPR作成
- ユーザーが staging で確認後、Claude が `gh pr create --base main` で本番昇格PR作成

### マイグレーション運用
- `db/migrations/NNN_xxx.sql` を追加するだけでOK
- `staging` ブランチへ push されると `migrate-staging.yml` が staging DB に自動適用
- `main` ブランチへ push されると `migrate-production.yml` が本番 DB に自動適用
- 適用履歴は `_migrations` テーブルで管理（migration 024 で導入）
- **VRT 用 Neon branch (`vrt-baseline`) にも migration を反映する**
  - 新規 migration 追加 PR をマージ → vrt-baseline に手動で `node scripts/vrt-seed.js` 再実行（fixture も含めて再投入）
  - または `_migrations` を確認して未適用分のみ手動で `psql $VRT_DATABASE_URL -f db/migrations/NNN_xxx.sql`
  - VRT_DATABASE_URL は GitHub secret に登録済（`gh secret list` で確認）、手元では Neon dashboard から取得

---

## コミット・プッシュ前（必須）
コードをコミット・プッシュする前に、**必ず**以下を実行すること。

### 1. TypeScriptチェック
```bash
npx tsc --noEmit --incremental false
```
- エラーが1件でもあれば、必ず修正してからコミットする
- 特に `lib/types.ts` を変更した場合は、他ファイルへの影響が出やすいため必須
- エラーなし（出力なし）を確認してからコミットすること

### 1.5 ESLint（追加）
```bash
npx eslint .
```
- エラー（`error`）は0件必須、警告（`warning`）は許容
- CI でも自動チェックされる

### 2. バージョン番号の更新（`lib/version.ts`）
**すべてのコミットで `lib/version.ts` を更新すること。**

| コミットの種類 | バージョン更新ルール | 例 |
|--------------|--------------------|----|
| 新機能・仕様変更 | メジャーパッチを上げる | `3.47` → `3.48` |
| バグ修正・ホットフィックス | 小数点を追加する | `3.47` → `3.47.1` → `3.47.2` |

- コミット完了後、ユーザーに **必ずバージョン番号を報告** すること
- ユーザーは画面フッターのバージョンでデプロイ反映を確認する

---

## コーディング後（必須）
コードを変更してコミットするたびに、以下のドキュメントを必ず更新すること。

### 常に更新するファイル
- **`docs/05_開発履歴.md`**
  - 新しいバージョン番号（v1.x）を追加
  - 変更内容・修正バグ・却下案を記録

- **`docs/07_AI引き継ぎメモ.md`**
  - 「最新コミット時点の主要機能一覧」を最新状態に保つ
  - 新たに判明した設計上の注意点があれば追記

### 変更内容に応じて更新するファイル
| 変更の種類 | 更新するファイル |
|-----------|----------------|
| 画面追加・削除・URL変更 | `docs/01_システム概要.md` / `docs/02_画面遷移.md` |
| DBテーブル・カラム変更 | `docs/03_DBスキーマ.md` |
| ビジネスルール・仕様変更 | `docs/04_ビジネスルール.md` |
| 環境変数・デプロイ手順変更 | `docs/06_環境設定.md` |

### ドキュメント更新のタイミング
コードのコミット **前** または **同じコミット内** に更新すること。

---

## スタイリング方針（v3.92〜、Tailwind 化 D+ 段階導入）

### 大方針
- **新規追加するコードでは `style={{}}` を使わず、Tailwind utility class を使う**
- **既存コードは触ったファイル単位で段階的に Tailwind utility 化する**（D+ 段階導入＋機会主義）
  - 「既存ファイルを編集するときは、ついでに `style={{}}` を Tailwind に書き換える」程度の温度感
  - 一気に全置換しない（VRT 基盤で安全網を確保済みだが、無関係な大量差分は PR レビュー負荷が高い）
- カラー定数の Single Source of Truth は **`lib/colors.ts`**
  - `app/globals.css` の `@theme` に同値を CSS 変数として公開済（v3.92〜）
  - Tailwind utility と JS 双方から同じ値を参照する

### 使えるカラー utility（`@theme` 定義済）
| 用途 | Tailwind class | 値 |
|---|---|---|
| 背景（基本） | `bg-bg` | `#0f1115` |
| サーフェス | `bg-surface` | `#1a1d24` |
| サーフェス 2 | `bg-surface-2` | `#22262f` |
| ボーダー | `border-border` | `#2e3340` |
| ゴールド | `bg-gold` / `text-gold` | `#e8a020` |
| ゴールド暗 | `bg-gold-dark` | `#c07010` |
| ブルー | `bg-blue-2` / `text-blue-2` | `#2a7a9a` |
| 赤 | `text-red` / `bg-red` | `#ff4d4d` |
| 緑 | `text-green` / `bg-green` | `#27ae60` |
| テキスト | `text-text` | `#f0f2f8` |
| ミュート | `text-muted` | `#a8b4cc` |
| 入力背景 | `bg-input-bg` | `#0d0f14` |

### ESLint
- `react/forbid-dom-props` で `style` を **warn**（CI は通る）
- 警告が出ても CI ブロックはしないが、新規追加時は意識的に Tailwind を選ぶこと

### Tailwind v4 メモ
- 設定ファイルは `tailwind.config.ts` ではなく `app/globals.css` の `@theme` ブロック
- 新カラー追加時は `app/globals.css` と `lib/colors.ts` の両方を更新
