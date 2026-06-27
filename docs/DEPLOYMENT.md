# Deployment

## Architecture

| Component | Target | Config |
|-----------|--------|--------|
| Frontend | Cloudflare Pages | `frontend/src/config/index.js` |
| Backend | Node.js host (Render, Railway, VPS, etc.) | `backend/config/index.js` |
| Database | Supabase (separate dev + prod projects) | Migrations via Supabase CLI |

**Never hardcode URLs.** Use `config.api.baseUrl` (frontend) and env-based CORS (backend).

---

## Frontend — Cloudflare Pages

### Build settings

| Setting | Value |
|---------|-------|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Node version | 20+ |

### Environment variables (Cloudflare dashboard)

Set for **Production** environment:

```
VITE_TENANT_SLUG=umalila
VITE_API_BASE_URL=https://api.your-domain.com
```

Set for **Preview** (optional):

```
VITE_TENANT_SLUG=umalila-dev
VITE_API_BASE_URL=https://api-dev.your-domain.com
```

### API routing options

**Option A — Separate API domain (recommended)**

- Frontend: `https://app.example.com`
- Backend: `https://api.example.com`
- Set `VITE_API_BASE_URL=https://api.example.com`
- Set backend `CORS_ORIGIN=https://app.example.com`

**Option B — Same origin via Cloudflare Worker proxy**

- Proxy `/api/*` to your Node backend
- Leave `VITE_API_BASE_URL` empty

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
CORS_ORIGIN=https://your-frontend.pages.dev
```

### Health check

```
GET /status
→ { "status": "Umalila Engine Running Smoothly" }
```

---

## Database — Supabase

Use **two projects**: development and production.

See [SUPABASE_MIGRATIONS.md](./SUPABASE_MIGRATIONS.md) for migration workflow.

Never edit production schema manually in the SQL editor after CLI workflow is adopted.

---

## Pre-deploy checklist

- [ ] `npm run build` succeeds in `frontend/`
- [ ] `npm run config:check` succeeds in `backend/`
- [ ] Migrations applied to production Supabase
- [ ] Production env vars set on host (not in git)
- [ ] `CORS_ORIGIN` matches frontend URL
- [ ] Smoke test: login, bookings list, properties public page
