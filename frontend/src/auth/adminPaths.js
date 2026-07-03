import { config, HOST_MODES } from '../config/index.js';

/** '' on pms.* (e.g. /login, /dashboard); '/admin' on localhost dev */
export function adminPrefix() {
  return config.app.hostMode === HOST_MODES.ADMIN ? '' : '/admin';
}

export function adminPath(segment = '') {
  const prefix = adminPrefix();
  if (!segment) return prefix || '/';
  return `${prefix}/${segment}`.replace(/\/+/g, '/');
}

export function adminLoginPath() {
  return adminPath('login');
}

export function parseAdminActivePage(pathname) {
  const prefix = adminPrefix();
  const stripped = prefix
    ? pathname.replace(new RegExp(`^${prefix}/?`), '')
    : pathname.replace(/^\//, '');
  return stripped.split('/')[0] || 'dashboard';
}
