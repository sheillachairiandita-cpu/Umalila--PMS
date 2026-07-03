/**
 * Central frontend configuration.
 * Values come from Vite env files (.env.development / .env.production).
 * Never put Supabase service-role keys here.
 */

import { HOST_MODES, resolveHostMode } from './hostMode.js';

function trim(value) {
  return typeof value === 'string' ? value.trim() : value;
}

const mode = import.meta.env.MODE || 'development';
const isProduction = mode === 'production';
const isDevelopment = mode === 'development';

function resolveTenantSlug() {
  return trim(import.meta.env.VITE_TENANT_SLUG)
    || trim(import.meta.env.VITE_PROPERTY_SLUG)
    || 'umalila';
}

function resolveApiBaseUrl() {
  const base = trim(import.meta.env.VITE_API_BASE_URL);
  if (base) return base.replace(/\/$/, '');
  // Empty string = same origin (Vite dev proxy or Cloudflare Pages + Worker routing)
  return '';
}

/** @type {Readonly<{
 *   env: string;
 *   isProduction: boolean;
 *   isDevelopment: boolean;
 *   api: { baseUrl: string };
 *   tenant: { slug: string; slugHeader: string };
 *   app: { hostMode: string };
 * }>} */
export const config = Object.freeze({
  env: mode,
  isProduction,
  isDevelopment,

  api: {
    baseUrl: resolveApiBaseUrl(),
  },

  tenant: {
    slug: resolveTenantSlug(),
    slugHeader: 'X-Tenant-Slug',
    legacySlugHeader: 'X-Property-Slug',
  },

  app: {
    hostMode: resolveHostMode(),
  },
});

export { HOST_MODES };

export default config;
