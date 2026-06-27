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

export function resolvePropertyNightlyRate(property, dateStr, holidays = []) {
  const weekday = Number(property?.base_rate_per_night) || 0;
  const weekend = property?.weekend_rate_per_night != null && property.weekend_rate_per_night !== ''
    ? Number(property.weekend_rate_per_night)
    : weekday;
  const holiday = property?.holiday_rate_per_night != null && property.holiday_rate_per_night !== ''
    ? Number(property.holiday_rate_per_night)
    : weekend;

  if (isHolidayDate(dateStr, holidays)) return holiday;
  if (isWeekendDate(dateStr)) return weekend;
  return weekday;
}

export function computePropertyStayCharges(property, checkIn, checkOut, holidays = []) {
  const nightDates = eachStayNight(checkIn, checkOut);
  let total = 0;
  nightDates.forEach((date) => {
    total += resolvePropertyNightlyRate(property, date, holidays);
  });
  const nights = nightDates.length;
  const avgRate = nights > 0 ? total / nights : 0;
  return { total, nights, avgRate };
}

export function computePropertiesStayTotal(properties, checkIn, checkOut, holidays = []) {
  return (properties || []).reduce(
    (sum, property) => sum + computePropertyStayCharges(property, checkIn, checkOut, holidays).total,
    0
  );
}

const TIER_LABELS = {
  weekday: 'weekday (Mon–Thu)',
  weekend: 'weekend (Fri–Sun)',
  holiday: 'holiday',
};

export function computePropertyTierLines(property, checkIn, checkOut, holidays = []) {
  const nightDates = eachStayNight(checkIn, checkOut);
  const buckets = {
    weekday: { nights: 0, total: 0 },
    weekend: { nights: 0, total: 0 },
    holiday: { nights: 0, total: 0 },
  };

  nightDates.forEach((date) => {
    const rate = resolvePropertyNightlyRate(property, date, holidays);
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

  const propertyName = property?.name || 'Property';
  const lines = [];

  for (const tier of ['weekday', 'weekend', 'holiday']) {
    const bucket = buckets[tier];
    if (bucket.nights <= 0) continue;
    lines.push({
      type: 'accommodation',
      tier,
      name: propertyName,
      description: `${propertyName} — ${bucket.nights} ${TIER_LABELS[tier]} night${bucket.nights !== 1 ? 's' : ''}`,
      quantity: bucket.nights,
      unitPrice: bucket.total / bucket.nights,
      subtotal: bucket.total,
      property_id: property?.id,
    });
  }

  const total = buckets.weekday.total + buckets.weekend.total + buckets.holiday.total;
  return { lines, total };
}

export function buildTieredAccommodationLines(properties, checkIn, checkOut, holidays = []) {
  return (properties || []).reduce(
    (acc, property) => {
      const { lines, total } = computePropertyTierLines(property, checkIn, checkOut, holidays);
      acc.lines.push(...lines);
      acc.total += total;
      return acc;
    },
    { lines: [], total: 0 }
  );
}
