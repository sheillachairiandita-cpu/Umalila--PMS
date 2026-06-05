/**
 * Filter Functions for Bookings
 * Reusable, composable filter logic for any booking list
 */

/**
 * Filter bookings by smart filter type (today / upcoming-7 / all-phases)
 * @param {array} bookings - Array of booking objects
 * @param {string} filterType - 'today' | 'upcoming-7' | 'all-phases'
 * @returns {array} Filtered bookings
 */
export function filterByDateRange(bookings, filterType = 'all-phases') {
  const today = new Date().toISOString().split('T')[0];

  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysLaterISO = sevenDaysLater.toISOString().split('T')[0];

  const filters = {
    today: (b) => {
      const isArrival  = b.check_in_date === today;
      const isDeparture = b.check_out_date === today;
      const isInHouse  = b.check_in_date <= today && b.check_out_date > today;
      return isArrival || isDeparture || isInHouse;
    },
    'upcoming-7': (b) =>
      b.check_in_date > today &&
      b.check_in_date <= sevenDaysLaterISO &&
      !['checked_out', 'cancelled'].includes(b.status),
    'all-phases': (b) => b.status !== 'cancelled',
  };

  const filterFn = filters[filterType] || filters['all-phases'];
  return bookings.filter(filterFn);
}

/**
 * Filter bookings by status
 * @param {array} bookings
 * @param {array|string} statuses - Single status or array of statuses to include
 * @returns {array}
 */
export function filterByStatus(bookings, statuses) {
  const statusArray = Array.isArray(statuses) ? statuses : [statuses];
  return bookings.filter(b => statusArray.includes(b.status));
}

/**
 * Filter bookings by stay phase
 * @param {array} bookings
 * @param {array|string} phases
 * @returns {array}
 */
export function filterByPhase(bookings, phases) {
  const phaseArray = Array.isArray(phases) ? phases : [phases];
  return bookings.filter(b => phaseArray.includes(b.stay_phase));
}

/**
 * Filter bookings by villa/property
 * @param {array} bookings
 * @param {array|string} villaIds
 * @returns {array}
 */
export function filterByProperty(bookings, villaIds) {
  const villaArray = Array.isArray(villaIds) ? villaIds : [villaIds];
  return bookings.filter(b => villaArray.includes(b.villa_id));
}

/**
 * Filter bookings by guest name (partial match)
 * @param {array} bookings
 * @param {string} searchTerm
 * @returns {array}
 */
export function filterByGuestName(bookings, searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return bookings;
  return bookings.filter(b =>
    (b.guests?.full_name || 'Unknown').toLowerCase().includes(term)
  );
}

/**
 * Filter bookings by a specific date (check-in, check-out, or active stay)
 * @param {array} bookings
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {string} type - 'check-in' | 'check-out' | 'active'
 * @returns {array}
 */
export function filterByDate(bookings, date, type = 'active') {
  const filters = {
    'check-in':  (b) => b.check_in_date === date,
    'check-out': (b) => b.check_out_date === date,
    'active':    (b) => b.check_in_date <= date && b.check_out_date > date,
  };
  const filterFn = filters[type] || filters['active'];
  return bookings.filter(filterFn);
}

/**
 * Filter bookings that overlap or fall completely within a date range.
 * Renamed from the duplicate `filterByDateRange` to avoid export conflicts.
 * @param {array} bookings
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate   - ISO date string (YYYY-MM-DD)
 * @param {string} type - 'overlap' | 'completely-within'
 * @returns {array}
 */
export function filterByDateRangeOverlap(bookings, startDate, endDate, type = 'overlap') {
  const filters = {
    'overlap':            (b) => b.check_in_date < endDate && b.check_out_date > startDate,
    'completely-within':  (b) => b.check_in_date >= startDate && b.check_out_date <= endDate,
  };
  const filterFn = filters[type] || filters['overlap'];
  return bookings.filter(filterFn);
}

/**
 * Combine multiple filters with AND logic
 * @param {array} bookings
 * @param {array} filterFunctions - Array of filter functions
 * @returns {array}
 */
export function combineFilters(bookings, filterFunctions) {
  return filterFunctions.reduce((result, filterFn) => filterFn(result), bookings);
}

/**
 * Sort bookings by field
 * @param {array} bookings
 * @param {string} field - Field to sort by (supports dot notation e.g. 'guests.full_name')
 * @param {string} direction - 'asc' | 'desc'
 * @returns {array}
 */
export function sortBookings(bookings, field = 'check_in_date', direction = 'asc') {
  return [...bookings].sort((a, b) => {
    const aVal = getNestedValue(a, field);
    const bVal = getNestedValue(b, field);
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/** @private */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}