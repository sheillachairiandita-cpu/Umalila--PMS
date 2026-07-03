/**
 * Which surface of the SPA to show based on hostname.
 * - admin  → pms.* (staff login + dashboard only)
 * - booking → booking.* (guest reservation form only)
 * - all    → localhost / preview (both route trees, for development)
 */

function trim(value) {
  return typeof value === 'string' ? value.trim() : value;
}

const ADMIN_HOSTS = new Set([
  'pms.stayatumalila.com',
]);

const BOOKING_HOSTS = new Set([
  'booking.stayatumalila.com',
]);

export const HOST_MODES = Object.freeze({
  ADMIN: 'admin',
  BOOKING: 'booking',
  ALL: 'all',
});

export function resolveHostMode() {
  const override = trim(import.meta.env.VITE_APP_HOST_MODE);
  if (override === HOST_MODES.ADMIN || override === HOST_MODES.BOOKING || override === HOST_MODES.ALL) {
    return override;
  }

  if (typeof window === 'undefined') {
    return HOST_MODES.ALL;
  }

  const hostname = window.location.hostname;
  if (ADMIN_HOSTS.has(hostname)) return HOST_MODES.ADMIN;
  if (BOOKING_HOSTS.has(hostname)) return HOST_MODES.BOOKING;
  return HOST_MODES.ALL;
}
