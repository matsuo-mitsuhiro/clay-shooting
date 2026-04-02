-- Migration 011: registrations に source / transferred_at カラム追加
-- source: 'web'(デフォルト) or 'manual' — 登録元
-- transferred_at: 選手登録に移行した日時（NULLなら未移行）

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'web';

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

-- email を NULL 許容に変更（手動登録は email 不要のため空文字列で対応するが安全策）
-- 既存データは全て 'web' 扱い
