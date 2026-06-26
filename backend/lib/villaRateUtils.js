function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function eachStayNight(checkIn, checkOut) {
  const nights = [];
  const cursor = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  while (cursor < end) {
    nights.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

export function isWeekendDate(dateStr) {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  // Friday–Sunday (Fri=5, Sat=6, Sun=0)
  return day === 5 || day === 6 || day === 0;
}

export function isHolidayDate(dateStr, holidays) {
  return (holidays || []).some(
    (h) => dateStr >= h.start_date && dateStr <= h.end_date
  );
}

export function resolveVillaNightlyRate(villa, dateStr, holidays = []) {
  const weekday = Number(villa?.base_rate_per_night) || 0;
  const weekend = villa?.weekend_rate_per_night != null && villa.weekend_rate_per_night !== ''
    ? Number(villa.weekend_rate_per_night)
    : weekday;
  const holiday = villa?.holiday_rate_per_night != null && villa.holiday_rate_per_night !== ''
    ? Number(villa.holiday_rate_per_night)
    : weekend;

  if (isHolidayDate(dateStr, holidays)) return holiday;
  if (isWeekendDate(dateStr)) return weekend;
  return weekday;
}

export function computeVillaStayCharges(villa, checkIn, checkOut, holidays = []) {
  const nightDates = eachStayNight(checkIn, checkOut);
  let total = 0;
  nightDates.forEach((date) => {
    total += resolveVillaNightlyRate(villa, date, holidays);
  });
  const nights = nightDates.length;
  const avgRate = nights > 0 ? total / nights : 0;
  return { total, nights, avgRate };
}

export function computeVillasStayTotal(villas, checkIn, checkOut, holidays = []) {
  return (villas || []).reduce(
    (sum, villa) => sum + computeVillaStayCharges(villa, checkIn, checkOut, holidays).total,
    0
  );
}

const TIER_LABELS = {
  weekday: 'weekday (Mon–Thu)',
  weekend: 'weekend (Fri–Sun)',
  holiday: 'holiday',
};

export function computeVillaTierLines(villa, checkIn, checkOut, holidays = []) {
  const nightDates = eachStayNight(checkIn, checkOut);
  const buckets = {
    weekday: { nights: 0, total: 0 },
    weekend: { nights: 0, total: 0 },
    holiday: { nights: 0, total: 0 },
  };

  nightDates.forEach((date) => {
    const rate = resolveVillaNightlyRate(villa, date, holidays);
    if (isHolidayDate(date, holidays)) {
      buckets.holiday.nights += 1;
      buckets.holiday.total += rate;
    } else if (isWeekendDate(date)) {
      buckets.weekend.nights += 1;
      buckets.weekend.total += rate;
    } else {
      buckets.weekday.nights += 1;
      buckets.weekday.total += rate;
    }
  });

  const villaName = villa?.name || 'Villa';
  const lines = [];

  for (const tier of ['weekday', 'weekend', 'holiday']) {
    const bucket = buckets[tier];
    if (bucket.nights <= 0) continue;
    lines.push({
      type: 'accommodation',
      tier,
      name: villaName,
      description: `${villaName} — ${bucket.nights} ${TIER_LABELS[tier]} night${bucket.nights !== 1 ? 's' : ''}`,
      quantity: bucket.nights,
      unitPrice: bucket.total / bucket.nights,
      subtotal: bucket.total,
      villa_id: villa?.id,
    });
  }

  const total = buckets.weekday.total + buckets.weekend.total + buckets.holiday.total;
  return { lines, total };
}

export function buildTieredAccommodationLines(villas, checkIn, checkOut, holidays = []) {
  return (villas || []).reduce(
    (acc, villa) => {
      const { lines, total } = computeVillaTierLines(villa, checkIn, checkOut, holidays);
      acc.lines.push(...lines);
      acc.total += total;
      return acc;
    },
    { lines: [], total: 0 }
  );
}
