export function stayNights(checkIn, checkOut) {
  return Math.max(
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
    1,
  );
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function currentMonthBounds() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const end = lastDay.toISOString().split('T')[0];
  return { start, end };
}

export function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
