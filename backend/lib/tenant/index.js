import { config } from '../../config/index.js';

/** Tables scoped by the `tenant_id` column. */
export const TENANT_SCOPED_TABLES = new Set([
  'bookings',
  'properties',
  'guests',
  'menu_items',
  'addons',
  'discounts',
  'pricing_holidays',
  'property_date_blocks',
  'finances',
  'users',
  'orders',
  'property_cost_profiles',
  'reservation_profitability',
]);

const tenantCache = new Map();

export function assertTenantId(tenantId) {
  if (!tenantId) {
    const err = new Error('Tenant context required.');
    err.status = 400;
    throw err;
  }
  return tenantId;
}

function applyTenantFilter(query, tenantId) {
  if (typeof query?.eq === 'function') {
    return query.eq('tenant_id', tenantId);
  }
  return query;
}

/** Append .eq('tenant_id', …) for tenant-scoped tables. */
export function finishScope(query, tenantId, table) {
  if (!TENANT_SCOPED_TABLES.has(table)) return query;
  assertTenantId(tenantId);
  return applyTenantFilter(query, tenantId);
}

/** Inject tenant_id into insert/upsert payloads. */
export function withTenantId(rows, tenantId, table) {
  if (!TENANT_SCOPED_TABLES.has(table)) return rows;
  assertTenantId(tenantId);
  if (Array.isArray(rows)) {
    return rows.map((row) => ({ ...row, tenant_id: tenantId }));
  }
  return { ...rows, tenant_id: tenantId };
}

export function getTenantSlug(req) {
  const headerSlug = req.headers[config.tenant.slugHeader]
    || req.headers[config.tenant.legacySlugHeader];
  return (
    req.query?.tenant
    || req.query?.property
    || headerSlug
    || config.tenant.slug
  );
}

export async function resolveTenantId(supabase, req) {
  if (req.user) {
    if (!req.user.tenant_id) {
      const err = new Error('User is not assigned to a tenant.');
      err.status = 403;
      throw err;
    }
    return req.user.tenant_id;
  }

  const slug = getTenantSlug(req);
  if (tenantCache.has(slug)) {
    return tenantCache.get(slug);
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    const err = new Error(`Unknown tenant: ${slug}`);
    err.status = 404;
    throw err;
  }

  tenantCache.set(slug, data.id);
  return data.id;
}

export function createTenantMiddleware(supabase) {
  return async function tenantMiddleware(req, res, next) {
    if (!req.path.startsWith('/api')) return next();

    try {
      req.tenantId = await resolveTenantId(supabase, req);
      return next();
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  };
}

/**
 * Tenant-scoped Supabase builder.
 * Supabase JS v2.50+ only exposes .eq() after select/update/delete — not on .from() directly.
 */
export function scoped(supabase, tenantId, table) {
  const from = supabase.from(table);
  if (!TENANT_SCOPED_TABLES.has(table)) {
    return from;
  }
  assertTenantId(tenantId);

  return {
    select(columns, opts) {
      return applyTenantFilter(from.select(columns, opts), tenantId);
    },
    insert(rows, opts) {
      return from.insert(withTenantId(rows, tenantId, table), opts);
    },
    update(values, opts) {
      return applyTenantFilter(from.update(values, opts), tenantId);
    },
    delete(opts) {
      return applyTenantFilter(from.delete(opts), tenantId);
    },
    upsert(rows, opts) {
      return from.upsert(withTenantId(rows, tenantId, table), opts);
    },
  };
}

// Legacy aliases (deprecated)
export const PROPERTY_SCOPED_TABLES = TENANT_SCOPED_TABLES;
export const assertPropertyId = assertTenantId;
export const withPropertyId = withTenantId;
export const getPropertySlug = getTenantSlug;
export const resolvePropertyId = resolveTenantId;
export const createPropertyMiddleware = createTenantMiddleware;
