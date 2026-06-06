export function matchesTimeframeFilter(checkInDate, timeframeFilter, today = new Date()) {
  if (!checkInDate || timeframeFilter === 'all') return true;

  const checkIn = new Date(checkInDate);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  if (timeframeFilter === 'today') {
    return checkIn.toDateString() === today.toDateString();
  }
  if (timeframeFilter === 'month') {
    return checkIn >= startOfMonth && checkIn <= today;
  }
  if (timeframeFilter === 'year') {
    return checkIn >= startOfYear && checkIn <= today;
  }
  return true;
}
