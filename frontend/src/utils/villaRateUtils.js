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

export function computeStayRateBreakdown(villas, checkIn, checkOut, holidays = []) {
  const summary = {
    weekdayNights: 0,
    weekendNights: 0,
    holidayNights: 0,
    weekdayTotal: 0,
    weekendTotal: 0,
    holidayTotal: 0,
    villaTotal: 0,
    nights: 0,
  };

  if (!checkIn || !checkOut) return summary;

  const nightDates = eachStayNight(checkIn, checkOut);
  summary.nights = nightDates.length;

  (villas || []).forEach((villa) => {
    nightDates.forEach((date) => {
      const rate = resolveVillaNightlyRate(villa, date, holidays);
      summary.villaTotal += rate;

      if (isHolidayDate(date, holidays)) {
        summary.holidayNights += 1;
        summary.holidayTotal += rate;
      } else if (isWeekendDate(date)) {
        summary.weekendNights += 1;
        summary.weekendTotal += rate;
      } else {
        summary.weekdayNights += 1;
        summary.weekdayTotal += rate;
      }
    });
  });

  return summary;
}

export function getRateTierForDate(dateStr, holidays = []) {
  if (isHolidayDate(dateStr, holidays)) return 'holiday';
  if (isWeekendDate(dateStr)) return 'weekend';
  return 'weekday';
}

export function formatVillaRateForDates(villa, checkIn, _checkOut, holidays = []) {
  const weekday = Number(villa?.base_rate_per_night) || 0;

  if (!checkIn) {
    return `Rp ${weekday.toLocaleString('id-ID')}/night`;
  }

  const rate = resolveVillaNightlyRate(villa, checkIn, holidays);
  return `Rp ${rate.toLocaleString('id-ID')}/night`;
}

