/**
 * Centralized RBAC — source of truth for role permissions.
 * Keep permission keys in sync with frontend/src/auth/permissions.js
 */

export const ROLES = ['owner', 'admin', 'manager', 'receptionist', 'housekeeping', 'staff'];

/** Wildcard grants every permission. */
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

const HOUSEKEEPING_PERMISSIONS = [
  P.PAGE_DASHBOARD,
  P.BOOKINGS_READ,
];

const RECEPTIONIST_PERMISSIONS = [
  P.PAGE_DASHBOARD,
  P.PAGE_CALENDAR,
  P.PAGE_RESERVATIONS,
  P.BOOKINGS_READ,
  P.BOOKINGS_WRITE,
  P.OVERVIEW_OPERATE,
  P.ORDERS_MANAGE,
  P.MENU_READ,
  P.CALENDAR_READ,
  P.CALENDAR_BOOK,
];

const MANAGER_PERMISSIONS = [
  ...RECEPTIONIST_PERMISSIONS,
  P.PAGE_FINANCIAL,
  P.FINANCIAL_READ,
  P.PAGE_INSIGHTS,
  P.DASHBOARD_READ,
  P.CALENDAR_BLOCK,
  P.PRICING_READ,
];

/** Legacy staff role — same as receptionist */
const STAFF_PERMISSIONS = RECEPTIONIST_PERMISSIONS;

