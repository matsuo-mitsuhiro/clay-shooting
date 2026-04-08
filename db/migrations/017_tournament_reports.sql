-- 017: 大会報告機能
-- associations に会長名カラム追加
ALTER TABLE associations ADD COLUMN IF NOT EXISTS president_name VARCHAR(100);

-- 大会報告テーブル
CREATE TABLE IF NOT EXISTS tournament_reports (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  paired_tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  report_date     DATE,
  certification_fee INTEGER NOT NULL DEFAULT 50000,
  advertising_fee INTEGER NOT NULL DEFAULT 5000,
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 奨励金獲得者テーブル
CREATE TABLE IF NOT EXISTS report_incentives (
  id              SERIAL PRIMARY KEY,
  report_id       INTEGER NOT NULL REFERENCES tournament_reports(id) ON DELETE CASCADE,
  event_type      VARCHAR(10) NOT NULL,
  straight_type   INTEGER NOT NULL,
  player_name     VARCHAR(100),
  member_code     VARCHAR(20),
  belong          VARCHAR(100),
  amount          INTEGER NOT NULL DEFAULT 0,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at トリガー
CREATE OR REPLACE TRIGGER trg_tournament_reports_updated_at
  BEFORE UPDATE ON tournament_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
