-- Migration 002: 選手マスターテーブル作成
-- 実行日: 2026-03-31

CREATE TABLE IF NOT EXISTS player_master (
  member_code  VARCHAR(20) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  affiliation  VARCHAR(50),
  is_judge     BOOLEAN NOT NULL DEFAULT FALSE,
  class        VARCHAR(5),
  updated_at   TIMESTAMPTZ
);
