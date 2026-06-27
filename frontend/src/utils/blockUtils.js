/** Keep in sync with backend/lib/blockUtils.js */
export const BLOCKING_BOOKING_STATUSES = ['confirmed', 'checked_in', 'completed'];

export function normalizeBookingStatus(status) {
  return status?.toLowerCase().replace(/\s+/g, '_') || 'pending';
}

export function isBlockingBookingStatus(status) {
  return BLOCKING_BOOKING_STATUSES.includes(normalizeBookingStatus(status));
}

/**
 * Block range is inclusive [blockStart, blockEnd].
 * Booking range is half-open [checkIn, checkOut).
 */
export function blockRangeOverlapsBooking(blockStart, blockEnd, checkIn, checkOut) {
  return blockStart < checkOut && blockEnd >= checkIn;
}

export function findBlockingConflicts(property, startDate, endDate) {
  return (property?.bookings || []).filter((booking) => {
    if (!isBlockingBookingStatus(booking.status)) return false;
    return blockRangeOverlapsBooking(startDate, endDate, booking.checkIn, booking.checkOut);
  });
}

export function formatBlockConflictError(conflicts) {
  if (!conflicts?.length) {
    return 'Cannot block dates that overlap active reservations.';
  }
  const summary = conflicts
    .slice(0, 3)
    .map((c) => `${c.guest} (${c.checkIn} → ${c.checkOut})`)
    .join('; ');
  const suffix = conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : '';
  return `Cannot block these dates — active reservation conflict: ${summary}${suffix}.`;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCreatedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
