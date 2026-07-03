import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Wallet,
  PieChart,
  Tags,
  Users,
  Sliders,
} from 'lucide-react';
import { PERMISSIONS } from './permissions';
import { adminPath } from './adminPaths';

const ADMIN_NAV_PAGES = [
  {
    group: 'Operations',
    items: [
      { page: 'dashboard', label: 'Overview', icon: LayoutDashboard, permission: PERMISSIONS.PAGE_DASHBOARD },
      { page: 'calendar', label: 'Calendar', icon: Calendar, permission: PERMISSIONS.PAGE_CALENDAR },
      { page: 'reservations', label: 'Reservations', icon: ClipboardList, permission: PERMISSIONS.PAGE_RESERVATIONS },
      { page: 'financial', label: 'Financial', icon: Wallet, permission: PERMISSIONS.PAGE_FINANCIAL },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { page: 'insights', label: 'Dashboard', icon: PieChart, permission: PERMISSIONS.PAGE_INSIGHTS },
    ],
  },
  {
    group: 'System',
    items: [
      { page: 'pricing', label: 'Pricing', icon: Tags, permission: PERMISSIONS.PAGE_PRICING },
      { page: 'users', label: 'Users', icon: Users, permission: PERMISSIONS.PAGE_USERS },
      { page: 'settings', label: 'Settings', icon: Sliders, permission: PERMISSIONS.PAGE_SETTINGS },
    ],
  },
];

/** @deprecated Use getNavItemsForRole — paths are built dynamically for pms vs localhost */
export const ADMIN_NAV_ITEMS = ADMIN_NAV_PAGES.map((group) => ({
  ...group,
  items: group.items.map((item) => ({ ...item, path: adminPath(item.page) })),
}));

export function getNavItemsForRole(role, hasPermissionFn) {
  return ADMIN_NAV_PAGES.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => hasPermissionFn(role, item.permission))
      .map((item) => ({ ...item, path: adminPath(item.page) })),
  })).filter((group) => group.items.length > 0);
}
