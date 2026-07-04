/**
 * Income from cancelled bookings or cancelled payments is excluded from
 * dashboard cash-basis totals.
 */

export function resolveLinkedBookingStatus(row) {
  if (row?.bookings?.status) return row.bookings.status;
  if (row?.booking_status) return row.booking_status;
  if (row?.bookingStatus) return row.bookingStatus;
  return null;
}

export function resolveLinkedBookingPaymentStatus(row) {
  if (row?.bookings?.payment_status) return row.bookings.payment_status;
  if (row?.payment_status) return row.payment_status;
  if (row?.paymentStatus) return row.paymentStatus;
  return null;
}

export function isFinanceExcludedBooking({ status, paymentStatus, payment_status } = {}) {
  const payment = paymentStatus ?? payment_status;
  return status === 'cancelled' || payment === 'cancelled';
}

export function isCountableFinanceIncome(row, bookingById = {}) {
  if (!row || row.type !== 'income') return false;
  if (row.status && row.status !== 'approved') return false;

  const bookingId = row.booking_id ?? row.bookingId;
  if (!bookingId) return true;

  const linked = bookingById[bookingId];
  const status = resolveLinkedBookingStatus(row)
    ?? linked?.status
    ?? linked?.booking_status;
  const paymentStatus = resolveLinkedBookingPaymentStatus(row)
    ?? linked?.payment_status
    ?? linked?.paymentStatus;

  return !isFinanceExcludedBooking({ status, paymentStatus });
}

export function sumCountableFinanceIncome(rows, bookingById = {}) {
  return (rows || [])
    .filter((row) => isCountableFinanceIncome(row, bookingById))
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}
