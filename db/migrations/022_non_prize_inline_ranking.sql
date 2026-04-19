-- 022: 賞典外を一覧に統合（順位は付けない）+ 2日目のみ選手も表示
--
-- 変更点
-- 1. day1 / day2 を FULL OUTER JOIN に変更 → 1日目のみ / 2日目のみ / 両日 すべて取得
-- 2. 賞典外 (is_non_prize = TRUE) は rank = NULL で返す（順位付けしない）
-- 3. 通常選手は従来どおり 合計DESC → カウントバック → CB → FR で RANK() 付与
-- 4. 表示順は API 側で total DESC として一覧に混ぜる

DROP VIEW IF EXISTS v_results;

CREATE VIEW v_results AS
WITH
day1_members AS (
  SELECT tournament_id, member_code, name, belong, class, is_judge, is_non_prize,
         group_number AS group1, position
  FROM members WHERE day = 1
),
day2_members AS (
  SELECT tournament_id, member_code, name, belong, class, is_judge, is_non_prize,
         group_number AS group2
  FROM members WHERE day = 2
),
-- FULL OUTER JOIN で 1日目のみ / 2日目のみ / 両日 すべて取得
-- 氏名・所属・クラス・審判・賞典外は day1 を優先、なければ day2 を使用
merged AS (
  SELECT
    COALESCE(d1.tournament_id, d2.tournament_id) AS tournament_id,
    COALESCE(d1.member_code,  d2.member_code)   AS member_code,
    COALESCE(d1.name,         d2.name)          AS name,
    COALESCE(d1.belong,       d2.belong)        AS belong,
    COALESCE(d1.class,        d2.class)         AS class,
    COALESCE(d1.is_judge,     d2.is_judge, FALSE)     AS is_judge,
    COALESCE(d1.is_non_prize, d2.is_non_prize, FALSE) AS is_non_prize,
    d1.group1,
    d1.position,
    d2.group2
  FROM day1_members d1
  FULL OUTER JOIN day2_members d2
    ON d1.tournament_id = d2.tournament_id AND d1.member_code = d2.member_code
),
combined AS (
  SELECT
    m.tournament_id, m.member_code, m.name, m.belong,
    m.class, m.is_judge, m.is_non_prize,
    m.group1, m.position, m.group2,
    s.r1, s.r2, s.r3, s.r4, s.r5, s.r6, s.r7, s.r8,
    s.cb, s.fr,
    COALESCE(s.status, 'valid') AS status,

    COALESCE(s.r1,0) + COALESCE(s.r2,0) + COALESCE(s.r3,0) + COALESCE(s.r4,0) AS day1_total,
    COALESCE(s.r5,0) + COALESCE(s.r6,0) + COALESCE(s.r7,0) + COALESCE(s.r8,0) AS day2_total,
    COALESCE(s.r1,0) + COALESCE(s.r2,0) + COALESCE(s.r3,0) + COALESCE(s.r4,0)
    + COALESCE(s.r5,0) + COALESCE(s.r6,0) + COALESCE(s.r7,0) + COALESCE(s.r8,0) AS total,

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
    ON m.tournament_id = s.tournament_id AND m.member_code = s.member_code
),
-- 通常選手のみ順位付け（賞典外・失格・棄権は除外）
valid_ranked AS (
  SELECT tournament_id, member_code,
    RANK() OVER (
      PARTITION BY tournament_id
      ORDER BY
        total DESC,
        COALESCE(r8, 0) DESC,
        COALESCE(r7, 0) DESC,
        COALESCE(r6, 0) DESC,
        COALESCE(r5, 0) DESC,
        COALESCE(r4, 0) DESC,
        COALESCE(r3, 0) DESC,
        COALESCE(r2, 0) DESC,
        COALESCE(r1, 0) DESC,
        COALESCE(cb, 999) ASC,
        COALESCE(fr, 0) DESC
    ) AS rank
  FROM combined
  WHERE status = 'valid' AND is_non_prize = FALSE
),
-- 失格・棄権・賞典外 は rank = NULL
final AS (
  SELECT c.*,
    CASE
      WHEN c.status IN ('disqualified', 'withdrawn') THEN NULL
      WHEN c.is_non_prize THEN NULL
      ELSE vr.rank
    END AS rank
  FROM combined c
  LEFT JOIN valid_ranked vr
    ON c.tournament_id = vr.tournament_id AND c.member_code = vr.member_code
)
SELECT * FROM final;

COMMENT ON VIEW v_results IS '成績集計ビュー（1日目/2日目/両日を FULL OUTER JOIN。賞典外は rank = NULL で一覧には含むが順位付けしない。失格・棄権も rank = NULL）';
