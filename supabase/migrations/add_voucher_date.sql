-- =============================================================
-- payment_items テーブルに伝票日付 (voucher_date) カラムを追加
-- デフォルトは完了日（created_at の日付部分）
-- =============================================================

ALTER TABLE payment_items
ADD COLUMN voucher_date DATE;

-- 既存データに対して created_at の日付部分を設定
UPDATE payment_items
SET voucher_date = created_at::date
WHERE voucher_date IS NULL;

-- 今後の新規データ向けにデフォルトを設定
ALTER TABLE payment_items
ALTER COLUMN voucher_date SET DEFAULT CURRENT_DATE;
