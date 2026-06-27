/**
 * Shared booking income / ledger calculations.
 * Keep in sync with frontend/src/utils/financialUtils.js.
 */

export function computeSubtotalBeforeDiscount({
  totalAccommodation = 0,
  totalAddons = 0,
  totalMenuItems = 0,
  subtotalBeforeDiscount,
} = {}) {
  const fromView = Number(subtotalBeforeDiscount);
  if (fromView > 0) return fromView;
  return (Number(totalAccommodation) || 0)
    + (Number(totalAddons) || 0)
    + (Number(totalMenuItems) || 0);
}

export function computeBookingTotalFromParts(subtotalBeforeDiscount, discountAmount = 0) {
  return Math.max((Number(subtotalBeforeDiscount) || 0) - (Number(discountAmount) || 0), 0);
}

export function computeBalanceDueFromParts(total, amountPaid = 0) {
  return Math.max((Number(total) || 0) - (Number(amountPaid) || 0), 0);
}

export function computeBookingTotal({
  totalAccommodation = 0,
  totalAddons = 0,
  totalMenuItems = 0,
  subtotalBeforeDiscount,
  discountAmount = 0,
  total,
} = {}) {
  const fromApi = Number(total);
  if (fromApi > 0) return fromApi;

  const subtotal = computeSubtotalBeforeDiscount({
    totalAccommodation,
    totalAddons,
    totalMenuItems,
    subtotalBeforeDiscount,
  });
  return computeBookingTotalFromParts(subtotal, discountAmount);
}

export function computeBalanceDue({
  total,
  amountPaid = 0,
  balanceDue,
  totalAccommodation,
  totalAddons,
  totalMenuItems,
  subtotalBeforeDiscount,
  discountAmount,
} = {}) {
  const grandTotal = computeBookingTotal({
    totalAccommodation,
    totalAddons,
    totalMenuItems,
    subtotalBeforeDiscount,
    discountAmount,
    total,
  });
  const fromApi = Number(balanceDue);
  if (fromApi > 0) return fromApi;
  return computeBalanceDueFromParts(grandTotal, amountPaid);
}

export function mapBookingIncomeSummaryRow(row) {
  const totalAccommodation = Number(row.total_accommodation) || 0;
  const totalAddons = Number(row.total_addons) || 0;
  const totalMenuItems = Number(row.total_menu_items) || 0;
  const discountAmount = Number(row.discount_amount) || 0;
  const amountPaid = Number(row.amount_paid) || 0;

  const subtotalBeforeDiscount = computeSubtotalBeforeDiscount({
    totalAccommodation,
    totalAddons,
    totalMenuItems,
    subtotalBeforeDiscount: row.subtotal_before_discount,
  });

  const total = computeBookingTotal({
    totalAccommodation,
    totalAddons,
    totalMenuItems,
    subtotalBeforeDiscount,
    discountAmount,
    total: row.total,
  });

  const balanceDue = computeBalanceDue({
    totalAccommodation,
    totalAddons,
    totalMenuItems,
    subtotalBeforeDiscount,
    discountAmount,
    total,
    amountPaid,
    balanceDue: row.balance_due,
  });

  return {
    bookingId: row.booking_id,
    displayId: row.display_id,
    invoiceId: row.display_id,
    guestName: row.guest_name || 'Unknown Guest',
    checkIn: row.check_in_date,
    checkOut: row.check_out_date,
    totalAccommodation,
    totalAddons,
    totalMenuItems,
    subtotalBeforeDiscount,
    discountAmount,
    discountCode: row.discount_code || null,
    total,
    amountPaid,
    balanceDue,
    paymentStatus: row.payment_status,
    bookingStatus: row.booking_status,
  };
}
