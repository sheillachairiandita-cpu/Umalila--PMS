/**
 * Extract the most recent cancellation reason stored in booking notes.
 * Format: [CANCELLED YYYY-MM-DD] reason text
 */
export function parseCancellationReason(notes) {
  if (!notes || typeof notes !== 'string') return '';

  const lines = notes.split('\n').filter((line) => /^\[CANCELLED \d{4}-\d{2}-\d{2}\]/.test(line.trim()));
  if (lines.length === 0) return '';

  const lastLine = lines[lines.length - 1].trim();
  return lastLine.replace(/^\[CANCELLED \d{4}-\d{2}-\d{2}\]\s*/, '').trim();
}

export function sortReservationsByRecency(list, prioritizeId = null) {
  return [...list].sort((a, b) => {
    if (prioritizeId) {
      if (a.id === prioritizeId) return -1;
      if (b.id === prioritizeId) return 1;
    }
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function isInHouseToday(booking, todayISO) {
  const status = booking.booking_status || booking.status;
  if (status !== 'checked_in') return false;
  if (!booking.check_in_date || !booking.check_out_date) return false;
  return booking.check_in_date <= todayISO && booking.check_out_date >= todayISO;
}
