/**
 * @typedef {Object} IncomeAmounts
 * @property {string|null} [bookingId]
 * @property {number} totalAccommodation
 * @property {number} totalAddons
 * @property {number} totalMenuItems
 * @property {number} discountAmount
 * @property {number} amountPaid
 * @property {number} subtotalBeforeDiscount
 * @property {number} total
 * @property {number} balanceDue
 * @property {string} paymentStatus
 * @property {string|null} [bookingStatus]
 */

/**
 * @typedef {IncomeAmounts & {
 *   displayId?: string,
 *   guestName?: string,
 *   checkIn?: string,
 *   checkOut?: string,
 * }} IncomeRow
 */

/**
 * @typedef {Object} LedgerTotal
 * @property {number} amount
 * @property {boolean} isEstimate — true when falling back to booking.total_price
 */

/**
 * Normalize snake_case or camelCase income-summary fields.
 * @param {Record<string, unknown>} [row]
 * @returns {IncomeAmounts}
 */
export function pickIncomeAmounts(row = {}) {
  return {
    bookingId: row.bookingId ?? row.booking_id ?? null,
    totalAccommodation: Number(row.totalAccommodation ?? row.total_accommodation) || 0,
    totalAddons: Number(row.totalAddons ?? row.total_addons) || 0,
    totalMenuItems: Number(row.totalMenuItems ?? row.total_menu_items) || 0,
    discountAmount: Number(row.discountAmount ?? row.discount_amount) || 0,
    amountPaid: Number(row.amountPaid ?? row.amount_paid) || 0,
    subtotalBeforeDiscount: Number(row.subtotalBeforeDiscount ?? row.subtotal_before_discount) || 0,
    total: Number(row.total) || 0,
    balanceDue: Number(row.balanceDue ?? row.balance_due) || 0,
    paymentStatus: row.paymentStatus ?? row.payment_status ?? 'pending',
    bookingStatus: row.bookingStatus ?? row.booking_status ?? null,
  };
}

/**
 * @param {IncomeAmounts|Record<string, unknown>} rowOrAmounts
 */
export function computeSubtotalBeforeDiscount(rowOrAmounts) {
  const amounts = rowOrAmounts?.totalAccommodation != null
    ? rowOrAmounts
    : pickIncomeAmounts(rowOrAmounts);

  if (amounts.subtotalBeforeDiscount > 0) {
    return amounts.subtotalBeforeDiscount;
  }

  return amounts.totalAccommodation + amounts.totalAddons + amounts.totalMenuItems;
}

/**
 * @param {Record<string, unknown>} row
 */
export function computeBookingTotal(row) {
  const amounts = pickIncomeAmounts(row);

  if (amounts.total > 0) {
    return amounts.total;
  }

  const subtotal = computeSubtotalBeforeDiscount(amounts);
  return Math.max(subtotal - amounts.discountAmount, 0);
}

/**
 * @param {Record<string, unknown>} row
 */
export function computeBalanceDue(row) {
  const amounts = pickIncomeAmounts(row);
  const total = computeBookingTotal(row);
  const computed = Math.max(total - amounts.amountPaid, 0);

  const rawBalance = row.balanceDue ?? row.balance_due;
  if (rawBalance != null && rawBalance !== '' && Number(rawBalance) > 0) {
    return Number(rawBalance);
  }

  return computed;
}

/**
 * Compute all ledger totals in one pass (used by enrichIncomeRow).
 * @param {Record<string, unknown>} row
 */
export function computeIncomeTotals(row) {
  const amounts = pickIncomeAmounts(row);
  const subtotalBeforeDiscount = computeSubtotalBeforeDiscount(amounts);
  const total = amounts.total > 0
    ? amounts.total
    : Math.max(subtotalBeforeDiscount - amounts.discountAmount, 0);

  const rawBalance = row.balanceDue ?? row.balance_due;
  const balanceDue = rawBalance != null && rawBalance !== '' && Number(rawBalance) > 0
    ? Number(rawBalance)
    : Math.max(total - amounts.amountPaid, 0);

  return { ...amounts, subtotalBeforeDiscount, total, balanceDue };
}

/** @param {Record<string, unknown>} row @returns {IncomeRow} */
export function enrichIncomeRow(row) {
  const totals = computeIncomeTotals(row);
  return {
    ...row,
    bookingId: totals.bookingId ?? row.bookingId,
    totalAccommodation: totals.totalAccommodation,
    totalAddons: totals.totalAddons,
    totalMenuItems: totals.totalMenuItems,
    subtotalBeforeDiscount: totals.subtotalBeforeDiscount,
    discountAmount: totals.discountAmount,
    total: totals.total,
    amountPaid: totals.amountPaid,
    balanceDue: totals.balanceDue,
    paymentStatus: totals.paymentStatus,
    bookingStatus: totals.bookingStatus,
  };
}

/**
 * @param {{ total_price?: number }|null|undefined} booking
 * @param {IncomeRow|null|undefined} incomeRow
 * @returns {LedgerTotal}
 */
export function resolveBookingLedgerTotal(booking, incomeRow) {
  if (incomeRow) {
    return { amount: incomeRow.total ?? computeBookingTotal(incomeRow), isEstimate: false };
  }
  const estimate = Number(booking?.total_price) || 0;
  return { amount: estimate, isEstimate: estimate > 0 };
}

/** @param {Record<string, unknown>} row */
export function isBalanceSettled(row) {
  const totals = computeIncomeTotals(row);
  return totals.balanceDue <= 0
    && totals.amountPaid >= totals.total
    && totals.paymentStatus === 'complete';
}
