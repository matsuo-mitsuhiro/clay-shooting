-- Migration 019: AAAクラス追加 / player_master trap_class・skeet_class分離 / change_history / registration_tokens.member_code

-- 1. player_master: class → trap_class に改名、skeet_class・change_history 追加
ALTER TABLE player_master RENAME COLUMN class TO trap_class;
ALTER TABLE player_master ALTER COLUMN trap_class TYPE VARCHAR(3);
ALTER TABLE player_master ADD COLUMN IF NOT EXISTS skeet_class VARCHAR(3);
ALTER TABLE player_master ADD COLUMN IF NOT EXISTS change_history TEXT;

-- CHECK制約の更新
ALTER TABLE player_master DROP CONSTRAINT IF EXISTS player_master_class_check;
ALTER TABLE player_master ADD CONSTRAINT player_master_trap_class_check
  CHECK (trap_class IN ('AAA','AA','A','B','C'));
ALTER TABLE player_master ADD CONSTRAINT player_master_skeet_class_check
  CHECK (skeet_class IN ('AAA','AA','A','B','C'));

-- 2. members: class → VARCHAR(3)・CHECK制約に AAA 追加
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_class_check;
ALTER TABLE members ALTER COLUMN class TYPE VARCHAR(3);
ALTER TABLE members ADD CONSTRAINT members_class_check
  CHECK (class IN ('AAA','AA','A','B','C'));

-- 3. registrations: class → VARCHAR(3)・CHECK制約に AAA 追加
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_class_check;
ALTER TABLE registrations ALTER COLUMN class TYPE VARCHAR(3);
ALTER TABLE registrations ADD CONSTRAINT registrations_class_check
  CHECK (class IN ('AAA','AA','A','B','C'));

-- 4. registration_tokens: member_code 追加
ALTER TABLE registration_tokens ADD COLUMN IF NOT EXISTS member_code VARCHAR(20);
