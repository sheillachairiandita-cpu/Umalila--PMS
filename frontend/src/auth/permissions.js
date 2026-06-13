/**
 * Frontend RBAC — keep permission keys in sync with backend/lib/rbac.js
 */

export const ROLES = ['owner', 'admin', 'staff'];
export const ALL_PERMISSIONS = '*';

export const PERMISSIONS = {
  PAGE_DASHBOARD: 'page:dashboard',
  PAGE_CALENDAR: 'page:calendar',
  PAGE_RESERVATIONS: 'page:reservations',
  PAGE_FINANCIAL: 'page:financial',
  PAGE_INSIGHTS: 'page:insights',
  PAGE_PRICING: 'page:pricing',
  PAGE_USERS: 'page:users',
  PAGE_SETTINGS: 'page:settings',

  BOOKINGS_READ: 'bookings:read',
  BOOKINGS_WRITE: 'bookings:write',
  OVERVIEW_OPERATE: 'overview:operate',
  ORDERS_MANAGE: 'orders:manage',
  MENU_READ: 'menu:read',
  CALENDAR_READ: 'calendar:read',
  CALENDAR_BLOCK: 'calendar:block',
  CALENDAR_BOOK: 'calendar:book',
  FINANCIAL_READ: 'financial:read',
  FINANCIAL_WRITE: 'financial:write',
  PRICING_READ: 'pricing:read',
  PRICING_WRITE: 'pricing:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  DASHBOARD_READ: 'dashboard:read',
};

const P = PERMISSIONS;

const STAFF_PERMISSIONS = [
  P.PAGE_DASHBOARD,
  P.PAGE_CALENDAR,
  P.BOOKINGS_READ,
  P.OVERVIEW_OPERATE,
  P.ORDERS_MANAGE,
  P.MENU_READ,
  P.CALENDAR_READ,
];

export const ROLE_PERMISSIONS = {
  owner: [ALL_PERMISSIONS],
  admin: [ALL_PERMISSIONS],
  staff: STAFF_PERMISSIONS,
};

export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const grants = ROLE_PERMISSIONS[role];
  if (!grants) return false;
  if (grants.includes(ALL_PERMISSIONS)) return true;
  return grants.includes(permission);
}

export function hasAnyPermission(role, permissions = []) {
  return permissions.some((p) => hasPermission(role, p));
}

/** Admin page slug → required page permission */
export const PAGE_PERMISSIONS = {
  dashboard: P.PAGE_DASHBOARD,
  calendar: P.PAGE_CALENDAR,
  reservations: P.PAGE_RESERVATIONS,
  financial: P.PAGE_FINANCIAL,
  insights: P.PAGE_INSIGHTS,
  pricing: P.PAGE_PRICING,
  users: P.PAGE_USERS,
  settings: P.PAGE_SETTINGS,
};

export function getPagePermission(pageSlug) {
  return PAGE_PERMISSIONS[pageSlug] || null;
}

export function canAccessPage(role, pageSlug) {
  const permission = getPagePermission(pageSlug);
  if (!permission) return false;
  return hasPermission(role, permission);
}

export function getDefaultPageForRole(role) {
  const order = ['dashboard', 'calendar', 'reservations', 'financial', 'insights', 'pricing', 'users', 'settings'];
  return order.find((page) => canAccessPage(role, page)) || 'dashboard';
}

export function getAccessiblePages(role) {
  return Object.keys(PAGE_PERMISSIONS).filter((page) => canAccessPage(role, page));
}
