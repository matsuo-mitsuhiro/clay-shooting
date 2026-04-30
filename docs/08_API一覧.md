# API一覧（v3.78.1 時点）

このドキュメントは `app/api/` 配下の全エンドポイントを列挙します。
詳細な実装は各 `route.ts` を参照してください。

---

## 認証要件の凡例

| 記号 | 意味 |
|------|------|
| 🔓 | 認証不要（公開API） |
| 🔐 | NextAuth セッション必須（middleware.ts で `/admin/*` を保護） |
| 🔑 | システム管理者のみ |
| 🎫 | ワンタイムトークンで認証（メール経由） |

> ⚠️ `/api/*` 自体は middleware の matcher から外れているため、
> 各 route.ts 内で `getServerSession()` による権限チェックが必要。

---

## 1. 認証関連

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET/POST | `/api/auth/[...nextauth]` | 🔓 | NextAuth 標準エンドポイント（callback含む） |
| POST | `/api/admin/register` | 🎫 | 招待トークン経由の運営管理者登録 |
| GET/POST/DELETE | `/api/admin/admins` | 🔑 | 運営管理者の一覧・作成・削除 |
| POST | `/api/admin/invitations` | 🔑 | 運営管理者の招待トークン発行 |
| POST | `/api/admin/password-reset` | 🔓 | パスワードリセット申請（メール送信） |
| POST | `/api/admin/password-reset/[token]` | 🎫 | パスワードリセット実行 |

---

## 2. 大会（Tournament）

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/tournaments` | 🔓 | 全大会取得（公開大会のみ）/ 🔐 で全件 |
| POST | `/api/tournaments` | 🔐 | 新規大会作成 |
| GET | `/api/tournaments/[id]` | 🔓 | 単一大会取得 |
| PUT | `/api/tournaments/[id]` | 🔐 | 大会情報更新 |
| DELETE | `/api/tournaments/[id]` | 🔐 | 大会削除（CASCADE） |
| POST | `/api/tournaments/[id]/reset` | 🔐 | リセット（members/scores削除） |
| GET | `/api/tournaments/[id]/apply-info` | 🔓 | 申込画面用情報取得（残数・主催協会名） |

---

## 3. 選手管理（Members）

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/tournaments/[id]/members` | 🔐 | 選手一覧取得 |
| POST | `/api/tournaments/[id]/members` | 🔐 | 一括保存（組単位） |
| GET | `/api/tournaments/[id]/members/[memberId]` | 🔐 | 単一選手の点数確認 |
| PATCH | `/api/tournaments/[id]/members/[memberId]` | 🔐 | 個別編集（所属・賞典外・会員番号） |
| DELETE | `/api/tournaments/[id]/members/[memberId]` | 🔐 | 選手削除（scores も連動削除） |
| GET | `/api/tournaments/[id]/members/by-code` | 🔐 | 会員番号で選手検索 |
| POST | `/api/tournaments/[id]/members/copy` | 🔐 | 1日目→2日目コピー |

---

## 4. 点数（Scores）

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/tournaments/[id]/scores` | 🔐 | 点数一覧取得 |
| POST | `/api/tournaments/[id]/scores` | 🔐 | 点数保存（組単位） |
| GET | `/api/tournaments/[id]/scores/ranking` | 🔓 | 順位付き成績取得 |
| PATCH | `/api/tournaments/[id]/scores/status` | 🔐 | ステータス変更（valid/disqualified/withdrawn） |
| GET | `/api/tournaments/[id]/results` | 🔓 | v_results ビュー取得 |

---

## 5. 申込（Registrations）

### 5.1 申込フロー（公開API）

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| POST | `/api/tournaments/[id]/apply/request-token` | 🔓 | 6桁コード発行 → メール送信 |
| GET | `/api/tournaments/[id]/apply/[token]` | 🎫 | 6桁コード検証 |
| POST | `/api/tournaments/[id]/apply/submit` | 🎫 | 申込確定 |
| POST | `/api/tournaments/[id]/apply/continuous` | 🎫 | 連続申込（同一メール他大会） |
| POST | `/api/tournaments/[id]/cancel/request-token` | 🔓 | キャンセルURL発行 |
| GET | `/api/tournaments/[id]/cancel/[token]` | 🎫 | キャンセルトークン検証 |
| POST | `/api/tournaments/[id]/cancel/submit` | 🎫 | キャンセル確定 |

### 5.2 申込管理（管理者API）

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/tournaments/[id]/registrations` | 🔐 | 申込一覧取得 |
| POST | `/api/tournaments/[id]/registrations` | 🔐 | 手動追加 |
| PATCH | `/api/tournaments/[id]/registrations/[regId]` | 🔐 | 編集（クラス・審判・参加日・会員番号） |
| DELETE | `/api/tournaments/[id]/registrations/[regId]` | 🔐 | 削除（手動登録のみ） |
| POST | `/api/tournaments/[id]/registrations/[regId]/cancel` | 🔐 | 管理者キャンセル |
| POST | `/api/tournaments/[id]/registrations/[regId]/restore` | 🔐 | 復元（cancelled→active） |
| POST | `/api/tournaments/[id]/registrations/transfer` | 🔐 | members への移行 |
| GET | `/api/tournaments/[id]/registrations/unregistered` | 🔐 | 未移行申込取得 |

