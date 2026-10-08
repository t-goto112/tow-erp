-- Run in Supabase SQL Editor before using the updated app.
-- Keep retired process history; backfill missing processes for existing lots.
BEGIN;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.add_process_to_existing_lots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO public.lot_processes
      (lot_id, process_id, subcontractor_id, status, input_quantity)
    SELECT l.id, NEW.id, NULL, 'pending', 0
    FROM public.lots l
    WHERE l.product_id = NEW.product_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lot_processes lp
        WHERE lp.lot_id = l.id AND lp.process_id = NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_process_to_existing_lots ON public.processes;
CREATE TRIGGER add_process_to_existing_lots
AFTER INSERT OR UPDATE OF is_active ON public.processes
FOR EACH ROW EXECUTE FUNCTION public.add_process_to_existing_lots();

INSERT INTO public.lot_processes
  (lot_id, process_id, subcontractor_id, status, input_quantity)
SELECT l.id, p.id,
  (SELECT r.subcontractor_id FROM public.process_subcontractor_rates r
   WHERE r.process_id = p.id ORDER BY r.id LIMIT 1),
  'pending', 0
FROM public.lots l
JOIN public.processes p ON p.product_id = l.product_id AND p.is_active
WHERE NOT EXISTS (
  SELECT 1 FROM public.lot_processes lp
  WHERE lp.lot_id = l.id AND lp.process_id = p.id
);

COMMIT;
