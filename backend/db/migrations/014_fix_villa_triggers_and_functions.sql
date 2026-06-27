-- Fix DB triggers still referencing public.villas after 013 rename.
-- Does NOT rewrite function bodies (that broke get_dashboard_kpis tenant filters).
-- Safe to re-run.

-- Drop triggers on properties whose function body still mentions villas
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'properties'
      AND NOT t.tgisinternal
      AND p.prokind = 'f'
      AND coalesce(p.prosrc, '') ILIKE '%villas%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.properties', r.tgname);
  END LOOP;
END $$;

-- Drop common legacy trigger names (idempotent)
DROP TRIGGER IF EXISTS set_villa_display_id ON public.properties;
DROP TRIGGER IF EXISTS villas_display_id_trigger ON public.properties;
DROP TRIGGER IF EXISTS trg_villas_display_id ON public.properties;
DROP TRIGGER IF EXISTS set_display_id ON public.properties;
