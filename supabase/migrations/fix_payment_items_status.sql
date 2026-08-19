-- =============================================================
-- 既存の支払明細 (payment_items) のステータス不整合を修復
-- 親テーブル (payments) のステータスが 'wip' 以外であるにもかかわらず、
-- 子の支払明細 (payment_items) のステータスが 'wip' (仕掛中) のままになっているデータを親のステータスに同期します。
-- =============================================================

UPDATE payment_items pi
SET status = p.status
FROM payments p
WHERE pi.payment_id = p.id
  AND pi.status = 'wip'
  AND p.status != 'wip';
