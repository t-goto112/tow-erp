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

-- profiles テーブルの RLS 抜根本体
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 既存の全ポリシーを完全に削除
DROP POLICY IF EXISTS "Profiles_Insert" ON profiles;
DROP POLICY IF EXISTS "Profiles_Select" ON profiles;
DROP POLICY IF EXISTS "Profiles_Update_Owner" ON profiles;
DROP POLICY IF EXISTS "Profiles_Admin_All" ON profiles;
DROP POLICY IF EXISTS "Allow select for authenticated" ON profiles;
DROP POLICY IF EXISTS "Allow update for owners" ON profiles;
DROP POLICY IF EXISTS "Allow all for admins" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;

-- 1. 閲覧: 認証済みユーザーなら誰でもOK (受注一覧などで名前を出すため)
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT USING (true);

-- 2. 作成/更新: 自分自身の行であればOK
CREATE POLICY "profiles_owner_policy" ON profiles 
  FOR ALL USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- 3. 管理者: すべての操作を許可 (無限再帰を避けるため auth.jwt を見るのが確実)
CREATE POLICY "profiles_admin_policy" ON profiles 
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR 
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- 4. 予備の管理者関数 (どうしてもJwtで取れない場合用)
CREATE OR REPLACE FUNCTION check_is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. トリガーを修正
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', '未設定'), 
    COALESCE(NEW.raw_app_meta_data->>'role', COALESCE(NEW.raw_user_meta_data->>'role', 'user'))
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. 既存ユーザーのメタデータを profiles に強制同期 (一度限り)
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id, raw_app_meta_data, raw_user_meta_data FROM auth.users LOOP
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
      u.id,
      COALESCE(u.raw_user_meta_data->>'full_name', '未設定'),
      COALESCE(u.raw_app_meta_data->>'role', COALESCE(u.raw_user_meta_data->>'role', 'user'))
    )
    ON CONFLICT (id) DO UPDATE SET
      role = COALESCE(u.raw_app_meta_data->>'role', COALESCE(u.raw_user_meta_data->>'role', public.profiles.role));
  END LOOP;
END $$;

-- 7. 全テーブルの RLS を再構築 (profiles 以外は authenticated full access)
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    IF tbl = 'profiles' THEN
      CONTINUE; -- profiles は個別に定義済み
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Authenticated full access" ON %I FOR ALL USING (auth.role() = ''authenticated'')', tbl);
  END LOOP;
END $$;

-- 完了確認
SELECT 'System fully restored with robust RLS and Metadata Sync v6' AS result;
