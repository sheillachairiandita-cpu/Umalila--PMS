# Git workflow

This repository uses your existing branch layout on GitHub.

## Branches

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `master` | Production-ready code | **Production** |
| `environment-1` | Integration / shared development | **Development** |
| `feature/*` | Short-lived work (e.g. `feature/tenant-config`) | Local only |

## Flow

```
feature/my-change  →  environment-1  →  master  →  Production
```

### 1. Feature branches (`feature/*`)

- Branch from `environment-1`
- One logical change per branch
- Open PR into `environment-1`
- Delete after merge

```bash
git checkout environment-1
git pull origin environment-1
git checkout -b feature/my-change
# ... commits ...
git push -u origin feature/my-change
```

### 2. `environment-1` (development)

- Receives merged features
- Should always build and pass smoke tests
- Maps to **development** env files (`.env.development`, dev Supabase project)
- Never force-push without team agreement

### 3. `master` (production)

- Only updated from `environment-1` via PR when a release is ready (or via hotfix flow)
- Tag releases for traceability (`v1.2.0`)
- Triggers **production** deployment

```bash
# Release example
git checkout master
git pull origin master
git merge environment-1
git tag v1.0.0
git push origin master --tags
```

Prefer a PR on GitHub (`environment-1` → `master`) instead of merging locally when possible.

## Hotfixes

Urgent production fixes:

```bash
git checkout master
git pull origin master
git checkout -b hotfix/critical-fix
# fix, PR to master, then merge master back into environment-1
```

## Environment ↔ branch mapping

| Branch | `NODE_ENV` | Supabase | Env file |
|--------|------------|----------|----------|
| `environment-1` | `development` | Dev project | `.env.development` |
| `master` | `production` | Prod project | `.env.production` |

Never use production secrets on `environment-1` or development secrets on `master`.

## Commit messages

Use clear, imperative summaries:

- `Add tenant config module`
- `Fix holidays endpoint tenant scoping`
- `Document Cloudflare Pages deployment`

## What not to commit

- `.env`, `.env.development`, `.env.production` (real secrets)
- `node_modules/`, `frontend/dist/`
- Supabase service role keys

Commit only `*.example` env templates.

## GitHub settings (recommended)

Protect `master` and `environment-1`:

- Require pull request before merge
- Require status checks when CI is added
- Block force-push to `master`

## Local development

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) — run frontend on `localhost:5173` and API on `localhost:5000` using the **dev** Supabase project on branch `environment-1`.
