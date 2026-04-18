-- ============================================================
-- Migration 021: 所属協会名の短縮化 + 正式名称マスター追加
-- ============================================================
-- 目的:
--   1) associations テーブルに formal_name カラムを追加し、48件分の正式名称を登録
--   2) player_master.affiliation を短縮名に統一（"大阪府クレー射撃協会" → "大阪"）
--   3) members.belong も同様に短縮名に統一
-- ============================================================

-- 1) associations に formal_name カラムを追加
ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS formal_name VARCHAR(50);

-- 2) 48件分の正式名称を登録
UPDATE associations SET formal_name = CASE name
  WHEN '北海道' THEN '北海道クレー射撃協会'
  WHEN '東京'   THEN '東京都クレー射撃協会'
  WHEN '大阪'   THEN '大阪府クレー射撃協会'
  WHEN '京都'   THEN '京都府クレー射撃協会'
  WHEN '芸文'   THEN '芸能文化人ガンクラブ'
  ELSE name || '県クレー射撃協会'
END
WHERE formal_name IS NULL;

-- 3) player_master.affiliation を短縮名に正規化
UPDATE player_master SET affiliation = CASE
  WHEN affiliation = '北海道クレー射撃協会' THEN '北海道'
  WHEN affiliation = '東京都クレー射撃協会' THEN '東京'
  WHEN affiliation = '芸能文化人ガンクラブ' THEN '芸文'
  WHEN affiliation ~ '^.+府クレー射撃協会$' THEN regexp_replace(affiliation, '府クレー射撃協会$', '')
  WHEN affiliation ~ '^.+県クレー射撃協会$' THEN regexp_replace(affiliation, '県クレー射撃協会$', '')
  ELSE affiliation
END
WHERE affiliation IS NOT NULL;

-- 4) members.belong も同様に短縮
UPDATE members SET belong = CASE
  WHEN belong = '北海道クレー射撃協会' THEN '北海道'
  WHEN belong = '東京都クレー射撃協会' THEN '東京'
  WHEN belong = '芸能文化人ガンクラブ' THEN '芸文'
  WHEN belong ~ '^.+府クレー射撃協会$' THEN regexp_replace(belong, '府クレー射撃協会$', '')
  WHEN belong ~ '^.+県クレー射撃協会$' THEN regexp_replace(belong, '県クレー射撃協会$', '')
  ELSE belong
END
WHERE belong IS NOT NULL;

-- 5) registrations.belong も同様に短縮（申込テーブル）
UPDATE registrations SET belong = CASE
  WHEN belong = '北海道クレー射撃協会' THEN '北海道'
  WHEN belong = '東京都クレー射撃協会' THEN '東京'
  WHEN belong = '芸能文化人ガンクラブ' THEN '芸文'
  WHEN belong ~ '^.+府クレー射撃協会$' THEN regexp_replace(belong, '府クレー射撃協会$', '')
  WHEN belong ~ '^.+県クレー射撃協会$' THEN regexp_replace(belong, '県クレー射撃協会$', '')
  ELSE belong
END
WHERE belong IS NOT NULL;
