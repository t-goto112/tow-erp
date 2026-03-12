-- =============================================================
-- TOWMEI ERP — 最終システム構築 SQL (Supabase SQL Editor 専用)
-- =============================================================
-- 【重要】このスクリプトは、全テーブルの作成、権限(RLS)の完全開放、
-- および詳細な権限管理のためのカラム追加を一度に行います。

-- ─── 0. profiles テーブルの拡張（権限管理用） ───
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  permissions JSONB DEFAULT '{}'::jsonb, -- ページ別の権限 { "dashboard": {"view": true, "edit": false}, ... }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- もし既存の profiles に permissions がなければ追加
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── 1. 基本テーブル群作成 ───
-- 商品マスタ
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  material_cost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 工程マスタ
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  group_index INT NOT NULL DEFAULT 0,
  is_parallel BOOLEAN DEFAULT FALSE,
  is_assembly_point BOOLEAN DEFAULT FALSE,
  parallel_group TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 外注先
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 単価設定
CREATE TABLE IF NOT EXISTS process_subcontractor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  unit_price NUMERIC(10,2) NOT NULL,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  UNIQUE(process_id, subcontractor_id, effective_from)
);

-- 受注
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('ec','wholesale','direct')),
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2)
);

-- ロット
CREATE TABLE IF NOT EXISTS lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id),
  order_item_id UUID REFERENCES order_items(id),
  quantity INT NOT NULL,
  parent_lot_id UUID REFERENCES lots(id),
  split_type TEXT DEFAULT 'none' CHECK (split_type IN ('none','split','merge')),
  status TEXT DEFAULT 'created' CHECK (status IN ('created','in_progress','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 工程実績
CREATE TABLE IF NOT EXISTS lot_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
  process_id UUID REFERENCES processes(id),
  subcontractor_id UUID REFERENCES subcontractors(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rework')),
  input_quantity INT NOT NULL DEFAULT 0,
  completed_quantity INT DEFAULT 0,
  defect_quantity INT DEFAULT 0,
  loss_qty INT DEFAULT 0,
  loss_confirmed BOOLEAN DEFAULT FALSE,
  unit_price_override NUMERIC(10,2),
  is_rework BOOLEAN DEFAULT FALSE,
  rework_charge BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lot_process_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_process_id UUID REFERENCES lot_processes(id) ON DELETE CASCADE,
  qty INT NOT NULL,
  delivery_date DATE,
  completion_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lot_process_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_process_id UUID REFERENCES lot_processes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- 支払
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID REFERENCES subcontractors(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'wip' CHECK (status IN ('wip','pre_payment','paid','confirmed')),
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  lot_process_id UUID REFERENCES lot_processes(id),
  good_quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 通知
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 倉庫・在庫
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  lot_id UUID REFERENCES lots(id),
  item_type TEXT CHECK (item_type IN ('product', 'material', 'parts')),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  change_type TEXT CHECK (change_type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. Auth連動トリガー ───
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, permissions)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name','未設定'), 'user', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── 3. RLS (Row Level Security) の完全開放 ───
-- 全テーブルに対して認証済みユーザーのフルアクセスを許可
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    -- RLSを有効化
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    
    -- 既存の全ポリシーを一度削除
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated insert" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated update" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated delete" ON %I', tbl);
    
    -- シンプルなフルアクセスポリシーを作成
    EXECUTE format('CREATE POLICY "Authenticated full access" ON %I FOR ALL USING (auth.role() = ''authenticated'')', tbl);
  END LOOP;
END $$;

-- profiles テーブルだけは特別な管理者ポリシーを追加（自分または管理者が更新可能）
DROP POLICY IF EXISTS "Authenticated full access" ON profiles;
CREATE POLICY "Profiles access" ON profiles FOR ALL USING (
  auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 完了確認
SELECT 'System tables and RLS fully configured!' AS result;
