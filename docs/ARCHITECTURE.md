# Architecture improvements log

Incremental refactors toward production readiness. APIs remain backward-compatible unless noted.

## 2026-06 — Environment & configuration layer

- Added `backend/config/index.js` — single source for server config with validation
- Added `frontend/src/config/index.js` — Vite env access without scattered `import.meta.env`
- Env files: `.env.development` / `.env.production` (see `docs/ENVIRONMENT.md`)
- `loadEnv.js` loads backend + repo-root env files before any module reads config

## 2026-06 — Tenant terminology (code only)

| Before | After | DB unchanged |
|--------|-------|--------------|
| `req.tenantId` | `req.tenantId` | `tenant_id` column |
| `createTenantMiddleware` | `createTenantMiddleware` | `tenants` table |
| `DEFAULT_PROPERTY_SLUG` | `DEFAULT_TENANT_SLUG` | — |
| `X-Property-Slug` | `X-Tenant-Slug` | legacy header still accepted |

## 2026-06 — Security

- Session and booking token secrets validated in `config` (required in production)
- Service role key restricted to backend config module
- Dev fallbacks only when `NODE_ENV !== 'production'`

## 2026-06 — Deployment prep

- `config.api.baseUrl` for frontend (Cloudflare Pages)
- `config.cors.origin` for backend production CORS
- Docs: `docs/DEPLOYMENT.md`, `docs/GIT_WORKFLOW.md`, `docs/SUPABASE_MIGRATIONS.md`

## 2026-06 — Database tenant alignment

- Migration `008_rename_property_to_tenant.sql`: `properties` → `tenants`, `property_id` → `tenant_id`
- Dev seed `dev-tenant.sql`: slug `umalila-dev` for localhost
- See `docs/LOCAL_DEVELOPMENT.md`
