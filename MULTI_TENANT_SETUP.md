# Multi-tenant setup

## 1. Run migrations (Supabase SQL Editor, in order)

1. `backend/db/migrations/002_multi_tenant.sql`
2. `backend/db/migrations/004_audit_log.sql`
3. `backend/db/migrations/003_indexes.sql`
4. `backend/db/migrations/005_booking_income_view.sql`
5. `backend/db/migrations/007_dashboard_kpi_rpc.sql`
6. `backend/db/migrations/006_rls_policies.sql`

## 2. Environment variables

### Backend (`backend/.env`)
```
SESSION_SECRET=your-long-random-secret
BOOKING_TOKEN_SECRET=another-long-random-secret
DEFAULT_PROPERTY_SLUG=umalila
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Frontend (`frontend/.env`)
```
VITE_PROPERTY_SLUG=umalila
```

## 3. Public booking security

- Unauthenticated `PATCH /api/bookings/:id` and `/cancel` require `?token=` (manage token returned on booking create).
- Admin users with `bookings:write` can modify without token (same property).

## 4. Roles

`owner`, `admin`, `manager`, `receptionist`, `housekeeping`, `staff` (legacy alias for receptionist).
