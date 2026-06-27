import '../loadEnv.js';

const DEV_SESSION_FALLBACK = 'umalila-dev-session-secret';
const DEV_BOOKING_TOKEN_FALLBACK = 'umalila-dev-booking-token-secret';

function trim(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function required(name, value) {
  const trimmed = trim(value);
  if (!trimmed) {
    throw new Error(
      `Missing required environment variable: ${name}. `
      + `Set it in backend/.env.${process.env.NODE_ENV || 'development'} or backend/.env`,
    );
  }
  return trimmed;
}

function resolveNodeEnv() {
  const env = process.env.NODE_ENV || 'development';
  if (env !== 'development' && env !== 'production' && env !== 'test') {
    console.warn(`Unknown NODE_ENV="${env}" — treating as development.`);
    return 'development';
  }
  return env;
}

const nodeEnv = resolveNodeEnv();
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';

function resolveSessionSecret() {
  const secret = trim(process.env.SESSION_SECRET);
  if (secret) return secret;
  if (isProduction) {
    throw new Error('SESSION_SECRET is required in production.');
  }
  console.warn('WARNING: SESSION_SECRET not set — using insecure development fallback.');
  return DEV_SESSION_FALLBACK;
}

function resolveBookingTokenSecret(sessionSecret) {
  const secret = trim(process.env.BOOKING_TOKEN_SECRET);
  if (secret) return secret;
  if (isProduction) {
    throw new Error('BOOKING_TOKEN_SECRET is required in production.');
  }
  if (trim(process.env.SESSION_SECRET)) {
    return sessionSecret;
  }
  return DEV_BOOKING_TOKEN_FALLBACK;
}

function resolveTenantSlug() {
  return trim(process.env.DEFAULT_TENANT_SLUG)
    || trim(process.env.DEFAULT_PROPERTY_SLUG)
    || 'umalila';
}

const sessionSecret = resolveSessionSecret();
const bookingTokenSecret = resolveBookingTokenSecret(sessionSecret);

/** @type {Readonly<{
 *   env: string;
 *   isProduction: boolean;
 *   isDevelopment: boolean;
 *   server: { port: number; host: string };
 *   supabase: { url: string; serviceRoleKey: string };
 *   tenant: { slug: string; slugHeader: string };
 *   session: { secret: string; bookingTokenSecret: string };
 *   cors: { origin: boolean | string };
 * }>} */
export const config = Object.freeze({
  env: nodeEnv,
  isProduction,
  isDevelopment,

  server: {
    port: Number(process.env.PORT) || 5000,
    host: trim(process.env.HOST) || '0.0.0.0',
  },

  supabase: {
    url: required('SUPABASE_URL', process.env.SUPABASE_URL),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  tenant: {
    slug: resolveTenantSlug(),
    /** HTTP header used to resolve tenant on public routes */
    slugHeader: 'x-tenant-slug',
    /** @deprecated Accept legacy header during transition */
    legacySlugHeader: 'x-property-slug',
  },

  session: {
    secret: sessionSecret,
    bookingTokenSecret,
  },

  cors: {
    origin: isProduction
      ? (trim(process.env.CORS_ORIGIN) || false)
      : true,
  },
});

export default config;
