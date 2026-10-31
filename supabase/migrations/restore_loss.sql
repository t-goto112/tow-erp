-- Apply after the existing routing/payment migrations. No existing grants are changed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.loss_restoration_history (
    request_id uuid PRIMARY KEY,
    lot_id uuid NOT NULL,
    lot_process_id uuid NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    actor_id uuid NOT NULL,
    restored_at timestamptz NOT NULL,
    details jsonb NOT NULL,
    result jsonb NOT NULL
);
ALTER TABLE public.loss_restoration_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loss_restoration_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.loss_restoration_history TO authenticated;
DROP POLICY IF EXISTS loss_restoration_read ON public.loss_restoration_history;
CREATE POLICY loss_restoration_read ON public.loss_restoration_history
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
            AND (p.role = 'admin' OR p.permissions #> '{routing,edit}' = 'true'::jsonb))
    );

CREATE OR REPLACE FUNCTION public.restore_loss(
    p_lot_id uuid, p_process_id uuid, p_quantity integer, p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_now timestamptz := statement_timestamp();
    v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Tokyo')::date;
    v_month date;
    v_month_end date;
    v_lot public.lots%ROWTYPE;
    v_lead public.lot_processes%ROWTYPE;
    v_proc public.lot_processes%ROWTYPE;
    v_previous public.loss_restoration_history%ROWTYPE;
    v_order_id uuid;
    v_order_status text;
    v_active boolean;
    v_remaining integer := p_quantity;
    v_take integer;
    v_total bigint;
    v_price numeric;
    v_rate record;
    v_rate_count integer;
    v_amount numeric;
    v_payment_id uuid;
    v_payment_item_id uuid;
    v_payment record;
    v_payment_count integer;
    v_details jsonb := '[]'::jsonb;
    v_result jsonb;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = v_actor
        AND (p.role = 'admin' OR p.permissions #> '{routing,edit}' = 'true'::jsonb)
    ) THEN
        RAISE EXCEPTION 'ロス復活の編集権限がありません' USING ERRCODE = '42501';
    END IF;
    IF p_lot_id IS NULL OR p_process_id IS NULL OR p_request_id IS NULL
       OR p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION '対象・リクエストID・正の整数数量が必要です' USING ERRCODE = '22023';
    END IF;

    -- Concurrent retries serialize before reading history. The PK is a second guard.
    PERFORM pg_advisory_xact_lock(hashtextextended('restore_loss:request:' || p_request_id::text, 0));
    SELECT * INTO v_previous FROM public.loss_restoration_history h WHERE h.request_id = p_request_id;
    IF FOUND THEN
        IF v_previous.lot_id IS DISTINCT FROM p_lot_id
           OR v_previous.lot_process_id IS DISTINCT FROM p_process_id
           OR v_previous.quantity IS DISTINCT FROM p_quantity
           OR v_previous.actor_id IS DISTINCT FROM v_actor THEN
            RAISE EXCEPTION '同じリクエストIDを別の操作に使用できません' USING ERRCODE = '22023';
        END IF;
        RETURN v_previous.result;
    END IF;

    SELECT * INTO v_lot FROM public.lots l WHERE l.id = p_lot_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '対象ロットが見つかりません' USING ERRCODE = '22023';
    END IF;
    IF v_lot.status = 'cancelled' THEN
        RAISE EXCEPTION 'キャンセル済みロットは復活できません' USING ERRCODE = '22023';
    END IF;
    -- Current deployments have lots.order_id; older schemas use order_item_id.
    v_order_id := (to_jsonb(v_lot)->>'order_id')::uuid;
    IF v_order_id IS NULL AND v_lot.order_item_id IS NOT NULL THEN
        SELECT oi.order_id INTO v_order_id FROM public.order_items oi
        WHERE oi.id = v_lot.order_item_id FOR UPDATE;
    END IF;
    IF v_order_id IS NOT NULL THEN
        SELECT o.status INTO v_order_status FROM public.orders o WHERE o.id = v_order_id FOR UPDATE;
        IF NOT FOUND OR v_order_status = 'cancelled' THEN
            RAISE EXCEPTION '対象受注が存在しないかキャンセルされています' USING ERRCODE = '22023';
        END IF;
        PERFORM oi.id FROM public.order_items oi WHERE oi.order_id = v_order_id ORDER BY oi.id FOR UPDATE;
    END IF;

    -- Lock every row in the lot in one stable order before selecting the group.
    PERFORM lp.id FROM public.lot_processes lp WHERE lp.lot_id = p_lot_id
        ORDER BY lp.created_at, lp.id FOR UPDATE;
    SELECT * INTO v_lead FROM public.lot_processes lp WHERE lp.id = p_process_id AND lp.lot_id = p_lot_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '対象ロットと工程が一致しません' USING ERRCODE = '22023';
    END IF;
    IF v_lead.subcontractor_id IS NULL THEN
        RAISE EXCEPTION '外注先が未設定の工程は復活できません' USING ERRCODE = '22023';
    END IF;
    SELECT p.is_active INTO v_active FROM public.processes p
    WHERE p.id = v_lead.process_id AND p.product_id = v_lot.product_id FOR SHARE;
    IF v_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION '無効な工程は復活できません' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(sum(lp.loss_qty), 0) INTO v_total FROM public.lot_processes lp
    WHERE lp.lot_id = p_lot_id AND lp.process_id = v_lead.process_id
      AND lp.subcontractor_id IS NOT DISTINCT FROM v_lead.subcontractor_id;
    IF p_quantity > v_total THEN
        RAISE EXCEPTION '復活数量が現在のロス数（%個）を超えています', v_total USING ERRCODE = '22023';
    END IF;

    v_month := date_trunc('month', v_day::timestamp)::date;
    v_month_end := (v_month + interval '1 month - 1 day')::date;
    IF v_lead.subcontractor_id IS NOT NULL THEN
        -- Serializes creation of the monthly WIP bucket across lots in this RPC.
        PERFORM pg_advisory_xact_lock(hashtextextended(
            'restore_loss:wip:' || v_lead.subcontractor_id::text || ':' || v_month::text, 0));
        v_payment_count := 0;
        FOR v_payment IN SELECT p.id FROM public.payments p
            WHERE p.subcontractor_id = v_lead.subcontractor_id
              AND p.period_start = v_month AND p.status = 'wip'
            ORDER BY p.id FOR UPDATE
        LOOP
            v_payment_count := v_payment_count + 1;
            v_payment_id := v_payment.id;
        END LOOP;
        IF v_payment_count > 1 THEN
            RAISE EXCEPTION '当月の仕掛支払が重複しています。整理してから再実行してください' USING ERRCODE = '22023';
        END IF;
        IF v_payment_id IS NULL THEN
            INSERT INTO public.payments (subcontractor_id, period_start, period_end, total_amount, status)
            VALUES (v_lead.subcontractor_id, v_month, v_month_end, 0, 'wip') RETURNING id INTO v_payment_id;
        END IF;
    END IF;

    FOR v_proc IN SELECT lp.* FROM public.lot_processes lp
        WHERE lp.lot_id = p_lot_id AND lp.process_id = v_lead.process_id
          AND lp.subcontractor_id IS NOT DISTINCT FROM v_lead.subcontractor_id AND lp.loss_qty > 0
        ORDER BY lp.created_at, lp.id
    LOOP
        EXIT WHEN v_remaining = 0;
        v_take := least(v_remaining, v_proc.loss_qty);
        v_price := NULL;
        v_amount := NULL;
        v_payment_item_id := NULL;
        IF v_proc.subcontractor_id IS NOT NULL THEN
            v_price := v_proc.unit_price_override;
            IF v_price IS NULL THEN
                v_rate_count := 0;
                FOR v_rate IN SELECT r.unit_price FROM public.process_subcontractor_rates r
                    WHERE r.process_id = v_proc.process_id AND r.subcontractor_id = v_proc.subcontractor_id
                      AND r.effective_from <= v_day AND (r.effective_to IS NULL OR r.effective_to >= v_day)
                    ORDER BY r.id FOR SHARE
                LOOP
                    v_rate_count := v_rate_count + 1;
                    v_price := v_rate.unit_price;
                END LOOP;
                IF v_rate_count <> 1 THEN
                    RAISE EXCEPTION '工程 % の当日有効な単価が未設定または重複しています', v_proc.id USING ERRCODE = '22023';
                END IF;
            END IF;
            IF v_price IS NULL OR v_price < 0 OR v_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
                RAISE EXCEPTION '工程単価が不正です' USING ERRCODE = '22023';
            END IF;
            v_amount := round(v_take * v_price);
            INSERT INTO public.payment_items
                (payment_id, lot_process_id, lot_process_delivery_id, good_quantity, unit_price, amount, status, voucher_date)
            VALUES (v_payment_id, v_proc.id, NULL, v_take, v_price, v_amount, 'wip', v_day)
            RETURNING id INTO v_payment_item_id;
            UPDATE public.payments SET total_amount = total_amount + v_amount WHERE id = v_payment_id;
        END IF;
        UPDATE public.lot_processes SET loss_qty = loss_qty - v_take,
            loss_confirmed = CASE WHEN loss_qty - v_take = 0 THEN false ELSE loss_confirmed END,
            status = 'in_progress', completed_at = NULL
        WHERE id = v_proc.id;
        v_details := v_details || jsonb_build_array(jsonb_build_object(
            'lotProcessId', v_proc.id, 'quantity', v_take, 'lossBefore', v_proc.loss_qty,
            'lossAfter', v_proc.loss_qty - v_take, 'unitPrice', v_price, 'amount', v_amount,
            'paymentId', v_payment_id, 'paymentItemId', v_payment_item_id));
        v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining <> 0 THEN
        RAISE EXCEPTION 'ロス数量が変更されました。再読込してください' USING ERRCODE = '40001';
    END IF;
    UPDATE public.lots SET status = 'in_progress' WHERE id = p_lot_id;
    IF v_order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.order_items oi WHERE oi.order_id = v_order_id
        AND coalesce(oi.shipped_quantity, 0) < oi.quantity
    ) THEN
        UPDATE public.orders SET status = 'in_progress' WHERE id = v_order_id;
    END IF;
    v_result := jsonb_build_object('ok', true, 'restoredQty', p_quantity,
        'requestId', p_request_id, 'details', v_details);
    INSERT INTO public.loss_restoration_history
        (request_id, lot_id, lot_process_id, quantity, actor_id, restored_at, details, result)
    VALUES (p_request_id, p_lot_id, p_process_id, p_quantity, v_actor, v_now, v_details, v_result);
    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_loss(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_loss(uuid, uuid, integer, uuid) TO authenticated;
COMMENT ON FUNCTION public.restore_loss(uuid, uuid, integer, uuid) IS
    'Restore group loss to WIP atomically; p_process_id is a lot_processes.id. Does not modify deliveries, stock or shipments.';
-- Internal helpers keep the existing routing operations consistent with restoration.
CREATE OR REPLACE FUNCTION public.loss_require_editor(p_page text)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
      AND (p.role='admin' OR p.permissions #> ARRAY[p_page,'edit']='true'::jsonb
        OR (p_page='routing_work' AND (p.permissions #> '{routing,edit}'='true'::jsonb OR p.permissions #> '{dashboard,edit}'='true'::jsonb)))
  ) THEN RAISE EXCEPTION '編集権限がありません' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.loss_require_editor(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.routing_consume_wip(p_process_id uuid, p_quantity integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; v_left integer:=p_quantity; v_take integer; v_amount numeric;
BEGIN
  PERFORM public.loss_require_editor('routing_work');
  IF p_quantity IS NULL OR p_quantity<0 THEN RAISE EXCEPTION '数量が不正です'; END IF;
  PERFORM id FROM public.lot_processes WHERE id=p_process_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '工程がありません'; END IF;
  -- Lock parent buckets first, then their items (same order in every payment RPC).
  PERFORM p.id FROM public.payments p WHERE p.status='wip' AND EXISTS (
    SELECT 1 FROM public.payment_items i WHERE i.payment_id=p.id AND i.lot_process_id=p_process_id AND i.status='wip'
  ) ORDER BY p.id FOR UPDATE;
  FOR r IN SELECT i.* FROM public.payment_items i JOIN public.payments p ON p.id=i.payment_id
    WHERE i.lot_process_id=p_process_id AND i.status='wip' AND p.status='wip'
    ORDER BY i.created_at,i.id FOR UPDATE OF i
  LOOP
    EXIT WHEN v_left<=0;
    v_take:=least(r.good_quantity,v_left);
    IF r.good_quantity<=v_left THEN
      DELETE FROM public.payment_items WHERE id=r.id;
      v_amount:=r.amount;
    ELSE
      v_amount:=r.amount-round((r.good_quantity-v_take)*r.unit_price);
      UPDATE public.payment_items SET good_quantity=good_quantity-v_take,
        amount=round((good_quantity-v_take)*unit_price) WHERE id=r.id;
    END IF;
    UPDATE public.payments SET total_amount=greatest(0,total_amount-v_amount) WHERE id=r.payment_id;
    -- A zero monetary balance can still contain other zero-priced WIP items.
    DELETE FROM public.payments p WHERE p.id=r.payment_id AND NOT EXISTS (
      SELECT 1 FROM public.payment_items i WHERE i.payment_id=p.id);
    v_left:=v_left-v_take;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.routing_consume_wip(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.routing_consume_wip(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.routing_create_payment(
  p_process_id uuid,p_quantity integer,p_date date,p_price numeric,p_status text,p_delivery_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_proc public.lot_processes%ROWTYPE; v_price numeric:=p_price;
  v_start date; v_end date; v_payment uuid; v_count integer; v_amount numeric;
BEGIN
  PERFORM public.loss_require_editor('routing_work');
  IF p_quantity IS NULL OR p_quantity<0 OR p_date IS NULL OR p_status NOT IN ('wip','pre_payment') OR p_status IS NULL
    THEN RAISE EXCEPTION '支払入力が不正です'; END IF;
  SELECT * INTO v_proc FROM public.lot_processes WHERE id=p_process_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '工程がありません'; END IF;
  IF v_proc.subcontractor_id IS NULL THEN RETURN; END IF;
  IF p_delivery_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lot_process_deliveries WHERE id=p_delivery_id AND lot_process_id=p_process_id
  ) THEN RAISE EXCEPTION '納入明細と工程が一致しません'; END IF;
  IF v_price IS NULL THEN
    SELECT count(*),min(unit_price) INTO v_count,v_price FROM public.process_subcontractor_rates
      WHERE process_id=v_proc.process_id AND subcontractor_id=v_proc.subcontractor_id;
    -- Preserve the existing helper's fallback when no unambiguous rate exists.
    IF v_count<>1 THEN v_price:=0; END IF;
  END IF;
  IF v_price<0 OR v_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION '単価が不正です'; END IF;
  v_start:=date_trunc('month',p_date)::date; v_end:=(v_start+interval '1 month - 1 day')::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    CASE WHEN p_status='wip' THEN 'restore_loss:wip:' ELSE 'routing:pre_payment:' END
    ||v_proc.subcontractor_id::text||':'||v_start::text,0));
  PERFORM id FROM public.payments WHERE subcontractor_id=v_proc.subcontractor_id
    AND period_start=v_start AND status=p_status ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.payments WHERE subcontractor_id=v_proc.subcontractor_id
    AND period_start=v_start AND status=p_status;
  IF v_count>1 THEN RAISE EXCEPTION '支払が重複しています'; END IF;
  SELECT id INTO v_payment FROM public.payments WHERE subcontractor_id=v_proc.subcontractor_id
    AND period_start=v_start AND status=p_status;
  IF v_payment IS NULL THEN
    INSERT INTO public.payments(subcontractor_id,period_start,period_end,total_amount,status)
      VALUES(v_proc.subcontractor_id,v_start,v_end,0,p_status) RETURNING id INTO v_payment;
  END IF;
  v_amount:=round(p_quantity*v_price);
  INSERT INTO public.payment_items(payment_id,lot_process_id,lot_process_delivery_id,good_quantity,unit_price,amount,status,voucher_date)
    VALUES(v_payment,p_process_id,p_delivery_id,p_quantity,v_price,v_amount,p_status,p_date);
  UPDATE public.payments SET total_amount=total_amount+v_amount WHERE id=v_payment;
END $$;
REVOKE ALL ON FUNCTION public.routing_create_payment(uuid,integer,date,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.routing_create_payment(uuid,integer,date,numeric,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_routing_status(p_lot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_lot public.lots%ROWTYPE; v_order uuid; v_all boolean; v_any boolean;
BEGIN
  PERFORM public.loss_require_editor('routing_work');
  SELECT * INTO v_lot FROM public.lots WHERE id=p_lot_id FOR UPDATE;
  IF NOT FOUND OR v_lot.status='cancelled' THEN RETURN; END IF;
  v_order:=(to_jsonb(v_lot)->>'order_id')::uuid;
  IF v_order IS NULL THEN SELECT order_id INTO v_order FROM public.order_items WHERE id=v_lot.order_item_id; END IF;
  PERFORM id FROM public.orders WHERE id=v_order FOR UPDATE;
  SELECT count(*)>0 AND bool_and(lp.status='completed'),bool_or(lp.status IN ('in_progress','completed'))
    INTO v_all,v_any FROM public.lot_processes lp JOIN public.processes p ON p.id=lp.process_id
    WHERE lp.lot_id=p_lot_id AND p.is_active;
  IF v_all THEN
    UPDATE public.lots SET status='completed' WHERE id=p_lot_id;
  ELSIF v_any THEN
    UPDATE public.lots SET status='in_progress' WHERE id=p_lot_id AND status IN ('created','pending','completed');
    UPDATE public.orders SET status='in_progress' WHERE id=v_order AND status IN ('pending','created','completed')
      AND EXISTS(SELECT 1 FROM public.order_items WHERE order_id=v_order AND coalesce(shipped_quantity,0)<quantity);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_routing_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_routing_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_loss(p_lot_id uuid,p_process_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_lot public.lots%ROWTYPE; v_lead public.lot_processes%ROWTYPE; r record;
  v_order uuid; v_remaining integer; v_total integer:=0;
BEGIN
  PERFORM public.loss_require_editor('routing');
  SELECT * INTO v_lot FROM public.lots WHERE id=p_lot_id FOR UPDATE;
  IF NOT FOUND OR v_lot.status='cancelled' THEN RAISE EXCEPTION '対象ロットが無効です'; END IF;
  v_order:=(to_jsonb(v_lot)->>'order_id')::uuid;
  IF v_order IS NULL THEN SELECT order_id INTO v_order FROM public.order_items WHERE id=v_lot.order_item_id; END IF;
  PERFORM id FROM public.orders WHERE id=v_order FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.orders WHERE id=v_order AND status='cancelled') THEN RAISE EXCEPTION '取消受注です'; END IF;
  PERFORM id FROM public.lot_processes WHERE lot_id=p_lot_id ORDER BY created_at,id FOR UPDATE;
  SELECT * INTO v_lead FROM public.lot_processes WHERE id=p_process_id AND lot_id=p_lot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ロットと工程が一致しません'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.processes WHERE id=v_lead.process_id AND is_active) THEN RAISE EXCEPTION '工程が無効です'; END IF;
  FOR r IN SELECT * FROM public.lot_processes WHERE lot_id=p_lot_id AND process_id=v_lead.process_id
    AND subcontractor_id IS NOT DISTINCT FROM v_lead.subcontractor_id ORDER BY created_at,id
  LOOP
    v_remaining:=coalesce(r.input_quantity,0)-coalesce(r.completed_quantity,0)-coalesce(r.loss_qty,0);
    IF v_remaining<=0 THEN CONTINUE; END IF;
    PERFORM public.routing_consume_wip(r.id,v_remaining);
    UPDATE public.lot_processes SET loss_qty=coalesce(loss_qty,0)+v_remaining,loss_confirmed=true,status='completed' WHERE id=r.id;
    v_total:=v_total+v_remaining;
  END LOOP;
  PERFORM public.sync_routing_status(p_lot_id);
  RETURN jsonb_build_object('ok',true,'lossQty',v_total);
END $$;
REVOKE ALL ON FUNCTION public.confirm_loss(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_loss(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_payment_item_atomic(
 p_item_id uuid,p_payment_id uuid,p_quantity integer,p_price numeric,p_voucher_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_item public.payment_items%ROWTYPE; v_amount numeric;
BEGIN
 PERFORM public.loss_require_editor('payments');
 IF p_quantity IS NULL OR p_quantity<0 OR p_price<0 OR p_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION '数量・単価が不正です'; END IF;
 SELECT * INTO v_item FROM public.payment_items WHERE id=p_item_id;
 IF NOT FOUND OR v_item.payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION '対象明細が一致しません'; END IF;
 PERFORM id FROM public.lot_processes WHERE id=v_item.lot_process_id FOR UPDATE;
 PERFORM id FROM public.payments WHERE id=p_payment_id FOR UPDATE;
 SELECT * INTO v_item FROM public.payment_items WHERE id=p_item_id FOR UPDATE;
 IF NOT FOUND OR v_item.payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION '対象明細が変更されました'; END IF;
 v_amount:=round(p_quantity*coalesce(p_price,0));
 UPDATE public.payment_items SET good_quantity=p_quantity,unit_price=coalesce(p_price,0),amount=v_amount,
   voucher_date=coalesce(p_voucher_date,voucher_date) WHERE id=p_item_id;
 IF p_price IS NOT NULL THEN UPDATE public.lot_processes SET unit_price_override=p_price WHERE id=v_item.lot_process_id; END IF;
 UPDATE public.payments SET total_amount=total_amount+v_amount-v_item.amount WHERE id=p_payment_id;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.update_payment_item_atomic(uuid,uuid,integer,numeric,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_payment_item_atomic(uuid,uuid,integer,numeric,date) TO authenticated;

-- A stale pre-restoration client snapshot must not mark a restored WIP row complete.
CREATE OR REPLACE FUNCTION public.keep_restored_process_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.status='completed' AND coalesce(NEW.input_quantity,0)-coalesce(NEW.completed_quantity,0)-coalesce(NEW.loss_qty,0)>0
   AND EXISTS(SELECT 1 FROM public.loss_restoration_history h WHERE h.lot_id=NEW.lot_id)
 THEN NEW.status:='in_progress'; NEW.completed_at:=NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.keep_restored_process_status() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS keep_restored_process_status ON public.lot_processes;
CREATE TRIGGER keep_restored_process_status BEFORE UPDATE ON public.lot_processes
FOR EACH ROW EXECUTE FUNCTION public.keep_restored_process_status();

COMMIT;
