-- 組発表機能: tournamentsテーブルにsquad_published_at, squad_commentを追加
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS squad_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS squad_comment TEXT;
