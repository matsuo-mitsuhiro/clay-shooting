-- 閲覧者ログテーブル
CREATE TABLE IF NOT EXISTS viewer_logs (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  belong        VARCHAR(100),
  name_input    VARCHAR(100),
  matched_name  VARCHAR(100),
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_viewer_logs_tournament
  ON viewer_logs (tournament_id);

CREATE INDEX IF NOT EXISTS idx_viewer_logs_tournament_time
  ON viewer_logs (tournament_id, logged_at DESC);
