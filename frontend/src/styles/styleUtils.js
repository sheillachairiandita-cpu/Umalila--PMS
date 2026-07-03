/**
 * Style Utilities
 * Helper functions for creating and managing styles
 */

import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TRANSITIONS } from './theme';

/**
 * Merge style objects
 * @param {...Object} styles - Style objects to merge
 * @returns {Object} Merged style object
 */
export const mergeStyles = (...styles) => {
  return Object.assign({}, ...styles);
};

/**
 * Get button styles for a given variant and state
 * @param {string} variant - Button variant (primary, success, danger, etc.)
 * @param {boolean} disabled - Whether button is disabled
 * @returns {Object} Button style object
 */
export const getButtonStyles = (variant = 'primary', disabled = false) => {
  const variants = {
    primary: {
      bg: COLORS.primary,
      text: '#fff',
      hover: COLORS.primaryDark,
    },
    success: {
      bg: COLORS.success,
      text: '#fff',
      hover: COLORS.successLight,
    },
    danger: {
      bg: COLORS.danger,
      text: '#fff',
      hover: COLORS.dangerLight,
    },
    warning: {
      bg: COLORS.warning,
      text: '#fff',
      hover: COLORS.warningLight,
    },
    secondary: {
      bg: COLORS.slate100,
      text: COLORS.slate700,
      hover: COLORS.slate200,
    },
  };

  const style = variants[variant] || variants.primary;

  return {
    background: disabled ? COLORS.slate300 : style.bg,
    color: disabled ? COLORS.slate500 : style.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: `1px solid ${disabled ? COLORS.slate300 : style.bg}`,
    transition: TRANSITIONS.fast,
  };
};

/**
 * Get status badge styles
 * @param {string} status - Status key
 * @param {Object} config - Status configuration object
 * @returns {Object} Badge style object
 */
export const getStatusBadgeStyles = (config) => {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: `2px ${SPACING.sm}`,
    borderRadius: BORDER_RADIUS.full,
    fontSize: '0.7rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    backgroundColor: config.bg,
    color: config.color,
  };
};

/**
 * Get input styles with focus/error states
 * @param {boolean} error - Whether input has error
 * @param {boolean} focused - Whether input is focused
 * @returns {Object} Input style object
 */
export const getInputStyles = (error = false, focused = false) => {
  return {
    borderColor: error ? COLORS.danger : focused ? COLORS.primary : COLORS.slate200,
    boxShadow: error
      ? `0 0 0 3px ${COLORS.danger}20`
      : focused
      ? `0 0 0 3px ${COLORS.primary}20`
      : 'none',
    transition: TRANSITIONS.fast,
  };
};

/**
 * Get flex layout styles
 * @param {string} direction - Flex direction (row, column)
 * @param {string} align - Align items (flex-start, center, flex-end)
 * @param {string} justify - Justify content (flex-start, center, space-between, etc.)
 * @param {string} gap - Gap between items
 * @returns {Object} Flex style object
 */
export const getFlexStyles = (
  direction = 'row',
  align = 'center',
  justify = 'flex-start',
  gap = SPACING.md
) => {
  return {
    display: 'flex',
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    gap,
  };
};

/**
 * Get grid layout styles
 * @param {number} columns - Number of columns
 * @param {string} gap - Gap between items
 * @returns {Object} Grid style object
 */
export const getGridStyles = (columns = 2, gap = SPACING.lg) => {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
    gap,
  };
};

/**
 * Get card styles
 * @param {string} variant - Card variant (default, elevated, flat)
 * @returns {Object} Card style object
 */
export const getCardStyles = (variant = 'default') => {
  const variants = {
    default: {
      background: COLORS.bgWhite,
      border: `1px solid ${COLORS.slate200}`,
      boxShadow: SHADOWS.sm,
    },
    elevated: {
      background: COLORS.bgWhite,
      border: 'none',
      boxShadow: SHADOWS.lg,
    },
    flat: {
      background: COLORS.slate50,
      border: `1px solid ${COLORS.slate200}`,
      boxShadow: 'none',
    },
  };

  return variants[variant] || variants.default;
};

/**
 * Get modal overlay and content styles
 * @returns {Object} Modal styles object with overlay and content
 */
export const getModalStyles = () => {
  return {
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    content: {
      background: COLORS.bgWhite,
      borderRadius: BORDER_RADIUS.xl,
      boxShadow: SHADOWS.modal,
      padding: SPACING.xxl,
      maxWidth: 500,
      width: '90%',
      maxHeight: '90dvh',
      overflowY: 'auto',
    },
  };
};

/**
 * Convert object to CSS class string
 * @param {Object} classObj - Object with class names as keys and booleans as values
 * @returns {string} Class string
 */
export const classNames = (classObj) => {
  return Object.entries(classObj)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(' ');
};

/**
 * Combine multiple class names
 * @param {...any} classes - Class names to combine
 * @returns {string} Combined class string
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
