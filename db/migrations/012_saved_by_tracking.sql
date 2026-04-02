-- migration 012: 保存者・日時トラッキング用カラム追加
-- tournaments テーブルに info/apply 保存者・リセット者情報を追加

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS info_saved_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS info_saved_by VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS apply_saved_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS apply_saved_by VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reset_by VARCHAR(100);
