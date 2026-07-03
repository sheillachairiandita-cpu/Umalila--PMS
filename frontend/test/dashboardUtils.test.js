import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processFinancialData } from '../src/components/dashboard/dashboardUtils.js';

const rangeStart = new Date('2026-06-01T00:00:00');
const rangeEnd = new Date('2026-06-30T23:59:59');

describe('processFinancialData F&B revenue', () => {
  it('ignores stale profitability fb_revenue when there are no live orders', () => {
    const bookings = [{
      id: 'b1',
      status: 'confirmed',
      property_names: 'Villa A',
      check_in_date: '2026-06-10',
      check_out_date: '2026-06-12',
      order_total: 0,
    }];

    const incomeRows = [{
      bookingId: 'b1',
      totalAccommodation: 1_000_000,
      totalAddons: 0,
      totalMenuItems: 0,
      discountAmount: 0,
      amountPaid: 0,
      total: 1_000_000,
      balanceDue: 1_000_000,
      bookingStatus: 'confirmed',
    }];

    const profitability = [{
      bookingId: 'b1',
      propertyId: 'p1',
      propertyName: 'Villa A',
      revenue: 1_250_000,
      roomRevenue: 1_000_000,
      addonRevenue: 0,
      fbRevenue: 250_000,
      cogs: 100_000,
      grossProfit: 1_150_000,
      checkIn: '2026-06-10',
      checkOut: '2026-06-12',
      bookingStatus: 'confirmed',
    }];

    const result = processFinancialData({
      bookings,
      incomeRows,
      transactions: [],
      expenses: [],
      profitability,
      rangeStart,
      rangeEnd,
      propertyFilter: 'all',
      properties: [{ id: 'p1', name: 'Villa A' }],
    });

    const fbSegment = result.revenueSegments.find((s) => s.key === 'order_revenue');
    assert.equal(fbSegment.value, 0);
    assert.equal(result.grossRevenue, 1_000_000);
  });

  it('includes F&B when income summary has menu totals', () => {
    const bookings = [{
      id: 'b1',
      status: 'checked_in',
      property_names: 'Villa A',
      check_in_date: '2026-06-10',
      check_out_date: '2026-06-12',
      order_total: 0,
    }];

    const incomeRows = [{
      bookingId: 'b1',
      totalAccommodation: 1_000_000,
      totalAddons: 0,
      totalMenuItems: 300_000,
      discountAmount: 0,
      amountPaid: 0,
      total: 1_300_000,
      balanceDue: 1_300_000,
      bookingStatus: 'checked_in',
    }];

    const profitability = [{
      bookingId: 'b1',
      propertyId: 'p1',
      propertyName: 'Villa A',
      revenue: 1_300_000,
      roomRevenue: 1_000_000,
      addonRevenue: 0,
      fbRevenue: 300_000,
      cogs: 100_000,
      grossProfit: 1_200_000,
      checkIn: '2026-06-10',
      checkOut: '2026-06-12',
      bookingStatus: 'checked_in',
    }];

    const result = processFinancialData({
      bookings,
      incomeRows,
      transactions: [],
      expenses: [],
      profitability,
      rangeStart,
      rangeEnd,
      propertyFilter: 'all',
      properties: [{ id: 'p1', name: 'Villa A' }],
    });

    const fbSegment = result.revenueSegments.find((s) => s.key === 'order_revenue');
    assert.equal(fbSegment.value, 300_000);
    assert.equal(result.grossRevenue, 1_300_000);
  });
});
