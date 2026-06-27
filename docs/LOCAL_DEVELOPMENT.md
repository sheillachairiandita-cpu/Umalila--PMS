# Local development on localhost

## URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |
| Health check | http://localhost:5000/status |

The frontend dev server proxies `/api/*` to the backend — you do **not** need `VITE_API_BASE_URL` locally.

## 1. Environment files

Env files live in **`backend/`** and **`frontend/`** (not the repo root):

| File | Purpose |
|------|---------|
| `backend/.env.development` | Local / `environment-1` API |
| `backend/.env.production` | Production API (`master`) |
| `backend/.env` | Fallback when `NODE_ENV` unset (dev copy) |
| `frontend/.env.development` | Vite dev (`npm run dev`) |
| `frontend/.env.production` | Vite build for production |
| `frontend/.env` | Local fallback |

Parent-folder `.env.development` / `.env.production` are legacy; prefer the copies under `backend/` and `frontend/`.

```env
NODE_ENV=development
PORT=5000
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=...
BOOKING_TOKEN_SECRET=...
DEFAULT_TENANT_SLUG=umalila-dev
```

### Frontend (`frontend/.env.development`)

```env
VITE_TENANT_SLUG=umalila-dev
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:5000
```

**Important:** `DEFAULT_TENANT_SLUG` and `VITE_TENANT_SLUG` must match a row in `tenants.slug`.

## 2. Database (development Supabase)

Run in the SQL Editor on your **dev** project:

1. `backend/db/migrations/010_complete_tenant_setup.sql` — creates `tenants`, columns, views, RPC, RLS
2. `backend/db/seeds/dev-tenant.sql` — sets slug to `umalila-dev` for local dev

## 3. Start servers

**Terminal 1 — API**

```bash
cd backend
npm install
npm run dev
```

**Terminal 2 — UI**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in.

## 4. Verify

```bash
cd backend
npm run config:check
# → OK development umalila-dev

curl -H "X-Tenant-Slug: umalila-dev" http://localhost:5000/api/properties
```

## Branch mapping

| Git branch | Environment | Supabase project |
|------------|-------------|------------------|
| `environment-1` | Development (localhost) | Dev project |
| `master` | Production | Prod project |

Never point localhost at the production database.
