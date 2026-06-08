-- Allow cancelled payment status when a booking is cancelled.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'complete'::text, 'cancelled'::text]));
