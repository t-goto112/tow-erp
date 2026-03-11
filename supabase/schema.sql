-- =============================================================
-- TOWMEI ERP — Supabase DB Schema (Run in SQL Editor)
-- =============================================================

-- ─── 1. profiles (Supabase Auth 連携) ───
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 新規ユーザー作成時に自動 insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name','未設定'), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── 2. 商品マスタ ───
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  material_cost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. 工程マスタ ───
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  group_index INT NOT NULL DEFAULT 0, -- メイン工程、工程登録2などのグループ
  is_parallel BOOLEAN DEFAULT FALSE,
  is_assembly_point BOOLEAN DEFAULT FALSE, -- パーツ組付けポイントフラグ
  parallel_group TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. 外注先マスタ ───
CREATE TABLE subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. 工程×外注先×単価 ───
CREATE TABLE process_subcontractor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  unit_price NUMERIC(10,2) NOT NULL,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  UNIQUE(process_id, subcontractor_id, effective_from)
);

-- ─── 6. 受注 ───
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('ec','wholesale','direct')),
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2)
);

-- ─── 7. ロット (再帰的 Split/Merge) ───
CREATE TABLE lots (
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

-- ─── 8. 工程実績 ───
CREATE TABLE lot_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
  process_id UUID REFERENCES processes(id),
  subcontractor_id UUID REFERENCES subcontractors(id),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','rework')),
  input_quantity INT NOT NULL DEFAULT 0,
  completed_quantity INT DEFAULT 0,
  defect_quantity INT DEFAULT 0,
  loss_qty INT DEFAULT 0,           -- 欠損・端数数量
  loss_confirmed BOOLEAN DEFAULT FALSE, -- 欠損確定フラグ
  unit_price_override NUMERIC(10,2),
  is_rework BOOLEAN DEFAULT FALSE,
  rework_charge BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 8.1 納入明細 (V7.7/V7.8 対応) ───
CREATE TABLE lot_process_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_process_id UUID REFERENCES lot_processes(id) ON DELETE CASCADE,
  qty INT NOT NULL,
  delivery_date DATE,
  completion_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. 修正履歴 ───
CREATE TABLE lot_process_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_process_id UUID REFERENCES lot_processes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 10. 支払 (ダブルチェック) ───
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID REFERENCES subcontractors(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'wip'
    CHECK (status IN ('wip','pre_payment','paid','confirmed')), -- mockStore と統一
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  lot_process_id UUID REFERENCES lot_processes(id),
  good_quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 11. 通知 ───
CREATE TABLE notifications (
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

-- ─── RLS Policies (基本) ───
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全テーブル読み取り可
CREATE POLICY "Authenticated read" ON profiles     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON products     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON processes    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON subcontractors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON orders       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON lots         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON lot_processes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON payments     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Own notifications"  ON notifications FOR SELECT USING (auth.uid() = user_id);

-- ─── 12. 倉庫 ───
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 13. 在庫 (完成品・原材料・パーツ) ───
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  lot_id UUID REFERENCES lots(id),
  item_type TEXT CHECK (item_type IN ('product', 'material', 'parts')), -- parts を追加
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 14. 在庫履歴 ───
CREATE TABLE inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  change_type TEXT CHECK (change_type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON warehouses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON inventory_history FOR SELECT USING (auth.role() = 'authenticated');
