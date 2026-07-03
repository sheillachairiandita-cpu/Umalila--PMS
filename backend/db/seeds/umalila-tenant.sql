-- Umalila PRODUCTION bootstrap (run after migrations through 017+).
-- Creates tenant slug `umalila` and the first admin user if missing.
--
-- 1. Generate password hash:
--      cd backend
--      node --input-type=module -e "import('./lib/rbac/auth.js').then(m => console.log(m.hashPassword('YourPassword')))"
-- 2. Replace REPLACE_WITH_PASSWORD_HASH below.
-- 3. Run in the PRODUCTION Supabase SQL Editor.

INSERT INTO public.tenants (name, slug, email_domains)
VALUES ('Umalila', 'umalila', ARRAY['umalila.com']::text[])
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  email_domains = EXCLUDED.email_domains;

DO $$
DECLARE
  tid uuid;
  next_display_id text;
  max_num int := 0;
  row record;
BEGIN
  SELECT id INTO tid
  FROM public.tenants
  WHERE slug = 'umalila'
  LIMIT 1;

  IF tid IS NULL THEN
    RAISE EXCEPTION 'Tenant umalila not found after insert. Run migrations 010+ first.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE email = 'admin@umalila.com' AND tenant_id = tid
  ) THEN
    RAISE NOTICE 'Umalila admin already exists.';
    RETURN;
  END IF;

  FOR row IN
    SELECT display_id FROM public.users
    WHERE tenant_id = tid AND display_id ~ '^UMA[0-9]{3}$'
  LOOP
    max_num := GREATEST(max_num, substring(row.display_id from 'UMA([0-9]{3})')::int);
  END LOOP;
  next_display_id := 'UMA' || lpad((max_num + 1)::text, 3, '0');

  INSERT INTO public.users (
    name, email, password_hash, role, status, tenant_id, display_id
  ) VALUES (
    'Umalila Admin',
    'admin@umalila.com',
    'REPLACE_WITH_PASSWORD_HASH',
    'admin',
    'active',
    tid,
    next_display_id
  );

  RAISE NOTICE 'Created admin@umalila.com (%) for tenant umalila.', next_display_id;
END $$;
