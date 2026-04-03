-- 操作ログテーブル（大会非依存、FK制約なし＝大会削除後もログ残る）
CREATE TABLE IF NOT EXISTS operation_logs (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER,
  tournament_name TEXT,
  logged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  admin_name TEXT,
  admin_affiliation TEXT,
  action TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX idx_operation_logs_tournament ON operation_logs (tournament_id);
CREATE INDEX idx_operation_logs_logged_at ON operation_logs (logged_at DESC);
CREATE INDEX idx_operation_logs_action ON operation_logs (action);
