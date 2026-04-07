-- 016: カウントバック順位計算
-- 合計同点時に最終ラウンドから逆順比較（R8→R7→...→R1）で順位決定
-- トラップ・スキート共通ルール

DROP VIEW IF EXISTS v_results;

CREATE VIEW v_results AS
WITH
-- 1日目メンバー
day1_members AS (
  SELECT tournament_id, member_code, name, belong, class, is_judge, group_number AS group1, position
  FROM members WHERE day = 1
),
-- 2日目メンバー（存在する場合）
day2_members AS (
  SELECT tournament_id, member_code, group_number AS group2
  FROM members WHERE day = 2
),
-- メンバー結合
merged AS (
  SELECT d1.tournament_id, d1.member_code, d1.name, d1.belong,
         d1.class, d1.is_judge, d1.group1, d1.position, d2.group2
  FROM day1_members d1
  LEFT JOIN day2_members d2
    ON d1.tournament_id = d2.tournament_id AND d1.member_code = d2.member_code
),
-- 点数結合・集計
combined AS (
  SELECT
    m.tournament_id, m.member_code, m.name, m.belong,
    m.class, m.is_judge, m.group1, m.position, m.group2,
    s.r1, s.r2, s.r3, s.r4, s.r5, s.r6, s.r7, s.r8,
    s.cb, s.fr,
    COALESCE(s.status, 'valid') AS status,

    -- 1日目合計
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
    ON m.tournament_id = s.tournament_id AND m.member_code = s.member_code
),
-- 有効選手のみで順位付与
-- 合計DESC → カウントバック（R8→R7→R6→R5→R4→R3→R2→R1 DESC） → CB ASC → FR DESC
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
  WHERE status = 'valid'
),
-- 失格・棄権は rank = NULL で最下位扱い
final AS (
  SELECT c.*,
    CASE
      WHEN c.status IN ('disqualified', 'withdrawn') THEN NULL
      ELSE vr.rank
    END AS rank
  FROM combined c
  LEFT JOIN valid_ranked vr
    ON c.tournament_id = vr.tournament_id AND c.member_code = vr.member_code
)
SELECT * FROM final;

COMMENT ON VIEW v_results IS '成績集計ビュー（合計・平均・カウントバック順位・CB・FR・成績ステータス付き）';
