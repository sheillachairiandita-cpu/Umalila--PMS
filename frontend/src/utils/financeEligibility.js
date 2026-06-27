/**
 * Income from cancelled bookings is excluded from dashboard cash-basis totals.
 */

export function resolveLinkedBookingStatus(row) {
  if (row?.bookings?.status) return row.bookings.status;
  if (row?.booking_status) return row.booking_status;
  if (row?.bookingStatus) return row.bookingStatus;
  return null;
}

export function isCountableFinanceIncome(row, bookingById = {}) {
  if (!row || row.type !== 'income') return false;
  if (row.status && row.status !== 'approved') return false;
  const bookingId = row.booking_id ?? row.bookingId;
  if (!bookingId) return true;

  const status = resolveLinkedBookingStatus(row)
    ?? bookingById[bookingId]?.status
    ?? bookingById[bookingId]?.booking_status;

  return status !== 'cancelled';
}

export function sumCountableFinanceIncome(rows, bookingById = {}) {
  return (rows || [])
    .filter((row) => isCountableFinanceIncome(row, bookingById))
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}
