/** Tables that carry a direct property_id column. */
export const PROPERTY_SCOPED_TABLES = new Set([
  'bookings',
  'villas',
  'guests',
  'menu_items',
  'addons',
  'discounts',
  'pricing_holidays',
  'villa_date_blocks',
  'finances',
  'users',
  'orders',
  'villa_cost_profiles',
  'reservation_profitability',
]);

const propertyCache = new Map();

export function assertPropertyId(propertyId) {
  if (!propertyId) {
    const err = new Error('Property context required.');
    err.status = 400;
    throw err;
  }
  return propertyId;
}

/** Append .eq('property_id', …) when the query builder supports filters. */
function applyPropertyFilter(query, propertyId) {
  if (typeof query?.eq === 'function') {
    return query.eq('property_id', propertyId);
  }
  return query;
}

/** Append .eq('property_id', …) for tenant-scoped tables. */
export function finishScope(query, propertyId, table) {
  if (!PROPERTY_SCOPED_TABLES.has(table)) return query;
  assertPropertyId(propertyId);
  return applyPropertyFilter(query, propertyId);
}

/** Inject property_id into insert payloads. */
export function withPropertyId(rows, propertyId, table) {
  if (!PROPERTY_SCOPED_TABLES.has(table)) return rows;
  assertPropertyId(propertyId);
  if (Array.isArray(rows)) {
    return rows.map((row) => ({ ...row, property_id: propertyId }));
  }
  return { ...rows, property_id: propertyId };
}

export function getPropertySlug(req) {
  return (
    req.query?.property
    || req.headers['x-property-slug']
    || process.env.DEFAULT_PROPERTY_SLUG
    || 'umalila'
  );
}

export async function resolvePropertyId(supabase, req) {
  if (req.user?.property_id) {
    return req.user.property_id;
  }

  const slug = getPropertySlug(req);
  if (propertyCache.has(slug)) {
    return propertyCache.get(slug);
  }

  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    const err = new Error(`Unknown property: ${slug}`);
    err.status = 404;
    throw err;
  }

  propertyCache.set(slug, data.id);
  return data.id;
}

export function createPropertyMiddleware(supabase) {
  return async function propertyMiddleware(req, res, next) {
    if (!req.path.startsWith('/api')) return next();

    try {
      req.propertyId = await resolvePropertyId(supabase, req);
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
export function scoped(supabase, propertyId, table) {
  const from = supabase.from(table);
  if (!PROPERTY_SCOPED_TABLES.has(table)) {
    return from;
  }
  assertPropertyId(propertyId);

  return {
    select(columns, opts) {
      return applyPropertyFilter(from.select(columns, opts), propertyId);
    },
    insert(rows, opts) {
      return from.insert(withPropertyId(rows, propertyId, table), opts);
    },
    update(values, opts) {
      return applyPropertyFilter(from.update(values, opts), propertyId);
    },
    delete(opts) {
      return applyPropertyFilter(from.delete(opts), propertyId);
    },
    upsert(rows, opts) {
      return from.upsert(withPropertyId(rows, propertyId, table), opts);
    },
  };
}
