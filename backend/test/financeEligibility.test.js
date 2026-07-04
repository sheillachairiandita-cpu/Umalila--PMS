import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCountableFinanceIncome,
  isFinanceExcludedBooking,
  sumCountableFinanceIncome,
  filterApprovedTransactions,
} from '../lib/financeEligibility.js';

describe('financeEligibility', () => {
  it('counts standalone approved income', () => {
    assert.equal(
      isCountableFinanceIncome({ type: 'income', status: 'approved', amount: 100 }),
      true,
    );
  });

  it('excludes income linked to cancelled bookings', () => {
    assert.equal(
      isCountableFinanceIncome({
        type: 'income',
        status: 'approved',
        booking_id: 'b1',
        bookings: { status: 'cancelled' },
        amount: 500_000,
      }),
      false,
    );
  });

  it('excludes income linked to cancelled payments', () => {
    assert.equal(
      isCountableFinanceIncome({
        type: 'income',
        status: 'approved',
        booking_id: 'b1',
        bookings: { status: 'confirmed', payment_status: 'cancelled' },
        amount: 500_000,
      }),
      false,
    );
  });

  it('includes income linked to active bookings', () => {
    assert.equal(
      isCountableFinanceIncome({
        type: 'income',
        status: 'approved',
        booking_id: 'b1',
        bookings: { status: 'confirmed' },
        amount: 500_000,
      }),
      true,
    );
  });

  it('sums only countable income rows', () => {
    const total = sumCountableFinanceIncome([
      { type: 'income', status: 'approved', amount: 100, booking_id: null },
      { type: 'income', status: 'approved', amount: 200, booking_id: 'x', bookings: { status: 'cancelled' } },
      { type: 'income', status: 'approved', amount: 150, booking_id: 'z', bookings: { status: 'confirmed', payment_status: 'cancelled' } },
      { type: 'income', status: 'approved', amount: 300, booking_id: 'y', bookings: { status: 'checked_in', payment_status: 'complete' } },
    ]);
    assert.equal(total, 400);
  });

  it('detects finance-excluded bookings by status or payment', () => {
    assert.equal(isFinanceExcludedBooking({ status: 'cancelled', paymentStatus: 'pending' }), true);
    assert.equal(isFinanceExcludedBooking({ status: 'confirmed', paymentStatus: 'cancelled' }), true);
    assert.equal(isFinanceExcludedBooking({ status: 'confirmed', paymentStatus: 'complete' }), false);
  });

  it('keeps expenses when filtering transactions', () => {
    const rows = filterApprovedTransactions([
      { type: 'expense', status: 'approved', amount: 50 },
      { type: 'income', status: 'approved', amount: 100, booking_id: 'x', bookings: { status: 'cancelled' } },
      { type: 'income', status: 'approved', amount: 25, booking_id: 'y', bookings: { status: 'confirmed' } },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, 'expense');
    assert.equal(rows[1].amount, 25);
  });
});
