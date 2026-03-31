-- ============================================================
-- 管理者認証システム用マイグレーション
-- ============================================================

-- tournaments テーブルに非公開フラグ追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

-- 大会管理者マスター
CREATE TABLE IF NOT EXISTS tournament_admins (
  id            SERIAL PRIMARY KEY,
  member_code   VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_admins_member_code
  ON tournament_admins (member_code);

CREATE INDEX IF NOT EXISTS idx_tournament_admins_email
  ON tournament_admins (email);

-- 管理者ログイン履歴
CREATE TABLE IF NOT EXISTS admin_logs (
  id          SERIAL PRIMARY KEY,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_type  VARCHAR(20) NOT NULL,  -- 'system' | 'tournament'
  name        VARCHAR(100),
  affiliation VARCHAR(100),
  email       VARCHAR(200),
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_logged_at
  ON admin_logs (logged_at DESC);
