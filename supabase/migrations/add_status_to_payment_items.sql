-- =============================================================
-- payment_items に status カラムを追加
-- 各明細が独立してステータスを持つようにする
-- =============================================================

-- 1. status カラムを追加（既存の payments.status から初期値をコピー）
ALTER TABLE payment_items
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'wip'
  CHECK (status IN ('wip','pre_payment','paid','confirmed'));

-- 2. 既存データ: 親テーブル payments の status を payment_items にコピー
UPDATE payment_items pi
SET status = p.status
FROM payments p
WHERE pi.payment_id = p.id
  AND pi.status IS DISTINCT FROM p.status;
