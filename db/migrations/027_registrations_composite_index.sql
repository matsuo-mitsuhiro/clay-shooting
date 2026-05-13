-- migration 027: registrations(tournament_id, member_code) 複合インデックス
-- v3.87: 申込重複チェック・会員番号同期などのホットパスを高速化
--
-- 影響を受けるクエリ:
--   - apply/submit: 申込時の重複チェック
--   - apply/continuous: 連続申込（複数日）の重複チェック
--   - registrations route: 手動追加時の重複チェック
--   - members/[memberId]: 会員番号変更時の同期
--   - registrations/[regId]/restore: 復元時の重複チェック
--
-- 既存の idx_registrations_tournament (tournament_id 単独) はそのまま残す。
-- 複合 index は tournament_id 単独でも prefix match で利用可能だが、
-- 既存クエリ計画の安定性を優先して二重持ちを許容。

CREATE INDEX IF NOT EXISTS idx_registrations_tournament_member
  ON registrations (tournament_id, member_code);
