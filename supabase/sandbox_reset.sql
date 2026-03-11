-- =============================================================
-- TOWMEI ERP — Sandbox Reset Script
-- 業務データ（実績データ）のみを削除し、初期状態に戻します。
-- マスタデータ（商品、外注先、工程定義、プロフィール）は維持されます。
-- =============================================================

-- 外部キー制約を一時的に無効化（PostgreSQL / Supabase）
-- 注意: トランザクション内で実行することを推奨します。

BEGIN;

-- 1. 実績・トランザクションデータの削除
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE inventory_history CASCADE;
TRUNCATE TABLE inventory CASCADE;
TRUNCATE TABLE lot_process_history CASCADE;
TRUNCATE TABLE lot_process_deliveries CASCADE;
TRUNCATE TABLE lot_processes CASCADE;
TRUNCATE TABLE lots CASCADE;
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE payments CASCADE;

-- 2. 必要に応じて初期在庫のみ再投入する場合などはここに INSERT 文を記述
-- 例: マテリアルの初期在庫など
-- INSERT INTO inventory (product_id, quantity, item_type) ...

COMMIT;

-- =============================================================
-- SQL Editor で上記を実行すると、アプリの実績データが真っさらになります。
-- ユーザーが自由にお試し操作をした後、このスクリプトでリセット可能です。
-- =============================================================
