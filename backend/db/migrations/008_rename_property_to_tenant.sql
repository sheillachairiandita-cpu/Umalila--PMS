-- Rename property terminology to tenant (code + database aligned).
-- Prerequisites: multi-tenant migration already applied (properties table + property_id columns).
-- Safe to re-run: skips steps already applied.

-- ── 1. Master table ─────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.properties') IS NOT NULL
     AND to_regclass('public.tenants') IS NULL THEN
    ALTER TABLE public.properties RENAME TO tenants;
  END IF;
END $$;

-- ── 2. Foreign-key columns property_id → tenant_id ──────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'properties', 'guests', 'bookings', 'addons', 'menu_items',
    'discounts', 'pricing_holidays', 'property_date_blocks', 'finances',
    'orders', 'property_cost_profiles', 'reservation_profitability'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'property_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN property_id TO tenant_id', tbl);
    END IF;
  END LOOP;
END $$;

-- audit_log (if present)
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'property_id'
     ) THEN
    ALTER TABLE public.audit_log RENAME COLUMN property_id TO tenant_id;
  END IF;
END $$;

-- ── 3. Re-point FKs to tenants(id) ──────────────────────────
-- Column rename keeps existing FK constraints on the renamed table.

-- ── 4. Income summary view ──────────────────────────────────
DROP VIEW IF EXISTS public.booking_income_summary;

CREATE VIEW public.booking_income_summary AS
SELECT
  b.id AS booking_id,
  b.tenant_id,
  b.display_id,
  b.check_in_date,
  b.check_out_date,
  b.payment_status,
  b.status AS booking_status,
  b.amount_paid,
  b.total_price,
  b.discount_amount,
  b.created_at,
  g.full_name AS guest_name,
  d.code AS discount_code,
  COALESCE((
    SELECT SUM(bv.rate_per_night * bv.nights)
    FROM booking_properties bv WHERE bv.booking_id = b.id
  ), 0) AS total_accommodation,
  COALESCE((
    SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
  ), 0) AS total_addons,
  COALESCE((
    SELECT SUM(o.total_amount) FROM orders o
    WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
  ), 0) AS total_menu_items
FROM bookings b
LEFT JOIN guests g ON g.id = b.guest_id
LEFT JOIN discounts d ON d.id = b.discount_id
WHERE b.status != 'cancelled';

-- ── 5. Dashboard KPI RPC ────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_tenant_id uuid,
  p_today date DEFAULT CURRENT_DATE,
  p_month_start date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'arrivalsToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = p_tenant_id AND b.status != 'cancelled' AND b.check_in_date = p_today
    ),
    'departuresToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = p_tenant_id AND b.status != 'cancelled' AND b.check_out_date = p_today
    ),
    'inHouse', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = p_tenant_id AND b.status = 'checked_in'
    ),
    'monthRevenue', (
      SELECT COALESCE(SUM(f.amount), 0) FROM finances f
      WHERE f.tenant_id = p_tenant_id AND f.type = 'income'
        AND f.transaction_date >= p_month_start AND f.transaction_date <= p_today
    )
  );
$$;

-- ── 6. JWT helper + RLS policies (tenant terminology) ───────
CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'property_id', '')::uuid
  );
$$;

-- Drop legacy policies that reference auth_property_id() / property_id
DROP POLICY IF EXISTS properties_select ON public.tenants;
DROP POLICY IF EXISTS properties_select ON public.properties;
DROP POLICY IF EXISTS bookings_tenant_select ON public.bookings;
DROP POLICY IF EXISTS bookings_tenant_insert ON public.bookings;
DROP POLICY IF EXISTS bookings_tenant_update ON public.bookings;
DROP POLICY IF EXISTS bookings_tenant_delete ON public.bookings;
DROP POLICY IF EXISTS properties_tenant ON public.villas;
DROP POLICY IF EXISTS guests_tenant ON public.guests;
DROP POLICY IF EXISTS finances_tenant_select ON public.finances;
DROP POLICY IF EXISTS finances_tenant_write ON public.finances;
DROP POLICY IF EXISTS finances_tenant_update ON public.finances;
DROP POLICY IF EXISTS finances_tenant_delete ON public.finances;
DROP POLICY IF EXISTS users_tenant_select ON public.users;
DROP POLICY IF EXISTS users_tenant_write ON public.users;
DROP POLICY IF EXISTS orders_tenant ON public.orders;
DROP POLICY IF EXISTS addons_tenant ON public.addons;
DROP POLICY IF EXISTS menu_items_tenant ON public.menu_items;
DROP POLICY IF EXISTS discounts_tenant ON public.discounts;
DROP POLICY IF EXISTS audit_log_tenant_select ON public.audit_log;
DROP POLICY IF EXISTS audit_log_tenant_insert ON public.audit_log;

-- Recreate policies using tenant_id + auth_tenant_id()
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (id = public.auth_tenant_id());

CREATE POLICY bookings_tenant_select ON public.bookings
  FOR SELECT USING (tenant_id = public.auth_tenant_id());

CREATE POLICY bookings_tenant_insert ON public.bookings
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY bookings_tenant_update ON public.bookings
  FOR UPDATE
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY bookings_tenant_delete ON public.bookings
  FOR DELETE USING (tenant_id = public.auth_tenant_id());

CREATE POLICY properties_tenant ON public.villas
  FOR ALL
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY guests_tenant ON public.guests
  FOR ALL
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY finances_tenant_select ON public.finances
  FOR SELECT USING (tenant_id = public.auth_tenant_id());

CREATE POLICY finances_tenant_write ON public.finances
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY finances_tenant_update ON public.finances
  FOR UPDATE
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY finances_tenant_delete ON public.finances
  FOR DELETE USING (tenant_id = public.auth_tenant_id());

CREATE POLICY users_tenant_select ON public.users
  FOR SELECT USING (tenant_id = public.auth_tenant_id());

CREATE POLICY users_tenant_write ON public.users
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY orders_tenant ON public.orders
  FOR ALL
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY addons_tenant ON public.addons
  FOR ALL
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY menu_items_tenant ON public.menu_items
  FOR ALL
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY discounts_tenant ON public.discounts
  FOR ALL
  USING (tenant_id = public.auth_tenant_id())
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY audit_log_tenant_select ON public.audit_log
  FOR SELECT USING (tenant_id = public.auth_tenant_id());

CREATE POLICY audit_log_tenant_insert ON public.audit_log
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

DROP FUNCTION IF EXISTS public.auth_property_id();

