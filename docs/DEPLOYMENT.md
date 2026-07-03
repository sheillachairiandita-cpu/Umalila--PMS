# Deployment

## Architecture

| Component | Target | Config |
|-----------|--------|--------|
| Frontend | Cloudflare Pages (one project, two custom domains) | `frontend/src/config/index.js` |
| Backend | Node.js host (Render, Railway, VPS, etc.) | `backend/config/index.js` |
| Database | Supabase (separate dev + prod projects) | Migrations via Supabase CLI |

**Never hardcode URLs.** Use `config.api.baseUrl` (frontend) and env-based CORS (backend).

### Production domains (Umalila)

| URL | Purpose | App mode |
|-----|---------|----------|
| `https://pms.stayatumalila.com` | Staff login + admin dashboard | `admin` |
| `https://booking.stayatumalila.com` | Guest reservation form (no login) | `booking` |
| `https://api.stayatumalila.com` | Node API (recommended) | — |

One frontend build serves both subdomains. `frontend/src/config/hostMode.js` picks routes from `window.location.hostname`:

- **pms.*** → only `/admin/*` (everything else redirects to `/admin/login`)
- **booking.*** → only public booking routes (`/`, `/success`)
- **localhost** → both (development)

---

## Frontend — Cloudflare Pages

### Build settings

| Setting | Value |
|---------|-------|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Node version | 20+ |

### Custom domains (same Pages project)

Add both:

1. `pms.stayatumalila.com`
2. `booking.stayatumalila.com`

DNS (example):

```
pms      CNAME  your-project.pages.dev
booking  CNAME  your-project.pages.dev
```

`frontend/public/_redirects` enables SPA routing on Cloudflare Pages.

### Environment variables (Cloudflare dashboard)

Set for **Production** (copy from `frontend/.env.production.example`):

```
VITE_TENANT_SLUG=umalila
VITE_API_BASE_URL=https://api.stayatumalila.com
```

Set for **Preview** (optional):

```
VITE_TENANT_SLUG=umalila-dev
VITE_API_BASE_URL=https://api-dev.stayatumalila.com
```

### Public booking API (no staff session)

The guest form on `booking.stayatumalila.com` uses **unauthenticated** backend routes only:

| Method | Endpoint |
|--------|----------|
| GET | `/api/properties`, `/api/addons`, `/api/pricing/holidays`, `/api/properties/availability` |
| POST | `/api/guests`, `/api/bookings` |

All requests include `X-Tenant-Slug: umalila` (from `VITE_TENANT_SLUG`). Staff dashboard routes require a session cookie from login on **pms.***.

### API routing options

**Option A — Separate API subdomain (recommended)**

- Frontend: `https://pms.stayatumalila.com` + `https://booking.stayatumalila.com`
- Backend: `https://api.stayatumalila.com`
- Set `VITE_API_BASE_URL=https://api.stayatumalila.com`
- Set backend `CORS_ORIGIN` to both frontend origins (comma-separated)

**Option B — Same origin via Cloudflare Worker proxy**

- Proxy `/api/*` on each frontend domain to your Node backend
- Leave `VITE_API_BASE_URL` empty on Pages

---

## Backend — Node.js hosting

### Start command

```bash
cd backend && npm ci && npm start
```

Set `NODE_ENV=production` on the host so `config` loads production rules and env files.

### Required production env vars

```
NODE_ENV=production
PORT=5000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=...
BOOKING_TOKEN_SECRET=...
DEFAULT_TENANT_SLUG=umalila
CORS_ORIGIN=https://pms.stayatumalila.com,https://booking.stayatumalila.com
```

`CORS_ORIGIN` accepts a comma-separated list when you have multiple frontend domains.

### DNS for API

```
api  CNAME  your-backend-host.example.com
```

Or `A` record to your VPS IP.

### Health check

```
GET /status
→ { "status": "Umalila Engine Running Smoothly" }
```

---

## Database — Supabase

Use **two projects**: development and production.

See [SUPABASE_MIGRATIONS.md](./SUPABASE_MIGRATIONS.md) for migration workflow.

Bootstrap production tenant + first admin: `backend/db/seeds/umalila-tenant.sql`

Never edit production schema manually in the SQL editor after CLI workflow is adopted.

---

## Pre-deploy checklist

- [ ] `npm run build` succeeds in `frontend/`
- [ ] `npm run config:check` succeeds in `backend/`
- [ ] Migrations applied to production Supabase
- [ ] `umalila-tenant.sql` seed run (tenant + admin user)
- [ ] Production env vars set on host (not in git)
- [ ] `CORS_ORIGIN` lists **both** `pms` and `booking` origins
- [ ] Cloudflare custom domains attached to Pages project
- [ ] Smoke test **pms**: login at `/admin/login`, open dashboard
- [ ] Smoke test **booking**: submit a test reservation (no login)
