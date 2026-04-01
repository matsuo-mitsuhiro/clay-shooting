-- ============================================================
-- Migration 007: 手動順位（manual_rank）追加 + FR優先順位・v_results 更新
-- ============================================================

-- scores テーブルに manual_rank カラム追加
ALTER TABLE scores ADD COLUMN manual_rank SMALLINT;

COMMENT ON COLUMN scores.manual_rank IS '手動順位（NULL=自動計算、設定時はこの値を優先）';

-- v_results ビューを再定義
-- 変更点:
--   1. FR優先: 順位計算を合計DESC → FR DESC → CB ASC に変更
--   2. manual_rank対応: 手動順位が設定されている場合はそれを使用
DROP VIEW IF EXISTS v_results;

CREATE VIEW v_results AS
WITH
day1_members AS (
  SELECT tournament_id, member_code, name, belong, class, is_judge, group_number AS group1
  FROM members WHERE day = 1
),
day2_members AS (
  SELECT tournament_id, member_code, group_number AS group2
  FROM members WHERE day = 2
),
merged AS (
  SELECT d1.tournament_id, d1.member_code, d1.name, d1.belong,
         d1.class, d1.is_judge, d1.group1, d2.group2
  FROM day1_members d1
  LEFT JOIN day2_members d2
    ON d1.tournament_id = d2.tournament_id AND d1.member_code = d2.member_code
),
combined AS (
  SELECT
    m.tournament_id, m.member_code, m.name, m.belong,
    m.class, m.is_judge, m.group1, m.group2,
    s.r1, s.r2, s.r3, s.r4, s.r5, s.r6, s.r7, s.r8,
    s.cb, s.fr,
    COALESCE(s.status, 'valid') AS status,
    s.manual_rank,
    COALESCE(s.r1,0)+COALESCE(s.r2,0)+COALESCE(s.r3,0)+COALESCE(s.r4,0) AS day1_total,
    COALESCE(s.r5,0)+COALESCE(s.r6,0)+COALESCE(s.r7,0)+COALESCE(s.r8,0) AS day2_total,
    COALESCE(s.r1,0)+COALESCE(s.r2,0)+COALESCE(s.r3,0)+COALESCE(s.r4,0)
    +COALESCE(s.r5,0)+COALESCE(s.r6,0)+COALESCE(s.r7,0)+COALESCE(s.r8,0) AS total,
    ROUND((
      COALESCE(s.r1::NUMERIC,0)+COALESCE(s.r2::NUMERIC,0)
      +COALESCE(s.r3::NUMERIC,0)+COALESCE(s.r4::NUMERIC,0)
      +COALESCE(s.r5::NUMERIC,0)+COALESCE(s.r6::NUMERIC,0)
      +COALESCE(s.r7::NUMERIC,0)+COALESCE(s.r8::NUMERIC,0)
    ) / NULLIF(
      (CASE WHEN s.r1 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r2 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r3 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r4 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r5 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r6 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r7 IS NOT NULL THEN 1 ELSE 0 END)
      +(CASE WHEN s.r8 IS NOT NULL THEN 1 ELSE 0 END)
    ,0),1) AS average
  FROM merged m
  LEFT JOIN scores s
    ON m.tournament_id = s.tournament_id AND m.member_code = s.member_code
),
-- 有効選手のみで自動順位付与（合計DESC → FR DESC → CB ASC）
valid_ranked AS (
  SELECT tournament_id, member_code,
    RANK() OVER (
      PARTITION BY tournament_id
      ORDER BY total DESC, COALESCE(fr,0) DESC, COALESCE(cb,999) ASC
    ) AS auto_rank
  FROM combined
  WHERE status = 'valid'
),
-- 失格・棄権=NULL、manual_rank優先、なければ自動計算
final AS (
  SELECT c.*,
    CASE
      WHEN c.status IN ('disqualified','withdrawn') THEN NULL
      WHEN c.manual_rank IS NOT NULL THEN c.manual_rank
      ELSE vr.auto_rank
    END AS rank
  FROM combined c
  LEFT JOIN valid_ranked vr
    ON c.tournament_id = vr.tournament_id AND c.member_code = vr.member_code
)
SELECT * FROM final;

COMMENT ON VIEW v_results IS '成績集計ビュー（合計・平均・順位・CB・FR・成績ステータス・手動順位対応）';
