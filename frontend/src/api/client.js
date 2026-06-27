import { config } from '../config/index.js';

function buildHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has(config.tenant.slugHeader)) {
    headers.set(config.tenant.slugHeader, config.tenant.slug);
  }
  return headers;
}

function resolveUrl(path) {
  const normalized = path.startsWith('/api') ? path : `/api${path}`;
  const base = config.api.baseUrl;
  if (!base) return normalized;
  return `${base}${normalized}`;
}

export async function apiFetch(path, init = {}) {
  const response = await fetch(resolveUrl(path), {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init),
  });
  return response;
}

export async function apiJson(path, init = {}) {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

/** Unwrap paginated `{ data, nextCursor, hasMore }` or return array as-is. */
export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

/** @deprecated Use config.tenant.slug */
export const TENANT_SLUG = config.tenant.slug;

/** @deprecated Use config.tenant.slug */
export const PROPERTY_SLUG = config.tenant.slug;

export { config };
