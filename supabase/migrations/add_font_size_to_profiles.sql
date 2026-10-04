-- =============================================================
-- profiles テーブルに font_size カラムを追加
-- デフォルト値は 'small' (小)
-- =============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'small';
