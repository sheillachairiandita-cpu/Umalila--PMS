INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false);

CREATE POLICY payment_proofs_tenant_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

CREATE POLICY payment_proofs_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

CREATE POLICY payment_proofs_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );

CREATE POLICY payment_proofs_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth_tenant_id()::text
  );


CREATE TABLE public.payment_proofs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  storage_path text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type = ANY (ARRAY['partial'::text, 'final'::text])),
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])),
  uploaded_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  uploaded_by uuid NOT NULL,
  verified_at timestamp with time zone,
  verified_by uuid,
  rejection_reason text,
  CONSTRAINT payment_proofs_pkey PRIMARY KEY (id),
  CONSTRAINT payment_proofs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT payment_proofs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT payment_proofs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id),
  CONSTRAINT payment_proofs_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id)
);

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_proofs_tenant ON public.payment_proofs
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

  CREATE OR REPLACE FUNCTION set_payment_proofs_tenant_id()
RETURNS trigger AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.bookings WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_set_payment_proofs_tenant_id
  BEFORE INSERT ON public.payment_proofs
  FOR EACH ROW EXECUTE FUNCTION set_payment_proofs_tenant_id();

  CREATE OR REPLACE FUNCTION sync_booking_payment_status()
RETURNS trigger AS $$
DECLARE
  v_total_verified numeric;
  v_booking_total numeric;
  v_booking_id uuid;
BEGIN
  v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_verified
  FROM public.payment_proofs
  WHERE booking_id = v_booking_id AND status = 'verified';

  SELECT total_price INTO v_booking_total
  FROM public.bookings
  WHERE id = v_booking_id;

  UPDATE public.bookings
  SET amount_paid = v_total_verified,
      payment_status = CASE
        WHEN v_total_verified <= 0 THEN 'pending'
        WHEN v_total_verified >= v_booking_total THEN 'complete'
        ELSE 'partial'
      END
  WHERE id = v_booking_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_booking_payment_status
  AFTER INSERT OR UPDATE OF status, amount OR DELETE ON public.payment_proofs
  FOR EACH ROW EXECUTE FUNCTION sync_booking_payment_status();

  CREATE INDEX idx_payment_proofs_tenant_status ON public.payment_proofs(tenant_id, status);
CREATE INDEX idx_payment_proofs_booking ON public.payment_proofs(booking_id);

SELECT id FROM public.pricing_holidays WHERE tenant_id IS NULL;
SELECT id FROM public.property_cost_profiles WHERE tenant_id IS NULL;
SELECT id FROM public.property_date_blocks WHERE tenant_id IS NULL;
SELECT id FROM public.reservation_profitability WHERE tenant_id IS NULL;