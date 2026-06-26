import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import {
  hasPermission,
  isPublicApiRoute,
  getRequiredApiPermission,
  getAuthenticatedPublicOverride,
} from './rbac.js';

const SESSION_COOKIE = 'umalila_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const SESSION_SECRET = process.env.SESSION_SECRET
  || (process.env.NODE_ENV !== 'production' ? 'umalila-dev-session-secret' : null);
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required in production.');
}
if (!process.env.SESSION_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('WARNING: SESSION_SECRET not set — using insecure dev default.');
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const testHash = scryptSync(password, salt, 64);
  const storedHash = Buffer.from(hash, 'hex');
  if (storedHash.length !== testHash.length) return false;
  return timingSafeEqual(storedHash, testHash);
}

function safeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    }).filter(([key]) => key),
  );
}

function signPayload(payloadB64) {
  return createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
}

/** Stateless signed session token — survives server restarts. */
function createSessionToken(userId) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payloadB64 = Buffer.from(JSON.stringify({ userId, iat: issuedAt, exp: expiresAt }))
    .toString('base64url');
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return null;

  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!payloadB64 || !signature) return null;

  const expected = signPayload(payloadB64);
  if (!safeEqualStrings(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload?.userId || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return { userId: payload.userId, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

function cookieSecuritySuffix() {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieSecuritySuffix()}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecuritySuffix()}`,
  );
}

export function mapAuthUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    display_id: row.display_id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    property_id: row.property_id || null,
  };
}

export async function loadUserById(supabase, userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, created_at, display_id, status, property_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return mapAuthUser(data);
}

export async function resolveRequestUser(req, supabase) {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies[SESSION_COOKIE]);
  if (!session) return null;
  return loadUserById(supabase, session.userId);
}

export function createAuthHandlers(supabase) {
  async function login(req, res) {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, password_hash, display_id, status, property_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;
      if (!data || !verifyPassword(password, data.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (data.status === 'deactivated') {
        return res.status(403).json({ error: 'This account has been deactivated.' });
      }

      const token = createSessionToken(data.id);
      setSessionCookie(res, token);
      res.json(mapAuthUser(data));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async function logout(req, res) {
    clearSessionCookie(res);
    res.json({ message: 'Signed out.' });
  }

  async function me(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Sliding session — refresh cookie while the user remains active.
    const token = createSessionToken(req.user.id);
    setSessionCookie(res, token);
    res.json(req.user);
  }

  async function changePassword(req, res) {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, password_hash')
        .eq('id', req.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data || !verifyPassword(current_password, data.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashPassword(new_password) })
        .eq('id', req.user.id);

      if (updateError) throw updateError;

      const token = createSessionToken(req.user.id);
      setSessionCookie(res, token);
      res.json({ message: 'Password updated successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  return { login, logout, me, changePassword };
}

export function createAuthMiddleware(supabase) {
  return async function authMiddleware(req, res, next) {
    if (!req.path.startsWith('/api')) return next();

    if (isPublicApiRoute(req.method, req.path)) {
      return next();
    }

    try {
      const user = await resolveRequestUser(req, supabase);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      if (user.status === 'deactivated') {
        clearSessionCookie(res);
        return res.status(403).json({ error: 'This account has been deactivated.' });
      }
      req.user = user;
      return next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

export function rbacMiddleware(req, res, next) {
  if (!req.path.startsWith('/api')) return next();

  if (isPublicApiRoute(req.method, req.path)) {
    if (req.user) {
      const override = getAuthenticatedPublicOverride(req.method, req.path);
      if (override && !hasPermission(req.user.role, override)) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
    }
    return next();
  }

  if (!req.user) return next();

  const required = getRequiredApiPermission(req.method, req.path);

  if (required === undefined) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  if (required === null) {
    return next();
  }

  if (!hasPermission(req.user.role, required)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  return next();
}
