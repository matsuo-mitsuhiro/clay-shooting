-- ============================================================
-- Migration 025: tournaments.unused_slots カラム追加（空席設定）
--
-- 大会の組替モードで「使用しない射順」を保存する。
-- 例: 16名しかいない時の 2-6 / 3-6 を空席に設定。
--
-- 形式: [{"day": 1|2, "group": 1+, "position": 1-6}, ...]
-- ============================================================

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS unused_slots JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN tournaments.unused_slots IS
  '空席指定スロット。形式: [{"day": 1|2, "group": 1+, "position": 1-6}, ...]';
