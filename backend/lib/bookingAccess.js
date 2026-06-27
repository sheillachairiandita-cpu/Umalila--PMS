import { hasPermission, PERMISSIONS } from './rbac/rbac.js';
import { extractBookingToken, verifyBookingToken } from './bookingToken.js';
import { finishScope } from './tenant/index.js';

export function createBookingAccessMiddleware(supabase) {
  return async function bookingAccessMiddleware(req, res, next) {
    const bookingId = req.params.id || req.params.bookingId;
    if (!bookingId) return next();

    if (req.user && hasPermission(req.user.role, PERMISSIONS.BOOKINGS_WRITE)) {
      try {
        const { data, error } = await finishScope(
          supabase.from('bookings').select('id, tenant_id').eq('id', bookingId),
          req.tenantId,
          'bookings',
        ).maybeSingle();

        if (error) throw error;
        if (!data) {
          return res.status(404).json({ error: 'Booking not found.' });
        }
        return next();
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    const token = extractBookingToken(req);
    if (!token) {
      return res.status(403).json({ error: 'Booking manage token required.' });
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, tenant_id, manage_token_hash')
        .eq('id', bookingId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      if (req.tenantId && data.tenant_id !== req.tenantId) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      if (!verifyBookingToken(bookingId, token, data.manage_token_hash)) {
        return res.status(403).json({ error: 'Invalid booking manage token.' });
      }

      req.bookingTokenVerified = true;
      return next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}
