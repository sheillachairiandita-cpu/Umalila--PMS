const PROPERTY_SLUG = import.meta.env.VITE_PROPERTY_SLUG || 'umalila';

function buildHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('X-Property-Slug')) {
    headers.set('X-Property-Slug', PROPERTY_SLUG);
  }
  return headers;
}

export async function apiFetch(path, init = {}) {
  const url = path.startsWith('/api') ? path : `/api${path}`;
  const response = await fetch(url, {
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

export { PROPERTY_SLUG };
