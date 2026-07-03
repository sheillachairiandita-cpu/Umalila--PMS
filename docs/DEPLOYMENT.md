# Deployment

**Step-by-step production guide:** [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)

## Architecture (Umalila production)

| Layer | Role | Product |
|-------|------|---------|
| DNS / CDN | Domain routing, SSL, optional proxy | **Cloudflare** |
| Frontend | React SPA (two subdomains, one project) | **Vercel** |
| Backend | Node / Express API | **Railway** |
| Database | PostgreSQL | **Supabase** |

**Never hardcode URLs.** Use `config.api.baseUrl` (frontend) and env-based CORS (backend).

### Production domains

| URL | Cloudflare DNS → | Purpose |
|-----|------------------|---------|
| `pms.stayatumalila.com` | Vercel | Staff login + admin (`admin` mode) |
| `booking.stayatumalila.com` | Vercel | Guest booking form (`booking` mode) |
| Railway URL or `api.stayatumalila.com` | Railway | REST API |

One Vercel build serves both frontend subdomains. `frontend/src/config/hostMode.js` picks routes from `window.location.hostname`:

- **pms.*** → only `/admin/*` (everything else → `/admin/login`)
- **booking.*** → only `/`, `/success`
- **localhost** → both (development)

### Traffic flow

```
                    Cloudflare DNS
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   pms.stayatumalila   booking.stayatumalila   api.stayatumalila
          │               │               (optional)
          └───────┬───────┘                   │
                  ▼                           ▼
              Vercel (SPA)              Railway (API)
                  │                           │
                  │    VITE_API_BASE_URL      │
                  └──────────────────────────►│
                                              ▼
                                         Supabase
```

---

## Cloudflare (DNS)

Manage DNS for `stayatumalila.com` in Cloudflare. Vercel and Railway each give you a CNAME target when you add custom domains.

### Frontend records (→ Vercel)

After adding domains in **Vercel → Project → Settings → Domains**, create in **Cloudflare → DNS**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `pms` | `cname.vercel-dns.com` (or value Vercel shows) | DNS only (grey cloud) recommended* |
| CNAME | `booking` | same Vercel target | DNS only recommended* |

