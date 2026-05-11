-- migration 026: パスワードリセット試行ログ（レート制限用）
-- v3.84: ユーザー列挙攻撃対策 + UX改善のため、IP単位で1時間あたり5回までに制限

CREATE TABLE IF NOT EXISTS password_reset_attempts (
  id         SERIAL PRIMARY KEY,
  ip         TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- レート制限の集計クエリで使う複合インデックス
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_ip_created
  ON password_reset_attempts (ip, created_at);
