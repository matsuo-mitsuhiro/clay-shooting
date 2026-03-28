-- ============================================================
-- クレー射撃大会 成績管理システム
-- データベーススキーマ (PostgreSQL / Neon)
-- ============================================================

-- ============================================================
-- 1. 大会情報テーブル (tournaments)
-- ============================================================
CREATE TABLE tournaments (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,           -- 大会名
  venue         VARCHAR(200),                    -- 射撃場名
  day1_date     DATE,                            -- 1日目日付
  day2_date     DATE,                            -- 2日目日付（任意）
  event_type    VARCHAR(10) NOT NULL DEFAULT 'trap'
                  CHECK (event_type IN ('trap', 'skeet')), -- 種目
  day1_set      VARCHAR(100),                   -- 1日目セット番号（例：「1番セット」）
  day2_set      VARCHAR(100),                   -- 2日目セット番号（例：「10番セット裏」）
  admin_qr      TEXT,                            -- 管理者用QRコード（Base64画像）
  viewer_qr     TEXT,                            -- 閲覧者用QRコード（Base64画像）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  tournaments         IS '大会情報';
COMMENT ON COLUMN tournaments.name        IS '大会名';
COMMENT ON COLUMN tournaments.venue       IS '射撃場名';
COMMENT ON COLUMN tournaments.day1_date   IS '1日目日付';
COMMENT ON COLUMN tournaments.day2_date   IS '2日目日付（未設定可）';
COMMENT ON COLUMN tournaments.event_type  IS '種目：trap（トラップ）/ skeet（スキート）';
COMMENT ON COLUMN tournaments.day1_set    IS '1日目セット番号表示文字列';
COMMENT ON COLUMN tournaments.day2_set    IS '2日目セット番号表示文字列';
COMMENT ON COLUMN tournaments.admin_qr    IS '管理者用QRコード（Base64エンコード画像）';
COMMENT ON COLUMN tournaments.viewer_qr   IS '閲覧者用QRコード（Base64エンコード画像）';


-- ============================================================
-- 2. メンバーテーブル (members)
-- ============================================================
CREATE TABLE members (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER      NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  day           SMALLINT     NOT NULL CHECK (day IN (1, 2)),       -- 日程（1日目 or 2日目）
  group_number  SMALLINT     NOT NULL CHECK (group_number >= 1),   -- 組番号（1〜N）
  position      SMALLINT     NOT NULL CHECK (position BETWEEN 1 AND 6), -- 組内番号（1〜6）
  member_code   VARCHAR(20),                                         -- 会員番号（半角数字）
  name          VARCHAR(100) NOT NULL,                               -- 氏名
  belong        VARCHAR(100),                                        -- 所属団体
  class         CHAR(1)      CHECK (class IN ('A','B','C','D')),     -- クラス
  is_judge      BOOLEAN      NOT NULL DEFAULT FALSE,                 -- 審判資格（⚑表示）
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- 同一大会・日程・組・番号の重複禁止
  UNIQUE (tournament_id, day, group_number, position),

  -- 同一大会・日程内での会員番号重複禁止（会員番号がある場合のみ）
  UNIQUE (tournament_id, day, member_code)
);

CREATE INDEX idx_members_tournament_day ON members (tournament_id, day);
CREATE INDEX idx_members_tournament_day_group ON members (tournament_id, day, group_number);

COMMENT ON TABLE  members                 IS 'メンバー登録（日程別）';
COMMENT ON COLUMN members.tournament_id   IS '大会ID（FK）';
COMMENT ON COLUMN members.day             IS '日程：1=1日目 / 2=2日目';
COMMENT ON COLUMN members.group_number    IS '組番号（1以上）';
COMMENT ON COLUMN members.position        IS '組内番号（1〜6）';
COMMENT ON COLUMN members.member_code     IS '会員番号（半角数字、NULL可）';
COMMENT ON COLUMN members.name            IS '氏名';
COMMENT ON COLUMN members.belong          IS '所属団体';
COMMENT ON COLUMN members.class           IS 'クラス：A / B / C / D';
COMMENT ON COLUMN members.is_judge        IS '審判資格フラグ（trueで⚑表示）';


-- ============================================================
-- 3. 点数テーブル (scores)
-- ============================================================
CREATE TABLE scores (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER      NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  member_code   VARCHAR(20)  NOT NULL,    -- 会員番号（メンバーと紐付けキー）
  name          VARCHAR(100),             -- 氏名（表示補助用）
  r1            SMALLINT     CHECK (r1 BETWEEN 0 AND 25),  -- R1点数（NULL=未入力）
  r2            SMALLINT     CHECK (r2 BETWEEN 0 AND 25),
  r3            SMALLINT     CHECK (r3 BETWEEN 0 AND 25),
  r4            SMALLINT     CHECK (r4 BETWEEN 0 AND 25),
  r5            SMALLINT     CHECK (r5 BETWEEN 0 AND 25),  -- R5（2日目）
  r6            SMALLINT     CHECK (r6 BETWEEN 0 AND 25),
  r7            SMALLINT     CHECK (r7 BETWEEN 0 AND 25),
  r8            SMALLINT     CHECK (r8 BETWEEN 0 AND 25),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (tournament_id, member_code)
);

CREATE INDEX idx_scores_tournament ON scores (tournament_id);

COMMENT ON TABLE  scores               IS '射撃点数（R1〜R8）';
COMMENT ON COLUMN scores.tournament_id IS '大会ID（FK）';
COMMENT ON COLUMN scores.member_code   IS '会員番号（NULLなし）';
COMMENT ON COLUMN scores.r1            IS '1日目ラウンド1（NULL=未入力、0=0点）';
COMMENT ON COLUMN scores.r5            IS '2日目ラウンド1（NULL=未入力）';


-- ============================================================
-- 4. 成績ビュー (v_results)
--    メンバー + 点数を結合し、合計・平均・順位を算出
-- ============================================================
CREATE OR REPLACE VIEW v_results AS
WITH
-- 1日目メンバー
day1_members AS (
  SELECT
    tournament_id,
    member_code,
    name,
    belong,
    class,
    is_judge,
    group_number AS group1
  FROM members
  WHERE day = 1
),
-- 2日目メンバー（存在する場合）
day2_members AS (
  SELECT
    tournament_id,
    member_code,
    group_number AS group2
  FROM members
  WHERE day = 2
),
-- メンバー結合
merged AS (
  SELECT
    d1.tournament_id,
    d1.member_code,
    d1.name,
    d1.belong,
    d1.class,
    d1.is_judge,
    d1.group1,
    d2.group2
  FROM day1_members d1
  LEFT JOIN day2_members d2
    ON d1.tournament_id = d2.tournament_id
   AND d1.member_code   = d2.member_code
),
-- 点数結合・集計
combined AS (
  SELECT
    m.tournament_id,
    m.member_code,
    m.name,
    m.belong,
    m.class,
    m.is_judge,
    m.group1,
    m.group2,
    s.r1, s.r2, s.r3, s.r4,
    s.r5, s.r6, s.r7, s.r8,

    -- 1日目合計（NULLは0として加算）
    COALESCE(s.r1,0) + COALESCE(s.r2,0) + COALESCE(s.r3,0) + COALESCE(s.r4,0) AS day1_total,

    -- 2日目合計
    COALESCE(s.r5,0) + COALESCE(s.r6,0) + COALESCE(s.r7,0) + COALESCE(s.r8,0) AS day2_total,

    -- 総合計
    COALESCE(s.r1,0) + COALESCE(s.r2,0) + COALESCE(s.r3,0) + COALESCE(s.r4,0)
    + COALESCE(s.r5,0) + COALESCE(s.r6,0) + COALESCE(s.r7,0) + COALESCE(s.r8,0) AS total,

    -- 平均（入力済みラウンドのみ。NULLは除外）
    ROUND(
      (
        COALESCE(s.r1::NUMERIC, 0) + COALESCE(s.r2::NUMERIC, 0)
        + COALESCE(s.r3::NUMERIC, 0) + COALESCE(s.r4::NUMERIC, 0)
        + COALESCE(s.r5::NUMERIC, 0) + COALESCE(s.r6::NUMERIC, 0)
        + COALESCE(s.r7::NUMERIC, 0) + COALESCE(s.r8::NUMERIC, 0)
      ) / NULLIF(
        (CASE WHEN s.r1 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r2 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r3 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r4 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r5 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r6 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r7 IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN s.r8 IS NOT NULL THEN 1 ELSE 0 END)
      , 0),
    1) AS average

  FROM merged m
  LEFT JOIN scores s
    ON m.tournament_id = s.tournament_id
   AND m.member_code   = s.member_code
),
-- 順位付与（同点同順位、次位は飛ばす）
ranked AS (
  SELECT
    *,
    RANK() OVER (PARTITION BY tournament_id ORDER BY total DESC) AS rank
  FROM combined
)
SELECT * FROM ranked;

COMMENT ON VIEW v_results IS '成績集計ビュー（合計・平均・順位付き）';


-- ============================================================
-- 5. updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
