-- =============================================================
-- TOWMEI ERP — RLS Hardening Script
-- =============================================================

-- すべてのテーブルで RLS が有効であることを確認
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 既存の簡易ポリシーを削除（必要に応じて）
-- DROP POLICY IF EXISTS "Authenticated read" ON profiles;
-- ...

-- ────────── 1. profiles ──────────
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Anyone authenticated can read profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

-- ────────── 2. マスタデータ (Products, Subcontractors, Processes) ──────────
-- 管理者(admin)のみ編集可能、利用者は読み取りのみ
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Anyone authenticated can read products" ON products FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage subcontractors" ON subcontractors FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Anyone authenticated can read subcontractors" ON subcontractors FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage processes" ON processes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Anyone authenticated can read processes" ON processes FOR SELECT USING (auth.role() = 'authenticated');

-- ────────── 3. 業務データ (Orders, Lots, Lot Processes) ──────────
CREATE POLICY "Anyone authenticated can read lot_process_deliveries" ON lot_process_deliveries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage lot_process_deliveries" ON lot_process_deliveries FOR ALL USING (auth.role() = 'authenticated');

-- ... (既存のポリシーは維持) ...

-- ────────── 4. 支払データ (Payments) ──────────
-- 管理者のみ作成・承認・変更・削除可能。ユーザーは読み取りのみ。
CREATE POLICY "Admins can manage payments" ON payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Anyone authenticated can read payments" ON payments FOR SELECT USING (auth.role() = 'authenticated');

-- ────────── 5. 在庫データ (Inventory) ──────────
CREATE POLICY "Authenticated users can managed inventory" ON inventory FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view inventory_history" ON inventory_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create history" ON inventory_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ────────── 6. 通知 ──────────
CREATE POLICY "Users can manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
