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

export const ADMIN_NAV_ITEMS = [
  {
    group: 'Operations',
    items: [
      { page: 'dashboard', path: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, permission: PERMISSIONS.PAGE_DASHBOARD },
      { page: 'calendar', path: '/admin/calendar', label: 'Calendar', icon: Calendar, permission: PERMISSIONS.PAGE_CALENDAR },
      { page: 'reservations', path: '/admin/reservations', label: 'Reservations', icon: ClipboardList, permission: PERMISSIONS.PAGE_RESERVATIONS },
      { page: 'financial', path: '/admin/financial', label: 'Financial', icon: Wallet, permission: PERMISSIONS.PAGE_FINANCIAL },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { page: 'insights', path: '/admin/insights', label: 'Dashboard', icon: PieChart, permission: PERMISSIONS.PAGE_INSIGHTS },
    ],
  },
  {
    group: 'System',
    items: [
      { page: 'pricing', path: '/admin/pricing', label: 'Pricing', icon: Tags, permission: PERMISSIONS.PAGE_PRICING },
      { page: 'users', path: '/admin/users', label: 'Users', icon: Users, permission: PERMISSIONS.PAGE_USERS },
      { page: 'settings', path: '/admin/settings', label: 'Settings', icon: Sliders, permission: PERMISSIONS.PAGE_SETTINGS },
    ],
  },
];

export function getNavItemsForRole(role, hasPermissionFn) {
  return ADMIN_NAV_ITEMS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermissionFn(role, item.permission)),
  })).filter((group) => group.items.length > 0);
}
