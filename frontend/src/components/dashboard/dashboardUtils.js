import {
  computePropertiesStayTotal,
} from '../../utils/propertyRateUtils';
import { sumCountableFinanceIncome } from '../../utils/financeEligibility';

export function formatRpCompact(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export function formatPct(v) {
  return `${(Number(v) || 0).toFixed(1)}%`;
}

export function formatNum(v) {
  return (Number(v) || 0).toLocaleString('id-ID');
}

export function getISODate(d) {
  return d.toISOString().split('T')[0];
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOf(unit, ref = new Date()) {
  const d = new Date(ref);
  if (unit === 'week') {
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
  }
  if (unit === 'month') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  if (unit === 'year') {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export const RANGE_PRESETS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '3m', label: '3 Months' },
  { key: 'mtd', label: 'Month-to-Date' },
  { key: 'ytd', label: 'Year-to-Date' },
  { key: 'custom', label: 'Custom Range' },
];

export function getRangeDates(preset) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let start;

  if (preset === 'week') {
    start = startOf('week');
  } else if (preset === 'month' || preset === 'mtd') {
    start = startOf('month');
  } else if (preset === 'ytd') {
    start = startOf('year');
  } else if (preset === '3m') {
    start = addDays(new Date(), -90);
    start.setHours(0, 0, 0, 0);
  } else {
    start = startOf('month');
  }

  return { start, end: today };
}

function dateOnly(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inDateRange(dateStr, rangeStart, rangeEnd) {
  if (!dateStr) return false;
  const d = dateOnly(dateStr);
  return d >= dateOnly(rangeStart) && d <= dateOnly(rangeEnd);
}

function stayNights(checkIn, checkOut) {
  const a = dateOnly(checkIn);
  const b = dateOnly(checkOut);
  return Math.max(0, Math.ceil((b - a) / 86400000));
}

function nightsInRange(checkIn, checkOut, rangeStart, rangeEnd) {
  const total = stayNights(checkIn, checkOut);
  if (!total) return 0;

  let count = 0;
  const cur = dateOnly(checkIn);
  const end = dateOnly(checkOut);
  const rs = dateOnly(rangeStart);
  const re = dateOnly(rangeEnd);

  while (cur < end) {
    if (cur >= rs && cur <= re) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function stayOverlapsRange(checkIn, checkOut, rangeStart, rangeEnd) {
  return nightsInRange(checkIn, checkOut, rangeStart, rangeEnd) > 0;
}

function prorateAmount(amount, checkIn, checkOut, rangeStart, rangeEnd) {
  const totalNights = stayNights(checkIn, checkOut);
  if (!totalNights) return 0;
  const inRange = nightsInRange(checkIn, checkOut, rangeStart, rangeEnd);
  if (!inRange) return 0;
  return (Number(amount) || 0) * (inRange / totalNights);
}

function matchesProperty(propertyNames, propertyFilter) {
  if (propertyFilter === 'all') return true;
  return (propertyNames || '').includes(propertyFilter);
}

function propertyCount(properties, propertyFilter) {
  if (propertyFilter === 'all') return Math.max(properties?.length || 1, 1);
  return 1;
}

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function monthLabel(key) {
  const [, mm] = key.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[parseInt(mm, 10) - 1] || mm;
}

const EXPENSE_CATEGORIES = [
  { key: 'operational', label: 'Operational', color: 'var(--navy)' },
  { key: 'salary', label: 'Salary', color: '#6366f1' },
  { key: 'f&b_cost', label: 'F&B Cost', color: 'var(--green)' },
  { key: 'maintenance', label: 'Maintenance', color: '#d97706' },
  { key: 'marketing', label: 'Marketing', color: '#7c3aed' },
  { key: 'other_expense', label: 'Other', color: 'var(--text-light)' },
];

const REVENUE_SEGMENTS = [
  { key: 'room_revenue', label: 'Room Revenue', color: 'var(--navy)' },
  { key: 'addon_revenue', label: 'Add-on Revenue', color: '#7c3aed' },
  { key: 'order_revenue', label: 'F&B Revenue', color: 'var(--green)' },
];

function propertyUnits(booking) {
  return Math.max(booking?.booking_properties?.length || 1, 1);
}

function prorateTieredAccommodation(booking, rangeStart, rangeEnd, holidays = []) {
  const properties = (booking.booking_properties || []).map((bv) => bv.properties).filter(Boolean);
  if (!properties.length) return 0;
  const fullTotal = computePropertiesStayTotal(
    properties,
    booking.check_in_date,
    booking.check_out_date,
    holidays
  );
  return prorateAmount(fullTotal, booking.check_in_date, booking.check_out_date, rangeStart, rangeEnd);
}

export function processFinancialData({
  bookings,
  incomeRows,
  transactions,
  expenses,
  profitability = [],
  rangeStart,
  rangeEnd,
  propertyFilter,
  properties,
  pricingHolidays = [],
}) {
  const incomeMap = {};
  (incomeRows || []).forEach((r) => {
    incomeMap[r.bookingId] = r;
  });

  const bookingById = {};
  (bookings || []).forEach((b) => { bookingById[b.id] = b; });

  let grossRevenue = 0;
  let roomRevenue = 0;
  let orderRevenue = 0;
  let addonRevenue = 0;
  let totalDiscounts = 0;

  (bookings || []).forEach((b) => {
    if (b.status === 'cancelled') return;
    if (!matchesProperty(b.property_names, propertyFilter)) return;
    if (!stayOverlapsRange(b.check_in_date, b.check_out_date, rangeStart, rangeEnd)) return;

    const summary = incomeMap[b.id];
    if (summary) {
      const room = prorateAmount(summary.totalAccommodation, b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
      const addon = prorateAmount(summary.totalAddons, b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
      const order = prorateAmount(summary.totalMenuItems, b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
      const discount = prorateAmount(summary.discountAmount, b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
      roomRevenue += room;
      addonRevenue += addon;
      orderRevenue += order;
      totalDiscounts += discount;
      grossRevenue += room + addon + order;
    } else {
      const room = prorateTieredAccommodation(b, rangeStart, rangeEnd, pricingHolidays);
      roomRevenue += room;
      grossRevenue += room;
      (b.booking_addons || []).forEach((ba) => {
        const unit = Number(ba.unit_price) || Number(ba.addons?.price) || 0;
        const qty = ba.quantity || 1;
        const perNight = ba.addons?.is_per_night !== false;
        const nights = nightsInRange(b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
        const line = perNight ? unit * qty * nights : (nights > 0 ? Number(ba.subtotal) || unit * qty : 0);
        addonRevenue += line;
        grossRevenue += line;
      });
      const orderTotal = Number(b.order_total) || 0;
      if (orderTotal > 0 && stayOverlapsRange(b.check_in_date, b.check_out_date, rangeStart, rangeEnd)) {
        const prorated = prorateAmount(orderTotal, b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
        orderRevenue += prorated;
        grossRevenue += prorated;
      }
    }
  });

  const amountCollected = sumCountableFinanceIncome(
    (transactions || []).filter((t) => inDateRange(t.transaction_date, rangeStart, rangeEnd)),
    bookingById,
  );

  const pendingDeposit = (incomeRows || [])
    .filter((r) => ['confirmed', 'checked_in'].includes(r.bookingStatus))
    .filter((r) => matchesProperty(bookingById[r.bookingId]?.property_names, propertyFilter))
    .reduce((s, r) => s + (Number(r.balanceDue) || 0), 0);

  const expenseByCategory = {};
  EXPENSE_CATEGORIES.forEach((c) => { expenseByCategory[c.key] = 0; });

  const totalExpenses = (expenses || [])
    .filter((e) => e.status === 'approved')
    .filter((e) => inDateRange(e.transactionDate || e.transaction_date, rangeStart, rangeEnd))
    .reduce((s, e) => {
      const amt = Number(e.amount) || 0;
      const cat = e.category || 'other_expense';
      if (expenseByCategory[cat] !== undefined) expenseByCategory[cat] += amt;
      else expenseByCategory.other_expense += amt;
      return s + amt;
    }, 0);

  let totalCogs = 0;
  let proratedRoomFromProfit = 0;
  let proratedAddonFromProfit = 0;
  let proratedFbFromProfit = 0;

  const propertyAgg = {};

  (profitability || []).forEach((row) => {
    if (row.bookingStatus === 'cancelled') return;
    if (propertyFilter !== 'all' && row.propertyName !== propertyFilter) return;
    if (!row.checkIn || !row.checkOut) return;
    if (!stayOverlapsRange(row.checkIn, row.checkOut, rangeStart, rangeEnd)) return;

    const totalNights = stayNights(row.checkIn, row.checkOut);
    const inRange = nightsInRange(row.checkIn, row.checkOut, rangeStart, rangeEnd);
    if (!inRange || !totalNights) return;

    const factor = inRange / totalNights;
    const rev = (Number(row.revenue) || 0) * factor;
    const cogs = (Number(row.cogs) || 0) * factor;
    const gp = rev - cogs;

    totalCogs += cogs;
    proratedRoomFromProfit += (Number(row.roomRevenue) || 0) * factor;
    proratedAddonFromProfit += (Number(row.addonRevenue) || 0) * factor;
    proratedFbFromProfit += (Number(row.fbRevenue) || 0) * factor;

    if (!propertyAgg[row.propertyId]) {
      propertyAgg[row.propertyId] = {
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
      };
    }
    propertyAgg[row.propertyId].revenue += rev;
    propertyAgg[row.propertyId].cogs += cogs;
    propertyAgg[row.propertyId].grossProfit += gp;
  });

  const useProfitability = (profitability || []).length > 0;
  if (useProfitability) {
    grossRevenue = proratedRoomFromProfit + proratedAddonFromProfit + proratedFbFromProfit;
    roomRevenue = proratedRoomFromProfit;
    addonRevenue = proratedAddonFromProfit;
    orderRevenue = proratedFbFromProfit;
  }

  const grossProfit = grossRevenue - totalCogs;
  const netProfit = grossProfit - totalExpenses;

  const rooms = propertyCount(properties, propertyFilter);
  const rangeDays = Math.max(1, Math.ceil((dateOnly(rangeEnd) - dateOnly(rangeStart)) / 86400000) + 1);
  const availableRoomNights = rooms * rangeDays;
  const goppar = availableRoomNights ? grossProfit / availableRoomNights : 0;
  const maxGoppar = Math.max(Math.abs(goppar) * 1.25, 100000);

  const expenseSegments = EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    value: expenseByCategory[c.key] || 0,
  }));

  const revenueSegments = REVENUE_SEGMENTS.map((c) => ({
    ...c,
    value: {
      room_revenue: roomRevenue,
      addon_revenue: addonRevenue,
      order_revenue: orderRevenue,
    }[c.key] || 0,
  }));

  const monthMap = {};
  let cur = dateOnly(rangeStart);
  const end = dateOnly(rangeEnd);
  while (cur <= end) {
    const mk = monthKey(getISODate(cur));
    if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, cogs: 0 };
    cur = addDays(cur, 1);
  }

  if (useProfitability) {
    (profitability || []).forEach((row) => {
      if (row.bookingStatus === 'cancelled') return;
      if (propertyFilter !== 'all' && row.propertyName !== propertyFilter) return;
      if (!stayOverlapsRange(row.checkIn, row.checkOut, rangeStart, rangeEnd)) return;

      const totalNights = stayNights(row.checkIn, row.checkOut);
      const inRange = nightsInRange(row.checkIn, row.checkOut, rangeStart, rangeEnd);
      if (!inRange || !totalNights) return;
      const factor = inRange / totalNights;
      const mk = monthKey(row.checkIn);
      if (monthMap[mk]) {
        monthMap[mk].revenue += (Number(row.revenue) || 0) * factor;
        monthMap[mk].cogs += (Number(row.cogs) || 0) * factor;
      }
    });
  } else {
    (bookings || []).forEach((b) => {
      if (b.status === 'cancelled') return;
      if (!matchesProperty(b.property_names, propertyFilter)) return;
      if (!stayOverlapsRange(b.check_in_date, b.check_out_date, rangeStart, rangeEnd)) return;
      const summary = incomeMap[b.id];
      const total = summary
        ? prorateAmount(summary.total, b.check_in_date, b.check_out_date, rangeStart, rangeEnd)
        : 0;
      const mk = monthKey(b.check_in_date);
      if (monthMap[mk]) monthMap[mk].revenue += total;
    });
  }

  (expenses || [])
    .filter((e) => e.status === 'approved')
    .filter((e) => inDateRange(e.transactionDate || e.transaction_date, rangeStart, rangeEnd))
    .forEach((e) => {
      const mk = monthKey(e.transactionDate || e.transaction_date);
      if (monthMap[mk]) monthMap[mk].expenses += Number(e.amount) || 0;
    });

  const monthlyComparison = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      label: monthLabel(key),
      revenue: val.revenue,
      expenses: val.expenses,
      netProfit: val.revenue - (val.cogs || 0) - val.expenses,
    }));

  const propertyProfitability = Object.values(propertyAgg)
    .map((v) => {
      const expenseShare = grossRevenue > 0
        ? totalExpenses * (v.revenue / grossRevenue)
        : 0;
      return {
        ...v,
        netProfit: v.grossProfit - expenseShare,
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);

  return {
    grossRevenue,
    netRevenue: Math.max(grossRevenue - totalDiscounts, 0),
    amountCollected,
    pendingDeposit,
    totalCogs,
    totalExpenses,
    totalDiscounts,
    grossProfit,
    netProfit,
    goppar,
    maxGoppar,
    expenseSegments,
    revenueSegments,
    monthlyComparison,
    profitabilityFlow: {
      revenue: grossRevenue,
      cogs: totalCogs,
      grossProfit,
      expenses: totalExpenses,
      netProfit,
    },
    propertyProfitability,
  };
}

export function processHospitalityData({
  bookings,
  incomeRows,
  rangeStart,
  rangeEnd,
  propertyFilter,
  properties,
  pricingHolidays = [],
}) {
  const incomeMap = {};
  (incomeRows || []).forEach((r) => {
    incomeMap[r.bookingId] = r;
  });

  let roomNightsSold = 0;
  let roomRevenue = 0;

  const bookingById = {};
  (bookings || []).forEach((b) => { bookingById[b.id] = b; });

  const filtered = (bookings || []).filter((b) => {
    if (b.status === 'cancelled') return false;
    if (!matchesProperty(b.property_names, propertyFilter)) return false;
    return stayOverlapsRange(b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
  });

  filtered.forEach((b) => {
    const nights = nightsInRange(b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
    roomNightsSold += nights * propertyUnits(b);

    const summary = incomeMap[b.id];
    if (summary) {
      roomRevenue += prorateAmount(summary.totalAccommodation, b.check_in_date, b.check_out_date, rangeStart, rangeEnd);
    } else {
      roomRevenue += prorateTieredAccommodation(b, rangeStart, rangeEnd, pricingHolidays);
    }
  });

  const rooms = propertyCount(properties, propertyFilter);
  const rangeDays = Math.max(1, Math.ceil((dateOnly(rangeEnd) - dateOnly(rangeStart)) / 86400000) + 1);
  const availableRoomNights = rooms * rangeDays;

  const occupancyRate = availableRoomNights ? (roomNightsSold / availableRoomNights) * 100 : 0;
  const adr = roomNightsSold ? roomRevenue / roomNightsSold : 0;
  const revpar = availableRoomNights ? roomRevenue / availableRoomNights : 0;

  const leadTimeBuckets = [
    { label: '0–3 days', min: 0, max: 3, value: 0 },
    { label: '4–7 days', min: 4, max: 7, value: 0 },
    { label: '8–30 days', min: 8, max: 30, value: 0 },
    { label: '>30 days', min: 31, max: Infinity, value: 0 },
  ];

  filtered.forEach((b) => {
    const created = dateOnly(b.created_at);
    const checkIn = dateOnly(b.check_in_date);
    const leadDays = Math.max(0, Math.round((checkIn - created) / 86400000));
    const bucket = leadTimeBuckets.find((bk) => leadDays >= bk.min && leadDays <= bk.max);
    if (bucket) bucket.value += 1;
  });

  const useWeekly = rangeDays > 14;
  const trendMap = {};

  if (useWeekly) {
    let wStart = dateOnly(rangeStart);
    while (wStart <= dateOnly(rangeEnd)) {
      const wEnd = addDays(wStart, 6);
      const label = `${wStart.getDate()}/${wStart.getMonth() + 1}`;
      trendMap[label] = { label, start: new Date(wStart), end: wEnd, occupancy: 0, revpar: 0, roomNights: 0, roomRev: 0 };
      wStart = addDays(wStart, 7);
    }
  } else {
    let d = dateOnly(rangeStart);
    while (d <= dateOnly(rangeEnd)) {
      const key = getISODate(d);
      trendMap[key] = { label: key.slice(5), start: new Date(d), end: new Date(d), occupancy: 0, revpar: 0, roomNights: 0, roomRev: 0 };
      d = addDays(d, 1);
    }
  }

  filtered.forEach((b) => {
    const summary = incomeMap[b.id];
    const units = propertyUnits(b);
    let cur = dateOnly(b.check_in_date);
    const end = dateOnly(b.check_out_date);
    while (cur < end) {
      if (cur >= dateOnly(rangeStart) && cur <= dateOnly(rangeEnd)) {
        const bucket = Object.values(trendMap).find((t) => cur >= dateOnly(t.start) && cur <= dateOnly(t.end));
        if (bucket) {
          bucket.roomNights += units;
          const stayN = Math.max(stayNights(b.check_in_date, b.check_out_date), 1);
          const nightlyRoom = summary
            ? (summary.totalAccommodation / stayN) * units
            : (prorateTieredAccommodation(b, b.check_in_date, b.check_out_date, pricingHolidays) / stayN);
          bucket.roomRev += nightlyRoom;
        }
      }
      cur = addDays(cur, 1);
    }
  });

  const trendData = Object.values(trendMap).map((t) => {
    const bucketDays = Math.ceil((dateOnly(t.end) - dateOnly(t.start)) / 86400000) + 1;
    const avail = rooms * bucketDays;
    return {
      label: t.label,
      occupancy: avail ? (t.roomNights / avail) * 100 : 0,
      revpar: avail ? t.roomRev / avail : 0,
    };
  });

  return {
    occupancyRate,
    adr,
    revpar,
    roomNightsSold,
    trendData,
    leadTimeBuckets: leadTimeBuckets.map(({ label, value }) => ({ label, value })),
    bookingSource: [{ label: 'WhatsApp (WA)', value: filtered.length || 1, color: '#25D366' }],
  };
}
