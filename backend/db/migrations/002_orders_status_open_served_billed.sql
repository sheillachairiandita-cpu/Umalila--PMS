-- orders.status is constrained by orders_status_check to: open, served, billed
-- New food orders must use status = 'open' (not 'pending' or 'preparing').

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['open'::text, 'served'::text, 'billed'::text]));

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'open';

-- Migrate legacy rows if any exist from an older enum/check definition
UPDATE public.orders SET status = 'open' WHERE status IN ('pending', 'preparing');
