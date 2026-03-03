-- =============================================================
-- TOWMEI ERP — Initial Seed Data
-- =============================================================

-- ────────── 1. 外注先マスタ ──────────
INSERT INTO subcontractors (name, contact_info) VALUES
('加藤研磨製作所', '0575-XX-XXXX / 担当：加藤'),
('岐阜刃物加工', '0575-YY-YYYY / 担当：佐藤'),
('関市熱処理センター', '0575-ZZ-ZZZZ');

-- ────────── 2. 商品マスタ ──────────
INSERT INTO products (name, code, description, material_cost) VALUES
('牛刀 210mm (積層鋼)', 'GYUTO-210-VG10', 'プロフェッショナル向け牛刀。VG10芯材。', 3500),
('三徳 165mm (白紙)', 'SANTOKU-165-W2', '家庭向け三徳。白紙2号。', 2800),
('ペティ 120mm', 'PETTY-120-ST', 'ステンレス製ペティ。', 1500);

-- ────────── 3. 工程マスタ ──────────
-- 各商品に共通の標準工程（実際は商品ごとに詳細が異なる場合があります）
WITH prod AS (SELECT id, code FROM products)
INSERT INTO processes (product_id, name, sort_order)
SELECT id, '鍛造', 10 FROM prod WHERE code = 'GYUTO-210-VG10'
UNION ALL
SELECT id, '荒研ぎ', 20 FROM prod WHERE code = 'GYUTO-210-VG10'
UNION ALL
SELECT id, '熱処理', 30 FROM prod WHERE code = 'GYUTO-210-VG10'
UNION ALL
SELECT id, '本研ぎ', 40 FROM prod WHERE code = 'GYUTO-210-VG10'
UNION ALL
SELECT id, '柄付け', 50 FROM prod WHERE code = 'GYUTO-210-VG10';

-- ────────── 4. 単価設定 ──────────
WITH sub AS (SELECT id, name FROM subcontractors),
     proc AS (SELECT p.id, p.name FROM processes p JOIN products pr ON p.product_id = pr.id WHERE pr.code = 'GYUTO-210-VG10')
INSERT INTO process_subcontractor_rates (process_id, subcontractor_id, unit_price)
SELECT proc.id, sub.id, 500 FROM proc, sub WHERE proc.name = '荒研ぎ' AND sub.name = '加藤研磨製作所'
UNION ALL
SELECT proc.id, sub.id, 800 FROM proc, sub WHERE proc.name = '熱処理' AND sub.name = '関市熱処理センター';
