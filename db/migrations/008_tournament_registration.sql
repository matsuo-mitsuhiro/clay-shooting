-- 008_tournament_registration.sql
-- 大会申込機能用マイグレーション

-- tournaments テーブルに申込関連カラム追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_participants SMALLINT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS apply_start_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS apply_end_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cancel_end_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS competition_start_time TIME;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS gate_open_time TIME;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reception_start_time TIME;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS practice_clay_time TIME;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cancellation_notice TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS apply_qr TEXT;

-- 申込テーブル
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  member_code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  belong VARCHAR(100),
  email VARCHAR(200) NOT NULL,
  event_type VARCHAR(10) NOT NULL,
  participation_day VARCHAR(10) NOT NULL DEFAULT 'day1'
    CHECK (participation_day IN ('day1', 'day2', 'both')),
  class CHAR(1) CHECK (class IN ('A','B','C','D')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled')),
  cancelled_at TIMESTAMPTZ,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('user', 'admin')),
  cancelled_by_name VARCHAR(100),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON registrations (tournament_id);

-- 申込トークンテーブル
CREATE TABLE IF NOT EXISTS registration_tokens (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  email VARCHAR(200) NOT NULL,
  token VARCHAR(100) NOT NULL UNIQUE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('apply', 'cancel')),
  registration_id INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_tokens_token ON registration_tokens (token);

-- 申込ログテーブル
CREATE TABLE IF NOT EXISTS registration_logs (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  log_type VARCHAR(30) NOT NULL
    CHECK (log_type IN ('duplicate_error', 'cancel_by_user', 'cancel_by_admin')),
  member_code VARCHAR(20),
  email VARCHAR(200),
  note TEXT,
  admin_name VARCHAR(100),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_logs_tournament ON registration_logs (tournament_id);
