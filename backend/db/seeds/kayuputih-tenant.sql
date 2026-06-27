-- Kayuputih tenant bootstrap (run after 017_add_tenant_email_domains.sql).
-- Creates the first admin if missing. Set password hash before running.

DO $$
DECLARE
  tid uuid;
  next_display_id text;
  max_num int := 0;
  row record;
BEGIN
  SELECT id, name INTO tid, tenant_name
  FROM public.tenants
  WHERE slug = 'kayuputih'
  LIMIT 1;

  IF tid IS NULL THEN
    RAISE EXCEPTION 'Tenant kayuputih not found. Run migration 017 first.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE email = 'admin@kayuputih.com' AND tenant_id = tid
  ) THEN
    RAISE NOTICE 'Kayuputih admin already exists.';
    RETURN;
  END IF;

  -- Kayuputih → KAY001, KAY002, …
  FOR row IN
    SELECT display_id FROM public.users
    WHERE tenant_id = tid AND display_id ~ '^KAY[0-9]{3}$'
  LOOP
    max_num := GREATEST(max_num, substring(row.display_id from 'KAY([0-9]{3})')::int);
  END LOOP;
  next_display_id := 'KAY' || lpad((max_num + 1)::text, 3, '0');

  -- IMPORTANT: password_hash must be a scrypt hash (salt:hex), NOT the plain password.
  -- Generate hash:
  --   cd backend
  --   node --input-type=module -e "import('./lib/rbac/auth.js').then(m => console.log(m.hashPassword('YourPassword')))"
  INSERT INTO public.users (
    name, email, password_hash, role, status, tenant_id, display_id
  ) VALUES (
    'Kayuputih Admin',
    'admin@kayuputih.com',
    'REPLACE_WITH_PASSWORD_HASH',
    'admin',
    'active',
    tid,
    next_display_id
  );

  RAISE NOTICE 'Created admin@kayuputih.com (%) for tenant kayuputih. Change password after first login.', next_display_id;
END $$;
