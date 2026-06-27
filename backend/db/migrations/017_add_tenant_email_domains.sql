-- Map staff email domains to tenants for login routing.
-- @umalila.com → umalila (or umalila-dev in local dev)
-- @kayuputih.com / @kayuputih → kayuputih

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_domains text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.tenants
SET email_domains = ARRAY['umalila.com']::text[]
WHERE slug IN ('umalila', 'umalila-dev')
  AND (email_domains = '{}'::text[] OR email_domains IS NULL);

INSERT INTO public.tenants (name, slug, email_domains)
VALUES ('Kayuputih', 'kayuputih', ARRAY['kayuputih.com', 'kayuputih']::text[])
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  email_domains = EXCLUDED.email_domains;

CREATE INDEX IF NOT EXISTS tenants_email_domains_gin
  ON public.tenants USING gin (email_domains);
