/** @param {string} name */
export function normalizeTenantLetters(name) {
  return (name || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
}

/**
 * @param {string} letters
 * @param {number} length
 */
export function prefixAtLength(letters, length) {
  if (!letters) return 'X'.repeat(length);
  if (letters.length >= length) return letters.slice(0, length);
  return letters.padEnd(length, 'X');
}

/**
 * Minimum-length unique letter prefix for a tenant (3+ chars).
 * Collisions bump length (e.g. Kayu Putih and Kayaking both start as KAY → KAYU / KAYA).
 * @param {string} tenantName
 * @param {string[]} allTenantNames
 */
export function resolveTenantUserPrefix(tenantName, allTenantNames) {
  const letters = normalizeTenantLetters(tenantName);
  const allLetters = (allTenantNames || [])
    .map(normalizeTenantLetters)
    .filter(Boolean);

  if (!letters) return 'USR';

  const maxLen = Math.max(letters.length, 3, ...allLetters.map((l) => l.length));

  for (let len = 3; len <= maxLen; len += 1) {
    const prefix = prefixAtLength(letters, len);
    const collision = allLetters.some(
      (other) => other !== letters && prefixAtLength(other, len) === prefix,
    );
    if (!collision) return prefix;
  }

  return letters;
}

/**
 * Next user display id for a tenant prefix: UMA001, KAY002, …
 * @param {string[]} existingDisplayIds
 * @param {string} prefix
 */
export function nextUserDisplayId(existingDisplayIds, prefix) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}(\\d{3})$`, 'i');

  let maxNum = 0;
  for (const displayId of existingDisplayIds || []) {
    const match = displayId?.match(pattern);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}
