const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parsePagination(query) {
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = query.cursor || null;
  return { limit, cursor };
}

/**
 * Apply cursor pagination on created_at DESC lists.
 * Fetches limit+1 rows to detect hasMore.
 */
export async function fetchCursorPage(query, { limit, cursor }) {
  let q = query.order('created_at', { ascending: false }).limit(limit + 1);
  if (cursor) {
    q = q.lt('created_at', cursor);
  }
  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

  return { data: page, nextCursor, hasMore };
}

export function paginatedJson(res, { data, nextCursor, hasMore }) {
  res.json({ data, nextCursor, hasMore });
}
