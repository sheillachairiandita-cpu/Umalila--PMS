# Multi-tenant setup

> **Updated:** See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for env files and `config.tenant.slug`.

## How login picks a tenant

Staff sign-in uses the **email domain** (not `DEFAULT_TENANT_SLUG`):

| Email domain | Tenant slug |
|--------------|-------------|
| `@umalila.com` | `umalila` (or `umalila-dev` in local dev) |
| `@kayuputih.com`, `@kayuputih` | `kayuputih` |

After login, all API data is scoped to the user’s `tenant_id`. The `X-Tenant-Slug` header is only used for **public** routes (e.g. guest booking) when no user is signed in.

Domains are stored on `tenants.email_domains` (migration `017`).

## 1. Run migrations (Supabase SQL Editor, in order)

1. **`backend/db/migrations/010_complete_tenant_setup.sql`** — tenants table, `tenant_id` columns, RLS
2. **`backend/db/migrations/017_add_tenant_email_domains.sql`** — email domain → tenant mapping, creates **Kayuputih**

Then for **development only**:

3. `backend/db/seeds/dev-tenant.sql` — merges/renames to slug `umalila-dev` for localhost

## 2. Create Kayuputih admin user

1. Run migration `017`.
2. Generate a password hash:
   ```bash
   cd backend && node -e "import('./lib/rbac/auth.js').then(m => console.log(m.hashPassword('YourPassword')))"
   ```
3. Edit `backend/db/seeds/kayuputih-tenant.sql` — replace `REPLACE_WITH_PASSWORD_HASH`.
4. Run the seed in Supabase SQL Editor.

Or create a user manually in SQL with `tenant_id` = Kayuputih’s id and email `@kayuputih.com`.

Umalila staff must use `@umalila.com` emails with `tenant_id` set to the Umalila tenant.

## 3. Environment variables

See `backend/.env.development.example` and `frontend/.env.development.example`.

Key names (tenant terminology):

```
DEFAULT_TENANT_SLUG=umalila
SESSION_SECRET=...
BOOKING_TOKEN_SECRET=...
```

Frontend:

```
VITE_TENANT_SLUG=umalila
```

## 3. Public booking security

- Unauthenticated `PATCH /api/bookings/:id` and `/cancel` require `?token=` (manage token returned on booking create).
- Admin users with `bookings:write` can modify without token (same property).

## 4. Roles

`owner`, `admin`, `manager`, `receptionist`, `housekeeping`, `staff` (legacy alias for receptionist).
