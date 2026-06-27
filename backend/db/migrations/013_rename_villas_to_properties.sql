-- Rename villa-centric schema to generic property accommodation model.
-- Safe to re-run (idempotent where possible).

-- ═══════════════════════════════════════════════════════════
-- A. Rename core table: villas → properties
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.villas') IS NOT NULL
     AND to_regclass('public.properties') IS NULL THEN
    ALTER TABLE public.villas RENAME TO properties;
  END IF;
END $$;

-- Rename PK / unique constraints for clarity (skip if target name already taken, e.g. by tenants PK)
DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villas_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_pkey') THEN
    ALTER TABLE public.properties RENAME CONSTRAINT villas_pkey TO properties_pkey;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- C. Rename related tables
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.booking_villas') IS NOT NULL
     AND to_regclass('public.booking_properties') IS NULL THEN
    ALTER TABLE public.booking_villas RENAME TO booking_properties;
  END IF;

  IF to_regclass('public.villa_date_blocks') IS NOT NULL
     AND to_regclass('public.property_date_blocks') IS NULL THEN
    ALTER TABLE public.villa_date_blocks RENAME TO property_date_blocks;
  END IF;

  IF to_regclass('public.villa_cost_profiles') IS NOT NULL
     AND to_regclass('public.property_cost_profiles') IS NULL THEN
    ALTER TABLE public.villa_cost_profiles RENAME TO property_cost_profiles;
  END IF;
END $$;

-- Rename PK constraints on renamed tables (skip when target name already exists)
DO $$
BEGIN
  IF to_regclass('public.booking_properties') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_villas_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_properties_pkey') THEN
    ALTER TABLE public.booking_properties
      RENAME CONSTRAINT booking_villas_pkey TO booking_properties_pkey;
  END IF;

  IF to_regclass('public.property_date_blocks') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villa_date_blocks_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_date_blocks_pkey') THEN
    ALTER TABLE public.property_date_blocks
      RENAME CONSTRAINT villa_date_blocks_pkey TO property_date_blocks_pkey;
  END IF;

  IF to_regclass('public.property_cost_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villa_cost_profiles_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_cost_profiles_pkey') THEN
    ALTER TABLE public.property_cost_profiles
      RENAME CONSTRAINT villa_cost_profiles_pkey TO property_cost_profiles_pkey;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- D. Rename villa_id → property_id columns
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'booking_properties', 'property_date_blocks', 'property_cost_profiles',
    'reservation_profitability', 'discounts'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'villa_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN villa_id TO property_id', tbl);
    END IF;
  END LOOP;
END $$;

-- Rename discount multi-select columns
DO $$
BEGIN
  IF to_regclass('public.discounts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'villa_ids'
    ) THEN
      ALTER TABLE public.discounts RENAME COLUMN villa_ids TO property_ids;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'applicable_villas'
    ) THEN
      ALTER TABLE public.discounts RENAME COLUMN applicable_villas TO applicable_properties;
    END IF;
  END IF;
END $$;

