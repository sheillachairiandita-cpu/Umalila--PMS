# Environment configuration

## Overview

| Layer | Module | Env files |
|-------|--------|-----------|
| Backend | `backend/config/index.js` | `.env.development` / `.env.production` |
| Frontend | `frontend/src/config/index.js` | `frontend/.env.development` / `.env.production` |

**Do not use `process.env` directly in application code.** Import `config` instead.

```js
// Backend
import { config } from './config/index.js';
config.supabase.url;
config.tenant.slug;

// Frontend
import { config } from '../config/index.js';
config.api.baseUrl;
config.tenant.slug;
```

## How env files are loaded

### Backend

`backend/loadEnv.js` runs before `config` and loads (first match wins, later files do not override):

1. `backend/.env.{NODE_ENV}.local`
2. `backend/.env.{NODE_ENV}`
3. `backend/.env.local`
4. `backend/.env`
5. Same names at **repo root** (supports shared `.env.development` at project root)

`NODE_ENV` defaults to `development` when unset.

### Frontend

Vite loads automatically:

- `npm run dev` → `frontend/.env.development`
- `npm run build` → `frontend/.env.production`

Only `VITE_*` variables are exposed to the browser.

## Required variables

### Backend (development)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin key |
| `DEFAULT_TENANT_SLUG` | Default tenant when header omitted |
| `SESSION_SECRET` | Recommended (dev fallback exists with warning) |
| `BOOKING_TOKEN_SECRET` | Recommended for guest booking tokens |

### Backend (production)

All development variables **plus strict requirements**:

- `SESSION_SECRET` — required, no fallback
- `BOOKING_TOKEN_SECRET` — required, no fallback
- `CORS_ORIGIN` — frontend origin (e.g. Cloudflare Pages URL)

### Frontend

| Variable | Purpose |
|----------|---------|
| `VITE_TENANT_SLUG` | Sent as `X-Tenant-Slug` on API requests |
| `VITE_API_BASE_URL` | API origin in production (empty = same origin) |
| `VITE_API_PROXY_TARGET` | Dev-only proxy target (default `http://localhost:5000`) |

## Tenant terminology

Business code uses **tenant** (`tenantId`, `tenantSlug`, `createTenantMiddleware`).

Database uses `tenants` table and `tenant_id` columns (see migration `008_rename_property_to_tenant.sql`).

**Login:** tenant is resolved from `tenants.email_domains` using the part after `@` in the staff email.

**Authenticated API:** tenant comes from the signed-in user’s `tenant_id` (header/env slug is ignored).

Legacy support:

- Env: `DEFAULT_PROPERTY_SLUG` → falls back if `DEFAULT_TENANT_SLUG` unset
- Header: `X-Property-Slug` accepted alongside `X-Tenant-Slug`

## Security checklist

- [ ] Service role key exists **only** in backend env files
- [ ] Frontend env contains **no** `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Development and production use **separate** Supabase projects
- [ ] Production secrets are set only on the production host
- [ ] `.env.*` files are gitignored (only `*.example` committed)

## Quick start (localhost)

See **[docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)** for full localhost setup.

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
# → http://localhost:5173
```
