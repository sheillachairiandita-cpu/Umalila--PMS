/**
 * Trim, collapse spaces, and title-case each word (e.g. "SHEILLA CHAIRIANDITA" → "Sheilla Chairiandita").
 * @param {string} value
 * @returns {string}
 */
export function toTitleCaseName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
