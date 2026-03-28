# データベース設計

## テーブル構成

```
tournaments  (大会情報)
    │
    ├── members  (メンバー登録)
    └── scores   (点数)
         │
         └── v_results (成績ビュー ※SELECT専用)
```

---

## 1. tournaments（大会情報）

| カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|
| id | SERIAL | ✓ | PK |
| name | VARCHAR(200) | ✓ | 大会名 |
| venue | VARCHAR(200) | | 射撃場名 |
| day1_date | DATE | | 1日目日付 |
| day2_date | DATE | | 2日目日付（任意） |
| event_type | VARCHAR(10) | ✓ | `trap` or `skeet` |
| day1_set | VARCHAR(100) | | 1日目セット番号（例：「1番セット」） |
| day2_set | VARCHAR(100) | | 2日目セット番号（例：「10番セット裏」） |
| admin_qr | TEXT | | 管理者用QR（Base64画像） |
| viewer_qr | TEXT | | 閲覧者用QR（Base64画像） |
| created_at | TIMESTAMPTZ | ✓ | 作成日時 |
| updated_at | TIMESTAMPTZ | ✓ | 更新日時（自動） |

---

## 2. members（メンバー）

| カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|
| id | SERIAL | ✓ | PK |
| tournament_id | INTEGER | ✓ | FK → tournaments |
| day | SMALLINT | ✓ | `1`=1日目 / `2`=2日目 |
| group_number | SMALLINT | ✓ | 組番号（1〜） |
| position | SMALLINT | ✓ | 組内番号（1〜6） |
| member_code | VARCHAR(20) | | 会員番号（半角数字） |
| name | VARCHAR(100) | ✓ | 氏名 |
| belong | VARCHAR(100) | | 所属 |
| class | CHAR(1) | | `A` / `B` / `C` / `D` |
| is_judge | BOOLEAN | ✓ | 審判資格（⚑表示） |
| created_at | TIMESTAMPTZ | ✓ | 作成日時 |

**ユニーク制約：**
- `(tournament_id, day, group_number, position)` — 同組内番号重複禁止
- `(tournament_id, day, member_code)` — 同日程内会員番号重複禁止

---

## 3. scores（点数）

| カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|
| id | SERIAL | ✓ | PK |
| tournament_id | INTEGER | ✓ | FK → tournaments |
| member_code | VARCHAR(20) | ✓ | 会員番号 |
| name | VARCHAR(100) | | 氏名（表示用） |
| r1〜r4 | SMALLINT | | 1日目R1〜R4（0〜25、NULL=未入力） |
| r5〜r8 | SMALLINT | | 2日目R5〜R8（0〜25、NULL=未入力） |
| created_at | TIMESTAMPTZ | ✓ | 作成日時 |
| updated_at | TIMESTAMPTZ | ✓ | 更新日時（自動） |

**ユニーク制約：**
- `(tournament_id, member_code)` — 大会内で会員番号1件

---

## 4. v_results（成績ビュー）

SELECT専用のビュー。APIからそのまま参照する。

| カラム名 | 説明 |
|---|---|
| rank | 順位（同点は同順位） |
| member_code | 会員番号 |
| name | 氏名 |
| belong | 所属 |
| class | クラス |
| is_judge | 審判資格 |
| group1 / group2 | 1日目組 / 2日目組 |
| r1〜r8 | 各ラウンド点数 |
| day1_total | 1日目合計（R1+R2+R3+R4） |
| day2_total | 2日目合計（R5+R6+R7+R8） |
| total | 総合計 |
| average | 平均（入力済みラウンドのみ、小数第1位） |

---

## 設計上のポイント

### NULL vs 0 の扱い
- `r1〜r8` の `NULL` = **未入力**（0点とは別）
- 合計計算: `NULL` → `0` として扱う（COALESCE使用）
- 平均計算: `NULL` のラウンドは除外して計算

### 2日目対応
- `day2_date` が NULL → 1日目のみ
- `day2_date` に日付あり + `members.day=2` のデータあり → 2日目表示ON
- フロントで `has2ndDay` フラグを `EXISTS(SELECT 1 FROM members WHERE day=2)` で判定

### 会員番号なしのメンバー
- `member_code` は NULL 許容（氏名のみ登録も可）
- `scores` テーブルのキーは `member_code` のため、**点数入力には会員番号が必須**

### カスケード削除
- `tournaments` 削除 → `members`, `scores` も自動削除

---

## Neon セットアップ手順

1. [https://neon.tech](https://neon.tech) でプロジェクト作成
2. Connection String を `.env.local` に設定:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
   ```
3. スキーマ適用:
   ```bash
   psql $DATABASE_URL -f db/schema.sql
   ```
