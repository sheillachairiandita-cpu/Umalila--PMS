/** Booking statuses that prevent date blocking when dates overlap. */
export const BLOCKING_BOOKING_STATUSES = ['confirmed', 'checked_in', 'completed'];

/**
 * Block range is inclusive [blockStart, blockEnd].
 * Booking range is half-open [checkIn, checkOut).
 */
export function blockRangeOverlapsBooking(blockStart, blockEnd, checkIn, checkOut) {
  return blockStart < checkOut && blockEnd >= checkIn;
}

export function isBlockingBookingStatus(status) {
  return BLOCKING_BOOKING_STATUSES.includes(status);
}

export async function findBlockingReservationsForBlock(supabase, villaId, startDate, endDate) {
  const { data, error } = await supabase
    .from('booking_villas')
    .select(`
      booking_id,
      bookings (
        id,
        display_id,
        status,
        check_in_date,
        check_out_date,
        guests (full_name)
      )
    `)
    .eq('villa_id', villaId);

  if (error) throw error;

  const conflicts = [];

  for (const row of data || []) {
    const booking = row.bookings;
    if (!booking || !isBlockingBookingStatus(booking.status)) continue;
    if (!blockRangeOverlapsBooking(startDate, endDate, booking.check_in_date, booking.check_out_date)) {
      continue;
    }
    conflicts.push({
      id: booking.id,
      displayId: booking.display_id,
      status: booking.status,
      guest: booking.guests?.full_name || 'Unknown Guest',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
    });
  }

  return conflicts;
}

export function formatBlockConflictError(conflicts) {
  if (!conflicts?.length) {
    return 'Cannot block dates that overlap active reservations.';
  }
  const summary = conflicts
    .slice(0, 3)
    .map((c) => `${c.guest} (${c.checkIn} → ${c.checkOut}, ${c.status})`)
    .join('; ');
  const suffix = conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : '';
  return `Cannot block these dates — active reservation conflict: ${summary}${suffix}.`;
}
