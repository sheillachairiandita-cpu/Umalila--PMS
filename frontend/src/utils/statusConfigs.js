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
    label: 'Pending',
    color: '#92400e',
    bg: '#fef3c7'
  },
  partial: {
    label: 'Partial',
    color: '#d97706',
    bg: '#fed7aa'
  },
  complete: {
    label: 'Complete',
    color: '#065f46',
    bg: '#d1fae5'
  }
};

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
