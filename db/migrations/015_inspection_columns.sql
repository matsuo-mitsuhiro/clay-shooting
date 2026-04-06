-- Migration 015: 記録審査カラム追加
-- tournaments テーブルに記録審査用の9カラムを追加

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_type VARCHAR(30) DEFAULT 'ISSF（地方公式版）';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS weather VARCHAR(50);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS temperature VARCHAR(20);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS wind_speed VARCHAR(20);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS chief_judge VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS operation_manager VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS record_manager VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS set_checker VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS clay_name VARCHAR(100);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS class_division VARCHAR(10) DEFAULT 'none';
