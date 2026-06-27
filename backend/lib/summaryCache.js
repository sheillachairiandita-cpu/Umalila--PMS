const DEFAULT_TTL_MS = 60_000;

/**
 * Short-lived in-memory cache for buildFinancialSummary (per tenant + booking).
 * KPI dashboards benefit; payment/invoice routes should use the uncached builder.
 */
export function createSummaryCache(buildFinancialSummary, { ttlMs = DEFAULT_TTL_MS } = {}) {
  /** @type {Map<string, { value: unknown, expiresAt: number }>} */
  const cache = new Map();

  function cacheKey(tenantId, bookingId) {
    return `${tenantId}:${bookingId}`;
  }

  async function getCachedSummary(bookingId, tenantId) {
    const key = cacheKey(tenantId, bookingId);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
    const value = await buildFinancialSummary(bookingId, tenantId);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  function invalidateSummary(bookingId, tenantId) {
    if (bookingId && tenantId) {
      cache.delete(cacheKey(tenantId, bookingId));
    }
  }

  function invalidateTenant(tenantId) {
    if (!tenantId) return;
    const prefix = `${tenantId}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  }

  return { getCachedSummary, invalidateSummary, invalidateTenant };
}