\*Vercel recommends **DNS only** (grey cloud) for custom domains, or use Vercel’s nameserver integration. Orange-cloud proxy on Vercel domains can work but may complicate SSL; follow [Vercel + Cloudflare docs](https://vercel.com/docs/domains/working-with-dns#cloudflare) if you proxy.

### API record (→ Railway, optional)

In **Railway → Service → Settings → Networking → Custom Domain**, add `api.stayatumalila.com`, then in Cloudflare:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | Railway-provided hostname | DNS only (grey cloud) typical |

If you skip a custom API domain, use the default `*.up.railway.app` URL in `VITE_API_BASE_URL` (no Cloudflare record needed for API).

### SSL

- Cloudflare SSL/TLS mode: **Full** or **Full (strict)** when origin (Vercel/Railway) has valid HTTPS.
- Vercel and Railway terminate HTTPS on their side.

---

## Frontend — Vercel

### Project settings

| Setting | Value |
|---------|-------|
| Root directory | `frontend` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |

`frontend/vercel.json` rewrites non-asset paths to `index.html` so React Router works (`/admin/login`, etc.).

### Custom domains

Add in **Vercel → Project → Settings → Domains** (then point Cloudflare DNS as above):

1. `pms.stayatumalila.com`
2. `booking.stayatumalila.com`

Do **not** point frontend domains at Railway — only Vercel serves the React app.

### Environment variables (Vercel → Settings → Environment Variables)

**Production** (copy from `frontend/.env.production.example`):

```
VITE_TENANT_SLUG=umalila
VITE_API_BASE_URL=https://YOUR-RAILWAY-APP.up.railway.app
```

Use your Railway public URL, or a custom domain like `https://api.stayatumalila.com` if you attached one in Railway.

Redeploy after changing env vars (Vite bakes them in at build time).

### Login / API calls

Auth and API use `apiFetch` → `VITE_API_BASE_URL` + `/api/...`.

| Wrong (404) | Correct |
|-------------|---------|
| `pms.stayatumalila.com/api/auth/login` | `YOUR-RAILWAY-URL/api/auth/login` |

### Public booking (no staff login)

Guest form on `booking.stayatumalila.com` uses unauthenticated routes only:

| Method | Endpoint |
|--------|----------|
| GET | `/api/properties`, `/api/addons`, `/api/pricing/holidays`, `/api/properties/availability` |
| POST | `/api/guests`, `/api/bookings` |

All include `X-Tenant-Slug: umalila`.

---

## Backend — Railway

### Service settings

| Setting | Value |
|---------|-------|
| Root directory | `backend` (if monorepo) or repo root with start path |
| Start command | `npm start` |
| Builder | Nixpacks (default) |

Railway sets `PORT` automatically — `backend/config/index.js` reads `process.env.PORT`.

### Environment variables (Railway → Variables)

```
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=...          # long random string
BOOKING_TOKEN_SECRET=...    # long random string
DEFAULT_TENANT_SLUG=umalila
CORS_ORIGIN=https://pms.stayatumalila.com,https://booking.stayatumalila.com
```

`CORS_ORIGIN` must list **both** Vercel frontend origins (comma-separated, no trailing slashes).

Optional: add your Vercel preview URL for testing:

```
CORS_ORIGIN=https://pms.stayatumalila.com,https://booking.stayatumalila.com,https://your-project.vercel.app
```

### Custom API domain (optional)

In Railway → Service → Settings → Networking → Custom Domain:

- Add `api.stayatumalila.com`
- DNS: `api` CNAME → Railway-provided target

Then set on Vercel:

```
VITE_API_BASE_URL=https://api.stayatumalila.com
```

### Health check

```
GET https://YOUR-RAILWAY-URL/status
→ { "status": "Umalila Engine Running Smoothly" }
```

Use this URL in Railway health checks if available.

---

## Database — Supabase

Use **two projects**: development and production.

See [SUPABASE_MIGRATIONS.md](./SUPABASE_MIGRATIONS.md) for migration workflow.

Bootstrap production tenant + first admin: `backend/db/seeds/umalila-tenant.sql`

---

## Quick wiring checklist

| Step | Where | What |
|------|--------|------|
| 1 | Supabase | Migrations + `umalila-tenant.sql` |
| 2 | Railway | Deploy backend, copy public URL, set env vars + `CORS_ORIGIN` |
| 3 | Vercel | Set `VITE_API_BASE_URL` = Railway URL, deploy |
| 4 | Vercel | Add `pms` + `booking` custom domains |
| 5 | Cloudflare | CNAME `pms` + `booking` → Vercel |
| 6 | Cloudflare | (Optional) CNAME `api` → Railway |
| 7 | Browser | Test `/status` on API, login on pms |

---

## Pre-deploy checklist

- [ ] `npm run build` succeeds in `frontend/`
- [ ] `npm run config:check` succeeds in `backend/`
- [ ] Migrations + `umalila-tenant.sql` on production Supabase
- [ ] Railway: env vars set, `/status` returns OK
- [ ] Vercel: `VITE_API_BASE_URL` = Railway URL, redeployed
- [ ] Railway: `CORS_ORIGIN` includes both `pms` and `booking` domains
- [ ] Both domains on Vercel + Cloudflare DNS pointing to Vercel
- [ ] Smoke test **pms**: login at `/admin/login`
- [ ] Smoke test **booking**: submit test reservation

---

## Troubleshooting login 404

1. Open DevTools → Network on login.
2. Request URL must be **`https://<railway-host>/api/auth/login`**, not `pms.stayatumalila.com/api/...`.
3. If wrong: set `VITE_API_BASE_URL` on Vercel and **redeploy**.
4. If Railway `/status` fails: fix backend deploy first.
5. If 401: credentials issue (not 404).
6. If CORS error: add frontend origin to Railway `CORS_ORIGIN`.
