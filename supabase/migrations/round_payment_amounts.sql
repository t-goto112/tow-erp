-- =============================================================
-- 支払明細 (payment_items) の金額 (amount) を四捨五入して整数化
-- =============================================================

UPDATE payment_items
SET amount = ROUND(amount)
WHERE amount != ROUND(amount);

-- 親テーブル (payments) の合計金額も再集計して整合性を保つ
UPDATE payments p
SET total_amount = COALESCE((
  SELECT SUM(pi.amount)
  FROM payment_items pi
  WHERE pi.payment_id = p.id
), 0)
WHERE p.total_amount != ROUND(p.total_amount);
