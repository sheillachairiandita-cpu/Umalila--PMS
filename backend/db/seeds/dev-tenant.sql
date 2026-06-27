-- Run on your **development** Supabase project only.
-- Ensures all data uses tenant slug umalila-dev (matches DEFAULT_TENANT_SLUG / VITE_TENANT_SLUG).
-- Safe to re-run.

DO $$
DECLARE
  dev_tid uuid;
  other_tid uuid;
  tbl text;
BEGIN
  SELECT id INTO dev_tid FROM public.tenants WHERE slug = 'umalila-dev' LIMIT 1;
  SELECT id INTO other_tid FROM public.tenants WHERE slug = 'umalila' LIMIT 1;

  -- Both tenants exist: merge umalila → umalila-dev (typical after migration 010)
  IF dev_tid IS NOT NULL AND other_tid IS NOT NULL AND dev_tid <> other_tid THEN
    FOREACH tbl IN ARRAY ARRAY[
      'users', 'properties', 'guests', 'bookings', 'addons', 'menu_items',
      'discounts', 'pricing_holidays', 'property_date_blocks', 'finances',
      'orders', 'property_cost_profiles', 'reservation_profitability', 'audit_log'
    ]
    LOOP
      IF to_regclass(format('public.%I', tbl)) IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
         ) THEN
        EXECUTE format(
          'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id = $2',
          tbl
        ) USING dev_tid, other_tid;
      END IF;
    END LOOP;

    DELETE FROM public.tenants WHERE id = other_tid;
    RAISE NOTICE 'Merged tenant umalila into umalila-dev (%)', dev_tid;

  -- Only umalila exists: rename to umalila-dev
  ELSIF dev_tid IS NULL AND other_tid IS NOT NULL THEN
    UPDATE public.tenants SET slug = 'umalila-dev' WHERE id = other_tid;
    dev_tid := other_tid;
    RAISE NOTICE 'Renamed tenant umalila → umalila-dev (%)', dev_tid;

  -- Only umalila-dev exists: nothing to merge
  ELSIF dev_tid IS NOT NULL THEN
    RAISE NOTICE 'Using existing umalila-dev tenant (%)', dev_tid;

  ELSE
    INSERT INTO public.tenants (name, slug)
    VALUES ('Umalila Dev', 'umalila-dev')
    RETURNING id INTO dev_tid;
    RAISE NOTICE 'Created umalila-dev tenant (%)', dev_tid;
  END IF;

  -- Backfill NULL tenant_id rows
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'properties', 'guests', 'bookings', 'addons', 'menu_items',
    'discounts', 'pricing_holidays', 'property_date_blocks', 'finances',
    'orders', 'property_cost_profiles', 'reservation_profitability', 'audit_log'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
       ) THEN
      EXECUTE format(
        'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL',
        tbl
      ) USING dev_tid;
    END IF;
  END LOOP;
END $$;
