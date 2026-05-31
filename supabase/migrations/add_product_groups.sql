-- product_groups テーブル（商品グループ）
CREATE TABLE IF NOT EXISTS product_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS を有効化
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全操作可能にするポリシー
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_groups' AND policyname = 'Authenticated users can select product_groups'
  ) THEN
    CREATE POLICY "Authenticated users can select product_groups" ON product_groups FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_groups' AND policyname = 'Authenticated users can insert product_groups'
  ) THEN
    CREATE POLICY "Authenticated users can insert product_groups" ON product_groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_groups' AND policyname = 'Authenticated users can update product_groups'
  ) THEN
    CREATE POLICY "Authenticated users can update product_groups" ON product_groups FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_groups' AND policyname = 'Authenticated users can delete product_groups'
  ) THEN
    CREATE POLICY "Authenticated users can delete product_groups" ON product_groups FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- products テーブルにグループ参照と並び順を追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES product_groups(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
