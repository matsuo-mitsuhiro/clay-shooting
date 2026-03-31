-- 大会管理者招待トークン
CREATE TABLE IF NOT EXISTS admin_invitations (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_by VARCHAR(20),       -- 発行者の member_code（null = システム管理者）
  affiliation VARCHAR(100),     -- 発行者の所属
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- パスワードリセットトークン
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  admin_id INTEGER NOT NULL REFERENCES tournament_admins(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