-- Rename FK constraints (skip when target name already exists)
DO $$
BEGIN
  IF to_regclass('public.booking_properties') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_villas_villa_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_properties_property_id_fkey') THEN
    ALTER TABLE public.booking_properties
      RENAME CONSTRAINT booking_villas_villa_id_fkey TO booking_properties_property_id_fkey;
  END IF;

  IF to_regclass('public.property_date_blocks') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villa_date_blocks_villa_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_date_blocks_property_id_fkey') THEN
    ALTER TABLE public.property_date_blocks
      RENAME CONSTRAINT villa_date_blocks_villa_id_fkey TO property_date_blocks_property_id_fkey;
  END IF;

  IF to_regclass('public.property_cost_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villa_cost_profiles_villa_id_key')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_cost_profiles_property_id_key') THEN
    ALTER TABLE public.property_cost_profiles
      RENAME CONSTRAINT villa_cost_profiles_villa_id_key TO property_cost_profiles_property_id_key;
  END IF;

  IF to_regclass('public.property_cost_profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'villa_cost_profiles_villa_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_cost_profiles_property_id_fkey') THEN
    ALTER TABLE public.property_cost_profiles
      RENAME CONSTRAINT villa_cost_profiles_villa_id_fkey TO property_cost_profiles_property_id_fkey;
  END IF;

  IF to_regclass('public.reservation_profitability') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_profitability_villa_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_profitability_property_id_fkey') THEN
    ALTER TABLE public.reservation_profitability
      RENAME CONSTRAINT reservation_profitability_villa_id_fkey TO reservation_profitability_property_id_fkey;
  END IF;

  IF to_regclass('public.reservation_profitability') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_profitability_booking_villa_key')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_profitability_booking_property_key') THEN
    ALTER TABLE public.reservation_profitability
      RENAME CONSTRAINT reservation_profitability_booking_villa_key TO reservation_profitability_booking_property_key;
  END IF;

  IF to_regclass('public.discounts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discounts_villa_id_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discounts_property_id_fkey') THEN
    ALTER TABLE public.discounts
      RENAME CONSTRAINT discounts_villa_id_fkey TO discounts_property_id_fkey;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- E. Add category attribute on properties
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RETURN;
  END IF;

  -- Migrate from property_categories table if an earlier draft of 013 ran
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category_id'
  ) AND to_regclass('public.property_categories') IS NOT NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN category text;
  END IF;
    UPDATE public.properties p
    SET category = pc.name
    FROM public.property_categories pc
    WHERE p.category_id = pc.id AND (p.category IS NULL OR trim(p.category) = '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN category text NOT NULL DEFAULT 'Villa';
  END IF;

  UPDATE public.properties SET category = 'Villa' WHERE category IS NULL OR trim(category) = '';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_category_id_fkey;
    ALTER TABLE public.properties DROP COLUMN category_id;
  END IF;
END $$;

DROP TABLE IF EXISTS public.property_categories;

-- ═══════════════════════════════════════════════════════════
-- F. Update discount scope: villas → properties
-- (drop old CHECK first — UPDATE to 'properties' fails while constraint still lists 'villas')
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.discounts') IS NULL THEN
    RETURN;
  END IF;

  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'discounts'
      AND con.contype = 'c'
      AND (
        con.conname = 'discounts_scope_check'
        OR pg_get_constraintdef(con.oid) ILIKE '%villas%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

UPDATE public.discounts SET scope = 'properties' WHERE scope = 'villas';

DO $$
BEGIN
  IF to_regclass('public.discounts') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discounts_scope_check'
  ) THEN
    ALTER TABLE public.discounts ADD CONSTRAINT discounts_scope_check
      CHECK (scope = ANY (ARRAY[
        'global'::text, 'all_items'::text, 'properties'::text, 'addons'::text, 'menu'::text
      ]));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- G. Recreate booking_income_summary view
-- ═══════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.booking_income_summary;

CREATE VIEW public.booking_income_summary AS
SELECT
  base.*,
  GREATEST(base.subtotal_before_discount - COALESCE(base.discount_amount, 0), 0) AS total,
  GREATEST(
    GREATEST(base.subtotal_before_discount - COALESCE(base.discount_amount, 0), 0)
      - COALESCE(base.amount_paid, 0),
    0
  ) AS balance_due
FROM (
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
      SELECT SUM(bp.rate_per_night * bp.nights)
      FROM booking_properties bp WHERE bp.booking_id = b.id
    ), 0) AS total_accommodation,
    COALESCE((
      SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
    ), 0) AS total_addons,
    COALESCE((
      SELECT SUM(o.total_amount) FROM orders o
      WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
    ), 0) AS total_menu_items,
    COALESCE((
      SELECT SUM(bp.rate_per_night * bp.nights)
      FROM booking_properties bp WHERE bp.booking_id = b.id
    ), 0)
    + COALESCE((
      SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
    ), 0)
    + COALESCE((
      SELECT SUM(o.total_amount) FROM orders o
      WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
    ), 0) AS subtotal_before_discount
  FROM bookings b
  LEFT JOIN guests g ON g.id = b.guest_id
  LEFT JOIN discounts d ON d.id = b.discount_id
  WHERE b.status != 'cancelled'
) base;

-- ═══════════════════════════════════════════════════════════
-- H. RLS — properties
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
END $$;

DROP POLICY IF EXISTS villas_tenant ON public.properties;
DROP POLICY IF EXISTS properties_tenant ON public.properties;

DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RETURN;
  END IF;
  CREATE POLICY properties_tenant ON public.properties
    FOR ALL
    USING (tenant_id = public.auth_tenant_id())
    WITH CHECK (tenant_id = public.auth_tenant_id());
END $$;
