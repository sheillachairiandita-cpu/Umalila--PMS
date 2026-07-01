-- RLS on previously-uncovered tables, tenant_id on junction tables,
-- NOT NULL tenant_id on core tables, discount property field consolidation,
-- get_dashboard_kpis derives tenant from auth_tenant_id().

-- ── RLS policies (tables already have rowsecurity enabled) ─────────────────

CREATE POLICY pricing_holidays_tenant ON public.pricing_holidays
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY property_cost_profiles_tenant ON public.property_cost_profiles
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY property_date_blocks_tenant ON public.property_date_blocks
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY reservation_profitability_tenant ON public.reservation_profitability
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- ── tenant_id on junction tables ────────────────────────────────────────────

ALTER TABLE public.booking_addons ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.booking_properties ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.booking_addons ba
SET tenant_id = b.tenant_id
FROM public.bookings b
WHERE ba.booking_id = b.id AND ba.tenant_id IS NULL;

UPDATE public.booking_properties bp
SET tenant_id = b.tenant_id
FROM public.bookings b
WHERE bp.booking_id = b.id AND bp.tenant_id IS NULL;

UPDATE public.order_items oi
SET tenant_id = o.tenant_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.tenant_id IS NULL;

ALTER TABLE public.booking_addons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.booking_properties ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.booking_addons
  ADD CONSTRAINT booking_addons_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.booking_properties
  ADD CONSTRAINT booking_properties_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE POLICY booking_addons_tenant ON public.booking_addons
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY booking_properties_tenant ON public.booking_properties
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY order_items_tenant ON public.order_items
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE OR REPLACE FUNCTION set_booking_addons_tenant_id()
RETURNS trigger AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.bookings WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_booking_addons_tenant_id ON public.booking_addons;
CREATE TRIGGER tr_set_booking_addons_tenant_id
  BEFORE INSERT ON public.booking_addons
  FOR EACH ROW EXECUTE FUNCTION set_booking_addons_tenant_id();

CREATE OR REPLACE FUNCTION set_booking_properties_tenant_id()
RETURNS trigger AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.bookings WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_booking_properties_tenant_id ON public.booking_properties;
CREATE TRIGGER tr_set_booking_properties_tenant_id
  BEFORE INSERT ON public.booking_properties
  FOR EACH ROW EXECUTE FUNCTION set_booking_properties_tenant_id();

CREATE OR REPLACE FUNCTION set_order_items_tenant_id()
RETURNS trigger AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.orders WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_order_items_tenant_id ON public.order_items;
CREATE TRIGGER tr_set_order_items_tenant_id
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION set_order_items_tenant_id();

-- ── NOT NULL tenant_id on core tables ───────────────────────────────────────

ALTER TABLE public.users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.properties ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.guests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.addons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.discounts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.finances ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN tenant_id SET NOT NULL;

-- ── booking_income_summary: respect caller RLS ──────────────────────────────

ALTER VIEW public.booking_income_summary SET (security_invoker = true);

-- ── discounts: single property_ids source of truth ──────────────────────────

UPDATE public.discounts
SET property_ids = jsonb_build_array(property_id)
WHERE property_id IS NOT NULL AND property_ids = '[]'::jsonb;

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_villa_id_fkey;
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_property_id_fkey;
ALTER TABLE public.discounts DROP COLUMN IF EXISTS property_id;
ALTER TABLE public.discounts DROP COLUMN IF EXISTS applicable_properties;

-- ── query indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_checkin ON public.bookings(tenant_id, check_in_date);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status ON public.bookings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_finances_tenant_date ON public.finances(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_guests_tenant ON public.guests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log(tenant_id);

-- ── get_dashboard_kpis: tenant from JWT, not caller-supplied param ──────────

DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid, date);
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_today date DEFAULT CURRENT_DATE,
  p_month_start date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object(
    'arrivalsToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id() AND b.status != 'cancelled' AND b.check_in_date = p_today
    ),
    'departuresToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id() AND b.status != 'cancelled' AND b.check_out_date = p_today
    ),
    'inHouse', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id() AND b.status = 'checked_in'
    ),
    'monthRevenue', (
      SELECT COALESCE(SUM(f.amount), 0) FROM finances f
      LEFT JOIN bookings b ON b.id = f.booking_id
      WHERE f.tenant_id = auth_tenant_id()
        AND f.type = 'income'
        AND f.status = 'approved'
        AND f.transaction_date >= p_month_start
        AND f.transaction_date <= p_today
        AND (f.booking_id IS NULL OR b.status IS DISTINCT FROM 'cancelled')
    )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_kpis FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis TO authenticated;
