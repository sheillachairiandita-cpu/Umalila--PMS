import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sumCountableFinanceIncome } from '../src/utils/financeEligibility.js';

describe('financeEligibility', () => {
  it('excludes income from cancelled bookings using booking map fallback', () => {
    const bookingById = {
      b1: { status: 'cancelled' },
      b2: { status: 'confirmed' },
    };

    const total = sumCountableFinanceIncome([
      { type: 'income', status: 'approved', amount: 100, booking_id: 'b1' },
      { type: 'income', status: 'approved', amount: 200, booking_id: 'b2' },
      { type: 'income', status: 'approved', amount: 50 },
    ], bookingById);

    assert.equal(total, 250);
  });
});