---

## 6. 組発表・閲覧者ログイン

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/tournaments/[id]/squad` | 🔓 | 組発表データ取得 |
| POST | `/api/tournaments/[id]/squad` | 🔐 | 組発表（squad_published_at 設定） |
| POST | `/api/tournaments/[id]/viewer-login` | 🔓 | 閲覧者ログイン（自分の行ハイライト用） |

---

## 7. 記録審査・大会報告

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/tournaments/[id]/inspection-report` | 🔐 | 大会記録審査表Excelダウンロード |
| GET | `/api/tournaments/[id]/report` | 🔐 | 大会報告データ取得 |
| PUT | `/api/tournaments/[id]/report` | 🔐 | 大会報告データ保存 |
| GET | `/api/tournaments/[id]/report-excel` | 🔐 | 大会報告書Excelダウンロード |

> Excel生成は JSZip + XML 直接操作方式（テンプレートのロゴ・数式を保持）

---

## 8. マスター（Master Data）

### 8.1 協会

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/associations` | 🔓 | 全協会一覧（ドロップダウン用） |
| POST | `/api/associations` | 🔐 | 協会追加 |
| GET | `/api/associations/[cd]` | 🔓 | 単一協会取得 |
| PUT | `/api/associations/[cd]` | 🔐 | 協会更新（会長名・中止連絡方法等） |
| DELETE | `/api/associations/[cd]` | 🔐 | 削除 |

### 8.2 射撃場

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/shooting-ranges` | 🔓 | 全射撃場一覧 |
| POST | `/api/shooting-ranges` | 🔐 | 追加 |
| PUT | `/api/shooting-ranges/[id]` | 🔐 | 更新 |
| DELETE | `/api/shooting-ranges/[id]` | 🔐 | 削除 |

### 8.3 選手マスター

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/players` | 🔐 | 検索・一覧（運営管理者は所属で自動フィルター） |
| POST | `/api/players` | 🔐 | 追加 |
| GET | `/api/players/[code]` | 🔐 | 単一選手取得 |
| PUT | `/api/players/[code]` | 🔐 | 更新（trap_class/skeet_class） |
| PATCH | `/api/players/[code]` | 🔐 | 部分更新（change_history 自動追記） |
| DELETE | `/api/players/[code]` | 🔐 | 削除 |

---

## 9. 操作ログ

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/operation-logs` | 🔐 | ログ一覧（フィルター: `tournament_id`, `affiliation`, `action`） |

> 運営管理者は自所属のみ、システム管理者は全件

---

## 10. お問合せ・FAQ

### 10.1 公開API

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/faq` | 🔓 | FAQ一覧取得 |
| POST | `/api/support/questions` | 🔓 | お問合せ送信 |
| POST | `/api/support/request-token` | 🔓 | お問合せ用トークン発行 |
| POST | `/api/support/validate` | 🎫 | トークン検証 |

### 10.2 管理者API

| メソッド | パス | 認証 | 用途 |
|---------|------|------|------|
| GET | `/api/admin/support/questions` | 🔐 | 質問一覧取得 |
| POST | `/api/admin/support/answers` | 🔐 | 回答送信 |
| GET/POST/PUT/DELETE | `/api/admin/support/faq` | 🔐 | FAQ CRUD |
| POST | `/api/admin/support/tokens` | 🔐 | お問合せトークン発行 |

---

## 共通レスポンス形式

すべてのAPIは以下の形式で応答する（`lib/types.ts` の `ApiResponse<T>`）:

```typescript
{
  success: boolean;
  data?: T;        // 成功時
  error?: string;  // 失敗時
}
```

成功例:
```json
{ "success": true, "data": { "id": 1, "name": "..." } }
```

失敗例:
```json
{ "success": false, "error": "選手が見つかりません" }
```

---

## エラー時の動作

- **認証エラー**: 401 + `{ success: false, error: '認証が必要です' }`
- **権限エラー**: 403 + `{ success: false, error: 'この操作には権限がありません' }`
- **バリデーションエラー**: 400 + `{ success: false, error: '<具体的なメッセージ>' }`
- **DB/サーバーエラー**: 500 + `{ success: false, error: 'サーバーエラーが発生しました' }`

---

## API追加時のチェックリスト

新しい API を追加するときは以下を守る:

- [ ] `app/api/<path>/route.ts` を作成（Next.js App Router 規約）
- [ ] 認証が必要なら `getServerSession(authOptions)` で確認
- [ ] 運営管理者の場合、所属（`session.user.affiliation`）で絞り込み
- [ ] レスポンスは `ApiResponse<T>` 形式に統一
- [ ] 操作ログ対象なら `lib/operation-log.ts` の `writeOperationLog()` を呼ぶ
- [ ] このドキュメント（docs/08）に追記
