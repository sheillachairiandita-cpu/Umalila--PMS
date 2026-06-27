-- Align discounts.status with app values: draft, active, archived (was active/inactive).

UPDATE public.discounts
SET status = 'archived'
WHERE status = 'inactive';

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
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'discounts'
      AND con.contype = 'c'
      AND (
        con.conname = 'discounts_status_check'
        OR pg_get_constraintdef(con.oid) ILIKE '%status%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.discounts') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discounts_status_check'
  ) THEN
    ALTER TABLE public.discounts ADD CONSTRAINT discounts_status_check
      CHECK (status = ANY (ARRAY[
        'draft'::text, 'active'::text, 'archived'::text
      ]));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
