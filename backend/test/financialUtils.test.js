import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSubtotalBeforeDiscount,
  computeBookingTotal,
  computeBalanceDue,
  computeBookingTotalFromParts,
  computeBalanceDueFromParts,
  mapBookingIncomeSummaryRow,
} from '../lib/financialUtils.js';

describe('financialUtils', () => {
  it('computes subtotal from line items', () => {
    const subtotal = computeSubtotalBeforeDiscount({
      totalAccommodation: 800_000,
      totalAddons: 100_000,
      totalMenuItems: 100_000,
    });
    assert.equal(subtotal, 1_000_000);
  });

  it('computes total after discount', () => {
    assert.equal(computeBookingTotalFromParts(1_000_000, 200_000), 800_000);
    assert.equal(computeBookingTotalFromParts(100_000, 150_000), 0);
  });

  it('computes balance due from total and paid', () => {
    assert.equal(computeBalanceDueFromParts(1_000_000, 700_000), 300_000);
    assert.equal(computeBalanceDueFromParts(1_000_000, 1_000_000), 0);
  });

  it('maps income summary row with computed totals', () => {
    const row = mapBookingIncomeSummaryRow({
      booking_id: 'abc',
      display_id: 'UM-001',
      guest_name: 'Test Guest',
      check_in_date: '2026-06-01',
      check_out_date: '2026-06-03',
      payment_status: 'partial',
      booking_status: 'confirmed',
      amount_paid: 500_000,
      discount_amount: 0,
      total_accommodation: 600_000,
      total_addons: 0,
      total_menu_items: 400_000,
    });

    assert.equal(row.total, 1_000_000);
    assert.equal(row.balanceDue, 500_000);
    assert.equal(row.totalAccommodation, 600_000);
  });

  it('computeBookingTotal prefers API total when set', () => {
    assert.equal(computeBookingTotal({ total: 999, totalAccommodation: 1 }), 999);
  });

  it('computeBalanceDue uses computed balance when API balance is zero', () => {
    assert.equal(
      computeBalanceDue({
        total: 1_000_000,
        amountPaid: 300_000,
        balanceDue: 0,
        totalAccommodation: 1_000_000,
      }),
      700_000,
    );
  });
});
