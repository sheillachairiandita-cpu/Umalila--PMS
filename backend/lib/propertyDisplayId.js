/** @param {Date} [date] */
export function formatPropertyDisplayDate(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  return `${mm}${dd}${yy}`;
}

/** @param {Date} [date] */
export function buildPropertyDisplayIdPrefix(date = new Date()) {
  return `PRP${formatPropertyDisplayDate(date)}`;
}

/**
 * Next property display id for the given date: PRPMMDDYY001, PRPMMDDYY002, …
 * @param {string[]} existingDisplayIds
 * @param {Date} [date]
 */
export function nextPropertyDisplayId(existingDisplayIds, date = new Date()) {
  const prefix = buildPropertyDisplayIdPrefix(date);
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}(\\d{3})$`);

  let maxNum = 0;
  for (const displayId of existingDisplayIds || []) {
    const match = displayId?.match(pattern);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}
