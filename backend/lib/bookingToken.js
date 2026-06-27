import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { config } from '../config/index.js';

const TOKEN_SECRET = config.session.bookingTokenSecret;

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function hashBookingToken(token) {
  return createHmac('sha256', TOKEN_SECRET).update(token).digest('hex');
}

/** Returns { token, hash } — store hash in DB, return token to guest once. */
export function generateBookingToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashBookingToken(token) };
}

export function verifyBookingToken(bookingId, token, storedHash) {
  if (!bookingId || !token || !storedHash) return false;
  const expected = hashBookingToken(token);
  return safeEqual(expected, storedHash);
}

export function extractBookingToken(req) {
  return req.query?.token || req.headers['x-booking-token'] || req.body?.manage_token || null;
}
