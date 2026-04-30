-- ============================================================
-- Migration 024: マイグレーション適用履歴テーブル新設
--
-- 目的:
--   3環境（local / staging / production）で migration を自動実行する際に、
--   どのファイルまで適用済かを DB 自身で記録する。
--   `scripts/run-migrations.js` がこのテーブルを読み書きする。
--
-- 既存DBに対する影響:
--   - 既に 001〜023 が適用済の DB（本番、本番から派生したstaging branch等）
--     に対しては、ON CONFLICT DO NOTHING により実害なくバックフィル
--   - 完全に新規の DB に対しては、既存マイグレーションを別途流したあとに
--     このマイグレーションを適用すること
-- ============================================================

CREATE TABLE IF NOT EXISTS _migrations (
  filename   VARCHAR(200) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE _migrations IS 'マイグレーション適用履歴（scripts/run-migrations.js が自動管理）';

-- ============================================================
-- 既存23マイグレーションを「適用済」としてバックフィル
-- 本番および本番派生 branch では既に内容が反映されているため、
-- ファイル名だけを履歴に残す
-- ============================================================
INSERT INTO _migrations (filename) VALUES
  ('001_add_organizer_cd.sql'),
  ('002_create_player_master.sql'),
  ('003_create_viewer_logs.sql'),
  ('004_admin_auth.sql'),
  ('005_invitations_password_reset.sql'),
  ('006_add_cb_fr_status.sql'),
  ('007_add_manual_rank_fr_priority.sql'),
  ('008_tournament_registration.sql'),
  ('009_associations_shooting_ranges.sql'),
  ('010_class_aa_is_judge.sql'),
  ('011_registration_source_transferred.sql'),
  ('012_saved_by_tracking.sql'),
  ('013_operation_logs.sql'),
  ('014_add_position_to_v_results.sql'),
  ('015_inspection_columns.sql'),
  ('016_countback_ranking.sql'),
  ('017_tournament_reports.sql'),
  ('018_squad_announcement.sql'),
  ('019_class_aaa_trap_skeet_history.sql'),
  ('020_add_non_prize.sql'),
  ('021_affiliation_normalize.sql'),
  ('022_non_prize_inline_ranking.sql'),
  ('023_drop_viewer_logs.sql')
ON CONFLICT (filename) DO NOTHING;
