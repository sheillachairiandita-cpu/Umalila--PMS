# Supabase migrations (CLI workflow)

## Goal

```
Development DB  →  migration SQL  →  Git  →  Production DB
```

Never manually edit production schema after this workflow is active.

## Folder layout

```
supabase/
  config.toml          # CLI project config (link to dev project)
  migrations/          # Symlink or copy from backend/db/migrations

backend/db/migrations/ # Source of truth (existing SQL files)
```

Migration files remain in `backend/db/migrations/` for now. When adopting the CLI, sync them:

```bash
# One-time: copy migrations into supabase folder
cp backend/db/migrations/*.sql supabase/migrations/
```

Or on Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force supabase/migrations
Copy-Item backend/db/migrations/*.sql supabase/migrations/
```

## Setup (one-time)

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli)
2. Login: `supabase login`
3. Link dev project: `supabase link --project-ref YOUR_DEV_REF`
4. Copy migrations into `supabase/migrations/` (see above)

## Development workflow

1. Create a new migration file:

```bash
supabase migration new describe_your_change
```

2. Edit the generated SQL in `supabase/migrations/`
3. Apply locally / to dev:

```bash
supabase db push
```

4. Commit the migration file to git
5. Open PR → `environment-1` → `master`

## Production workflow

On release, apply pending migrations to production:

```bash
supabase link --project-ref YOUR_PROD_REF
supabase db push
```

Or use CI/CD with `SUPABASE_ACCESS_TOKEN` and project ref secrets.

## Existing migrations (manual baseline)

If production was set up via SQL Editor, ensure these ran in order before CLI takeover:

1. `002_multi_tenant.sql`
2. `004_audit_log.sql`
3. `003_indexes.sql`
4. `005_booking_income_view.sql`
5. `007_dashboard_kpi_rpc.sql`
6. `006_rls_policies.sql`
7. `008_rename_property_to_tenant.sql` (or `010_complete_tenant_setup.sql` — supersedes 008/009)
8. `011_fix_booking_income_summary_totals.sql`
9. `012_exclude_cancelled_from_revenue.sql`
10. `013_rename_villas_to_properties.sql` — villas → properties, `category` column on properties, discount scope rename
11. `014_fix_villa_triggers_and_functions.sql` — drop legacy triggers on `properties` (no function rewrites)
12. `015_fix_dashboard_kpis.sql` — restore `get_dashboard_kpis` with `tenant_id` (fixes 014 breakage)
13. `016_fix_discounts_status_check.sql` — allow `draft`, `active`, `archived` discount statuses
14. `017_add_tenant_email_domains.sql` — map staff email domains to tenants (`@umalila.com`, `@kayuputih`)

Then mark baseline in CLI or ensure `supabase_migrations.schema_migrations` matches.

## Rules

- One change per migration file
- Migrations are **append-only** — never edit applied files
- Test on dev before production
- Keep `property_id` column names unless a planned rename migration exists
