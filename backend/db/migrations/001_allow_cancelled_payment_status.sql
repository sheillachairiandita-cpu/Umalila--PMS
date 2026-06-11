-- Allow 'cancelled' as a valid payment_status when a booking is declined or cancelled.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS check_payment_status;

ALTER TABLE public.bookings
  ADD CONSTRAINT check_payment_status
  CHECK (payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'complete'::text, 'cancelled'::text]));
