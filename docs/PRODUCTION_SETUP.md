# Production setup — step by step

Stack: **Cloudflare** (DNS) → **Vercel** (frontend) + **Railway** (backend) → **Supabase** (database)

Domains:

| URL | Purpose |
|-----|---------|
| `https://pms.stayatumalila.com/login` | Staff login + PMS |
| `https://booking.stayatumalila.com` | Guest booking form |

---

## Step 1 — Supabase (production database)

1. Create a **production** project in [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor** and run migrations in order (see [SUPABASE_MIGRATIONS.md](./SUPABASE_MIGRATIONS.md)).
3. Run `backend/db/seeds/umalila-tenant.sql`:
   - Generate password hash:
     ```bash
     cd backend
     node --input-type=module -e "import('./lib/rbac/auth.js').then(m => console.log(m.hashPassword('YourPassword')))"
     ```
   - Replace `REPLACE_WITH_PASSWORD_HASH` in the seed file.
   - Run the SQL in Supabase.
4. Copy from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (backend only, never frontend)

**Check:** `SELECT slug FROM public.tenants;` returns `umalila`.

---

## Step 2 — Railway (backend API)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select this repository.
3. **Settings → Root Directory** → `backend`
4. **Settings → Deploy** → Start command: `npm start`
5. **Variables** tab — add:

```
NODE_ENV=production
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=<long-random-string>
BOOKING_TOKEN_SECRET=<another-long-random-string>
DEFAULT_TENANT_SLUG=umalila
CORS_ORIGIN=https://pms.stayatumalila.com,https://booking.stayatumalila.com
```

6. **Settings → Networking → Generate Domain** — copy the public URL, e.g.  
   `https://umalila-pms-production.up.railway.app`

**Check:** open `https://YOUR-RAILWAY-URL.up.railway.app/status`  
→ `{ "status": "Umalila Engine Running Smoothly" }`

### Optional: custom API domain

1. Railway → **Custom Domain** → `api.stayatumalila.com`
2. Cloudflare DNS (Step 4): `api` CNAME → Railway target
3. Use `https://api.stayatumalila.com` as `VITE_API_BASE_URL` instead of the `.up.railway.app` URL

---

## Step 3 — Vercel (frontend)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo.
2. **Root Directory** → `frontend`
3. **Framework** → Vite (auto-detected)
4. **Environment Variables** (Production):

```
VITE_TENANT_SLUG=umalila
VITE_API_BASE_URL=https://YOUR-RAILWAY-URL.up.railway.app
```

No trailing slash on the API URL.

5. Click **Deploy** and wait for the build to finish.

**Check:** Vercel gives you a `*.vercel.app` URL — site loads (may not login until Step 4–5).

---

## Step 4 — Cloudflare DNS

In Cloudflare → your zone `stayatumalila.com` → **DNS → Records**:

### Frontend → Vercel

First add domains in **Vercel → Project → Settings → Domains**:

- `pms.stayatumalila.com`
- `booking.stayatumalila.com`

Vercel shows the CNAME target (often `cname.vercel-dns.com`).

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `pms` | *(Vercel CNAME target)* | DNS only (grey cloud) |
| CNAME | `booking` | *(same Vercel target)* | DNS only (grey cloud) |

### API → Railway (optional)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `api` | *(Railway custom domain target)* | DNS only |

**SSL/TLS** in Cloudflare: **Full** or **Full (strict)**.

Wait a few minutes for DNS propagation.

**Check:**

- `https://pms.stayatumalila.com/login` — login page
- `https://booking.stayatumalila.com` — booking form

---

## Step 5 — Redeploy & verify login

1. Confirm Vercel has `VITE_API_BASE_URL` pointing at Railway.
2. **Redeploy** Vercel (Deployments → … → Redeploy) so env vars are baked in.
3. Open `https://pms.stayatumalila.com/login`
4. DevTools → **Network** → sign in with `admin1@umalila.com`

Login request must go to:

```
POST https://YOUR-RAILWAY-URL.up.railway.app/api/auth/login
```

| Status | Meaning |
|--------|---------|
| **404** | Wrong API URL or backend not running — fix Railway / `VITE_API_BASE_URL` |
| **401** | Wrong password — API works |
| **200** | Success |
| **CORS error** | Add frontend URL to Railway `CORS_ORIGIN` |

---

## Step 6 — Smoke tests

- [ ] `pms.stayatumalila.com/login` — sign in, land on dashboard
- [ ] `pms.stayatumalila.com/dashboard` — overview loads
- [ ] `booking.stayatumalila.com` — submit a test reservation (no login)
- [ ] Railway logs show API requests without errors

---

## Quick reference

| What | Where |
|------|--------|
| Frontend env | Vercel → Settings → Environment Variables |
| Backend env | Railway → Variables |
| DNS | Cloudflare → DNS |
| DB | Supabase → SQL Editor |
| Login URL | `https://pms.stayatumalila.com/login` |
| API health | `https://<railway>/status` |