export const ROLE_PERMISSIONS = {
  owner: [ALL_PERMISSIONS],
  admin: [ALL_PERMISSIONS],
  manager: MANAGER_PERMISSIONS,
  receptionist: RECEPTIONIST_PERMISSIONS,
  housekeeping: HOUSEKEEPING_PERMISSIONS,
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

/** Public API routes — no session required (property resolved via slug header/query). */
export const PUBLIC_API_ROUTES = [
  { methods: ['POST'], pattern: /^\/api\/auth\/login$/ },
  { methods: ['GET'], pattern: /^\/api\/villas$/ },
  { methods: ['GET'], pattern: /^\/api\/addons$/ },
  { methods: ['GET'], pattern: /^\/api\/pricing\/holidays$/ },
  { methods: ['GET'], pattern: /^\/api\/discounts$/ },
  { methods: ['GET'], pattern: /^\/api\/villas\/availability$/ },
  { methods: ['POST'], pattern: /^\/api\/guests$/ },
  { methods: ['POST'], pattern: /^\/api\/bookings$/ },
];

/**
 * API route → required permission (authenticated users only).
 * null = any authenticated active user.
 */
export const API_ROUTE_RULES = [
  { methods: ['GET'], pattern: /^\/api\/auth\/me$/, permission: null },

  { methods: ['POST'], pattern: /^\/api\/auth\/logout$/, permission: null },

  { methods: ['PATCH'], pattern: /^\/api\/auth\/change-password$/, permission: null },

  { methods: ['GET'], pattern: /^\/api\/bookings$/, permission: P.BOOKINGS_READ },
  { methods: ['GET'], pattern: /^\/api\/bookings\/[^/]+\/invoice(\/pdf)?$/, permission: P.OVERVIEW_OPERATE },
  { methods: ['GET'], pattern: /^\/api\/bookings\/[^/]+\/invoice$/, permission: P.OVERVIEW_OPERATE },
  { methods: ['PATCH'], pattern: /^\/api\/bookings\/[^/]+\/check-in$/, permission: P.OVERVIEW_OPERATE },
  { methods: ['PATCH'], pattern: /^\/api\/bookings\/[^/]+\/check-out$/, permission: P.OVERVIEW_OPERATE },

  { methods: ['GET'], pattern: /^\/api\/bookings\/[^/]+\/food-orders$/, permission: P.ORDERS_MANAGE },
  { methods: ['POST'], pattern: /^\/api\/bookings\/[^/]+\/food-orders$/, permission: P.ORDERS_MANAGE },
  { methods: ['GET'], pattern: /^\/api\/bookings\/[^/]+\/orders$/, permission: P.ORDERS_MANAGE },
  { methods: ['POST'], pattern: /^\/api\/bookings\/[^/]+\/orders$/, permission: P.ORDERS_MANAGE },
  { methods: ['PATCH'], pattern: /^\/api\/orders\/[^/]+\/status$/, permission: P.ORDERS_MANAGE },

  { methods: ['GET'], pattern: /^\/api\/menu-items$/, permission: P.MENU_READ },

  { methods: ['GET'], pattern: /^\/api\/villas\/gantt$/, permission: P.CALENDAR_READ },
  { methods: ['POST'], pattern: /^\/api\/villas\/blocks$/, permission: P.CALENDAR_BLOCK },
  { methods: ['DELETE'], pattern: /^\/api\/villas\/blocks\/[^/]+$/, permission: P.CALENDAR_BLOCK },

  { methods: ['PATCH'], pattern: /^\/api\/bookings\/[^/]+\/status$/, permission: P.BOOKINGS_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/bookings\/[^/]+\/payment-status$/, permission: P.BOOKINGS_WRITE },
  { methods: ['POST'], pattern: /^\/api\/bookings\/[^/]+\/payments$/, permission: P.BOOKINGS_WRITE },
  { methods: ['POST'], pattern: /^\/api\/bookings\/[^/]+\/upload-receipt$/, permission: P.BOOKINGS_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/bookings\/[^/]+\/cancel$/, permission: P.BOOKINGS_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/bookings\/[^/]+$/, permission: P.BOOKINGS_WRITE },

  { methods: ['GET'], pattern: /^\/api\/financial\//, permission: P.FINANCIAL_READ },
  { methods: ['POST'], pattern: /^\/api\/financial\//, permission: P.FINANCIAL_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/financial\//, permission: P.FINANCIAL_WRITE },

  { methods: ['GET'], pattern: /^\/api\/dashboard$/, permission: P.DASHBOARD_READ },

  { methods: ['GET'], pattern: /^\/api\/users$/, permission: P.USERS_READ },
  { methods: ['POST'], pattern: /^\/api\/users$/, permission: P.USERS_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/users\/[^/]+$/, permission: P.USERS_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/users\/[^/]+\/status$/, permission: P.USERS_WRITE },

  { methods: ['GET'], pattern: /^\/api\/menu-items/, permission: P.PRICING_READ },
  { methods: ['POST'], pattern: /^\/api\/menu-items/, permission: P.PRICING_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/menu-items/, permission: P.PRICING_WRITE },
  { methods: ['DELETE'], pattern: /^\/api\/menu-items/, permission: P.PRICING_WRITE },

  { methods: ['GET'], pattern: /^\/api\/addons/, permission: P.PRICING_READ },
  { methods: ['POST'], pattern: /^\/api\/addons/, permission: P.PRICING_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/addons/, permission: P.PRICING_WRITE },
  { methods: ['DELETE'], pattern: /^\/api\/addons/, permission: P.PRICING_WRITE },

  { methods: ['GET'], pattern: /^\/api\/discounts/, permission: P.PRICING_READ },
  { methods: ['POST'], pattern: /^\/api\/discounts/, permission: P.PRICING_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/discounts/, permission: P.PRICING_WRITE },
  { methods: ['DELETE'], pattern: /^\/api\/discounts/, permission: P.PRICING_WRITE },

  { methods: ['GET'], pattern: /^\/api\/pricing\//, permission: P.PRICING_READ },
  { methods: ['POST'], pattern: /^\/api\/pricing\//, permission: P.PRICING_WRITE },
  { methods: ['DELETE'], pattern: /^\/api\/pricing\//, permission: P.PRICING_WRITE },

  { methods: ['POST'], pattern: /^\/api\/villas$/, permission: P.PRICING_WRITE },
  { methods: ['PATCH'], pattern: /^\/api\/villas\/[^/]+$/, permission: P.PRICING_WRITE },
  { methods: ['DELETE'], pattern: /^\/api\/villas\/[^/]+$/, permission: P.PRICING_WRITE },
];

export function isPublicApiRoute(method, path) {
  return PUBLIC_API_ROUTES.some(
    (rule) => rule.methods.includes(method) && rule.pattern.test(path),
  );
}

export function getAuthenticatedPublicOverride(method, path) {
  for (const rule of AUTHENTICATED_PUBLIC_OVERRIDES) {
    if (rule.methods.includes(method) && rule.pattern.test(path)) {
      return rule.permission;
    }
  }
  return null;
}

/** When logged in, these public routes require elevated permissions. */
export const AUTHENTICATED_PUBLIC_OVERRIDES = [
  { methods: ['POST'], pattern: /^\/api\/bookings$/, permission: P.BOOKINGS_WRITE },
];

export function getRequiredApiPermission(method, path) {
  for (const rule of API_ROUTE_RULES) {
    if (rule.methods.includes(method) && rule.pattern.test(path)) {
      return rule.permission;
    }
  }
  return undefined;
}
