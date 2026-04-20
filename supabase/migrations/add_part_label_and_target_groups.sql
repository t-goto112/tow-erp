-- =============================================================
-- パーツ別組付けタイミング管理 + 在庫パーツ名表示
-- =============================================================

-- 1. processes テーブルにパーツ名と組付け対象グループを追加
ALTER TABLE processes ADD COLUMN IF NOT EXISTS part_label TEXT;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS target_group_indexes JSONB DEFAULT '[]';

-- 2. inventory テーブルにパーツ識別情報を追加
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS part_label TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_group_index INT;
