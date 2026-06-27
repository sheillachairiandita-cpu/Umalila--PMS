-- Complete tenant setup: schema + RLS. Safe to re-run.
-- Run this ONE file in Supabase SQL Editor if 008/009 failed or tenants is missing.

-- ═══════════════════════════════════════════════════════════
-- A. Ensure tenants master table exists
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.properties') IS NOT NULL
     AND to_regclass('public.tenants') IS NULL THEN
    ALTER TABLE public.properties RENAME TO tenants;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.tenants (name, slug)
VALUES ('Umalila Dev', 'umalila-dev')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tenants (name, slug)
VALUES ('Umalila', 'umalila')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- B. tenant_id columns (add if missing, then rename property_id)
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl text;
  default_tid uuid;
BEGIN
  SELECT id INTO default_tid FROM public.tenants ORDER BY created_at LIMIT 1;

  FOREACH tbl IN ARRAY ARRAY[
    'users', 'properties', 'guests', 'bookings', 'addons', 'menu_items',
    'discounts', 'pricing_holidays', 'property_date_blocks', 'finances',
    'orders', 'property_cost_profiles', 'reservation_profitability'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'property_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.tenants(id)',
        tbl
      );
      IF default_tid IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL', tbl)
        USING default_tid;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'property_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN property_id TO tenant_id', tbl);
    END IF;
  END LOOP;
END $$;

-- audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid REFERENCES public.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'property_id'
  ) THEN
    ALTER TABLE public.audit_log RENAME COLUMN property_id TO tenant_id;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- C. Views + RPC
-- ═══════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════
-- D. RLS — drop legacy policies only when table exists
-- ═══════════════════════════════════════════════════════════
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

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT * FROM (VALUES
      ('properties_select', 'tenants'),
      ('properties_select', 'properties'),
      ('tenants_select', 'tenants'),
      ('bookings_tenant_select', 'bookings'),
      ('bookings_tenant_insert', 'bookings'),
      ('bookings_tenant_update', 'bookings'),
      ('bookings_tenant_delete', 'bookings'),
      ('properties_tenant', 'properties'),
      ('guests_tenant', 'guests'),
      ('finances_tenant_select', 'finances'),
      ('finances_tenant_write', 'finances'),
      ('finances_tenant_update', 'finances'),
      ('finances_tenant_delete', 'finances'),
      ('users_tenant_select', 'users'),
      ('users_tenant_write', 'users'),
      ('orders_tenant', 'orders'),
      ('addons_tenant', 'addons'),
      ('menu_items_tenant', 'menu_items'),
      ('discounts_tenant', 'discounts'),
      ('audit_log_tenant_select', 'audit_log'),
      ('audit_log_tenant_insert', 'audit_log')
    ) AS t(policy_name, table_name)
  LOOP
    IF to_regclass(format('public.%I', pol.table_name)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policy_name, pol.table_name);
    END IF;
  END LOOP;
END $$;

-- Enable RLS where tables exist
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenants', 'bookings', 'properties', 'guests', 'finances', 'users',
    'orders', 'addons', 'menu_items', 'discounts', 'audit_log'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

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
