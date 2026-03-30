-- Migration 001: tournamentsテーブルに主催CDカラムを追加
-- 実行場所: Neon ダッシュボード > SQL Editor
-- 実行日: 2026-03-30

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS organizer_cd INTEGER DEFAULT 27;

COMMENT ON COLUMN tournaments.organizer_cd IS '主催CD: 25=滋賀, 26=京都, 27=大阪, 28=兵庫, 29=奈良, 30=和歌山';
