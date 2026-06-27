/**
 * Status & Phase Configuration
 * Centralized color and label definitions for all booking statuses and stay phases
 * Import this to ensure consistency across all components
 */

export const PHASE_CONFIG = {
  arrival: {
    label: 'Arriving',
    color: '#0369a1',
    bg: '#e0f2fe',
  },
  'in-house': {
    label: 'In House',
    color: '#6d28d9',
    bg: '#ede9fe',
  },
  departure: {
    label: 'Departing',
    color: '#b45309',
    bg: '#fef3c7',
  },
  upcoming: {
    label: 'Upcoming',
    color: '#374151',
    bg: '#f3f4f6',
  },
  pending: {
    label: 'Pending',
    color: '#92400e',
    bg: '#fef3c7',
  },
  cancelled: {
    label: 'Cancelled', 
    color: '#991b1b', 
    bg: '#fee2e2' 
  },
};

export const STATUS_CONFIG = {
  confirmed: { 
    label: 'Confirmed', 
    color: '#065f46', 
    bg: '#d1fae5' 
  },
  pending: { 
    label: 'Pending', 
    color: '#92400e', 
    bg: '#fef3c7' 
  },
  checked_in: { 
    label: 'Checked In', 
    color: '#1e40af', 
    bg: '#dbeafe' 
  },
  checked_out: { 
    label: 'Checked Out', 
    color: '#374151', 
    bg: '#f3f4f6' 
  },
  cancelled: { 
    label: 'Cancelled', 
    color: '#991b1b', 
    bg: '#fee2e2' 
  },
  completed: {
    label: 'Completed',
    color: '#065f46',
    bg: '#d1fae5'
  }
};

export const PAYMENT_STATUS_CONFIG = {
  pending: {
    label: 'Pending', //No DP
    color: '#92400e',
    bg: '#fef3c7'
  },
  partial: {
    label: 'Partial', //DP Paid
    color: '#d97706',
    bg: '#fed7aa'
  },
  complete: {
    label: 'Complete', //All Paid
    color: '#065f46',
    bg: '#d1fae5'
  },
  cancelled: {
    label: 'Cancelled',
    color: '#991b1b',
    bg: '#fee2e2'
  }
};

export const PAYMENT_FILTER_OPTIONS = [
  { key: 'all', label: 'All Payments' },
  { key: 'pending', label: 'Pending' },
  { key: 'partial', label: 'Partial' },
  { key: 'complete', label: 'Complete' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const USER_STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: '#065f46',
    bg: '#d1fae5',
  },
  deactivated: {
    label: 'Deactivated',
    color: '#374151',
    bg: '#f3f4f6',
  },
};

export const EXPENSE_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#92400e',
    bg: '#fef3c7',
  },
  approved: {
    label: 'Approved',
    color: '#065f46',
    bg: '#d1fae5',
  },
  rejected: {
    label: 'Rejected',
    color: '#991b1b',
    bg: '#fee2e2',
  },
};

export const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'operational', label: 'Operational' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salary', label: 'Salary' },
  { value: 'f&b_cost', label: 'F&B Cost' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other_expense', label: 'Other' },
];

export const EXPENSE_CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORY_OPTIONS.map(({ value, label }) => [value, label])
);

export const TIMEFRAME_FILTER_OPTIONS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

/**
 * Get status configuration by key and type
 * @param {string} key - The status or phase key (e.g., 'confirmed', 'arrival')
 * @param {string} type - Either 'status', 'phase', or 'payment'
 * @returns {object} Configuration object with label, color, and bg
 */
export function getStatusConfig(key, type = 'status') {
  if (type === 'phase') {
    return PHASE_CONFIG[key] || PHASE_CONFIG[Object.keys(PHASE_CONFIG)[0]];
  } else if (type === 'payment') {
    return PAYMENT_STATUS_CONFIG[key] || PAYMENT_STATUS_CONFIG['pending'];
  } else if (type === 'expense') {
    return EXPENSE_STATUS_CONFIG[key] || EXPENSE_STATUS_CONFIG.pending;
  } else if (type === 'user') {
    return USER_STATUS_CONFIG[key] || USER_STATUS_CONFIG.active;
  }
  return STATUS_CONFIG[key] || STATUS_CONFIG[Object.keys(STATUS_CONFIG)[0]];
}

/**
 * Get all available phases
 * @returns {array} Array of phase keys
 */
export function getAllPhases() {
  return Object.keys(PHASE_CONFIG);
}

/**
 * Get all available statuses
 * @returns {array} Array of status keys
 */
export function getAllStatuses() {
  return Object.keys(STATUS_CONFIG);
}

/**
 * Check if a status is a terminal state (booking is complete)
 * @param {string} status - Status to check
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
  return ['checked_out', 'cancelled'].includes(status);
}

/**
 * Check if a status is active (guest is currently at property)
 * @param {string} status - Status to check
 * @returns {boolean}
 */
export function isActiveStatus(status) {
  return status === 'checked_in';
}
