-- ============================================================
-- VRT (Visual Regression Test) 固定 fixture
--
-- 用途: vrt-baseline Neon branch に投入し、CI から DATABASE_URL=$VRT_DATABASE_URL
--       で接続して安定した screenshot baseline を取るためのデータ。
--
-- 適用方法:
--   VRT_DATABASE_URL=<vrt-baseline branch 接続文字列> \
--     node scripts/vrt-seed.js
--
-- 注意:
--   - 個人情報を含む production-copy データを TRUNCATE してから固定 fixture を INSERT する
--   - 日付はすべて 2099 年（遠未来）で固定 → 「current 大会」判定が常に true、申込期間内
--   - 大会 ID = 1 固定（VRT spec は /viewer/1 や /tournaments/1/apply を URL に埋め込む）
--   - schema 変更時はこの fixture も追従が必要（migration を追加したら確認）
-- ============================================================

BEGIN;

-- ---------- 全削除（_migrations と faq_items 以外）----------
TRUNCATE TABLE
  operation_logs,
  password_reset_attempts,
  password_reset_tokens,
  admin_logs,
  admin_invitations,
  support_answers,
  support_questions,
  support_tokens,
  report_incentives,
  tournament_reports,
  registration_logs,
  registration_tokens,
  registrations,
  scores,
  members,
  tournament_admins,
  tournaments,
  player_master,
  association_shooting_ranges,
  shooting_ranges,
  associations
RESTART IDENTITY CASCADE;

-- ---------- 協会マスター ----------
INSERT INTO associations (cd, name, formal_name, president_name)
VALUES (99, 'VRT', 'VRT サンプル協会', 'VRT 会長');

-- ---------- 射撃場マスター ----------
INSERT INTO shooting_ranges (id, prefecture, name)
VALUES (1, 'VRT', 'VRT サンプル射撃場');

INSERT INTO association_shooting_ranges (association_cd, shooting_range_id)
VALUES (99, 1);

-- ---------- 大会（1 件、3 画面の baseline 兼用）----------
-- 2099 年に設定：大会一覧で current 扱い・申込期間内
INSERT INTO tournaments (
  id, name, venue, day1_date, day2_date, event_type, organizer_cd,
  is_public, max_participants,
  apply_start_at, apply_end_at, cancel_end_at,
  competition_start_time, gate_open_time, reception_start_time,
  rule_type, class_division
) VALUES (
  1,
  'VRT サンプル大会',
  'VRT サンプル射撃場',
  '2099-12-31', NULL,
  'trap', 99,
  TRUE, 60,
  '2099-01-01 00:00:00+09', '2099-12-30 17:00:00+09', '2099-12-30 12:00:00+09',
  '09:00', '07:00', '08:00',
  'ISSF（地方公式版）', 'none'
);

-- ---------- メンバー（1 組 6 名）----------
INSERT INTO members (tournament_id, day, group_number, position, member_code, name, belong, class, is_judge)
VALUES
  (1, 1, 1, 1, '900001', 'サンプル 太郎', 'VRT', 'A', TRUE),
  (1, 1, 1, 2, '900002', 'サンプル 次郎', 'VRT', 'B', FALSE),
  (1, 1, 1, 3, '900003', 'サンプル 三郎', 'VRT', 'C', FALSE),
  (1, 1, 1, 4, '900004', 'サンプル 四郎', 'VRT', 'AA', FALSE),
  (1, 1, 1, 5, '900005', 'サンプル 五郎', 'VRT', 'B', TRUE),
  (1, 1, 1, 6, '900006', 'サンプル 六郎', 'VRT', 'AAA', FALSE);

-- ---------- スコア（R1 のみ入力、閲覧者画面で成績順表示）----------
INSERT INTO scores (tournament_id, member_code, name, r1, status)
VALUES
  (1, '900001', 'サンプル 太郎', 25, 'valid'),
  (1, '900002', 'サンプル 次郎', 23, 'valid'),
  (1, '900003', 'サンプル 三郎', 20, 'valid'),
  (1, '900004', 'サンプル 四郎', 22, 'valid'),
  (1, '900005', 'サンプル 五郎', 18, 'valid'),
  (1, '900006', 'サンプル 六郎', 24, 'valid');

-- ---------- 申込（2 件、申込ページの申込状況「2名/60名」表示用）----------
INSERT INTO registrations (
  tournament_id, member_code, name, belong, email, event_type,
  participation_day, class, is_judge, status, source
)
VALUES
  (1, '900007', 'サンプル 七郎', 'VRT', 'vrt7@example.invalid', 'trap', 'day1', 'C', FALSE, 'active', 'web'),
  (1, '900008', 'サンプル 八郎', 'VRT', 'vrt8@example.invalid', 'trap', 'day1', 'B', FALSE, 'active', 'web');

-- ---------- シーケンス調整 ----------
SELECT setval('tournaments_id_seq', (SELECT MAX(id) FROM tournaments));
SELECT setval('shooting_ranges_id_seq', (SELECT MAX(id) FROM shooting_ranges));
SELECT setval('members_id_seq', (SELECT MAX(id) FROM members));
SELECT setval('scores_id_seq', (SELECT MAX(id) FROM scores));
SELECT setval('registrations_id_seq', (SELECT MAX(id) FROM registrations));

COMMIT;
