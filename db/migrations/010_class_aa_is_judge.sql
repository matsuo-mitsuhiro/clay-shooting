-- Migration 010: クラス'AA'追加・'D'削除、申込テーブルにis_judge追加

-- members.class: CHAR(1) → VARCHAR(2), CHECK更新
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_class_check;
ALTER TABLE members ALTER COLUMN class TYPE VARCHAR(2);
ALTER TABLE members ADD CONSTRAINT members_class_check CHECK (class IN ('AA','A','B','C'));

-- registrations.class: CHAR(1) → VARCHAR(2), CHECK更新
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_class_check;
ALTER TABLE registrations ALTER COLUMN class TYPE VARCHAR(2);
ALTER TABLE registrations ADD CONSTRAINT registrations_class_check CHECK (class IN ('AA','A','B','C'));

-- registrations.is_judge追加
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_judge BOOLEAN NOT NULL DEFAULT false;
