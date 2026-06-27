/**
 * Finance rows linked to cancelled bookings must not contribute to revenue KPIs.
 * Standalone income rows (no booking_id) remain countable.
 */

export const FINANCE_INCOME_WITH_BOOKING_SELECT =
  'amount, type, status, booking_id, bookings(status)';

export const FINANCE_TRANSACTION_SELECT =
  'id, type, amount, category, transaction_date, status, booking_id, bookings(status)';

export function resolveLinkedBookingStatus(row) {
  if (row?.bookings?.status) return row.bookings.status;
  if (row?.booking_status) return row.booking_status;
  if (row?.bookingStatus) return row.bookingStatus;
  return null;
}

export function isCountableFinanceIncome(row) {
  if (!row || row.type !== 'income') return false;
  if (row.status && row.status !== 'approved') return false;
  if (!row.booking_id) return true;
  return resolveLinkedBookingStatus(row) !== 'cancelled';
}

export function filterCountableFinanceIncome(rows) {
  return (rows || []).filter(isCountableFinanceIncome);
}

export function sumCountableFinanceIncome(rows) {
  return filterCountableFinanceIncome(rows).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );
}

/** Approved ledger rows — income from cancelled bookings removed; expenses unchanged. */
export function filterApprovedTransactions(rows) {
  return (rows || []).filter(
    (row) => row.type !== 'income' || isCountableFinanceIncome(row),
  );
}
