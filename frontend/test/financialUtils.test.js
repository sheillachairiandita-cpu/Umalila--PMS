import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichIncomeRow,
  computeIncomeTotals,
  resolveBookingLedgerTotal,
  isBalanceSettled,
} from '../src/utils/financialUtils.js';

describe('frontend financialUtils', () => {
  it('enriches income row with totals', () => {
    const row = enrichIncomeRow({
      bookingId: 'b1',
      totalAccommodation: 500_000,
      totalAddons: 0,
      totalMenuItems: 500_000,
      discountAmount: 0,
      amountPaid: 1_000_000,
      paymentStatus: 'complete',
    });

    assert.equal(row.total, 1_000_000);
    assert.equal(row.balanceDue, 0);
  });

  it('computeIncomeTotals in one pass', () => {
    const totals = computeIncomeTotals({
      total_accommodation: 700_000,
      total_menu_items: 300_000,
      discount_amount: 0,
      amount_paid: 400_000,
    });
    assert.equal(totals.total, 1_000_000);
    assert.equal(totals.balanceDue, 600_000);
  });

  it('resolveBookingLedgerTotal marks estimate fallback', () => {
    assert.deepEqual(resolveBookingLedgerTotal({ total_price: 500_000 }, null), {
      amount: 500_000,
      isEstimate: true,
    });
    assert.deepEqual(
      resolveBookingLedgerTotal({ total_price: 500_000 }, { total: 900_000 }),
      { amount: 900_000, isEstimate: false },
    );
  });

  it('isBalanceSettled when paid and complete', () => {
    assert.equal(
      isBalanceSettled({
        total: 1_000_000,
        amountPaid: 1_000_000,
        paymentStatus: 'complete',
        totalAccommodation: 1_000_000,
      }),
      true,
    );
  });
});
