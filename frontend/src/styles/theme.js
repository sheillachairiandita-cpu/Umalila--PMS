/**
 * Design System Theme
 * Centralized colors, spacing, typography, and component styles
 */

export const COLORS = {
  // Primary
  primary: '#1e3a8a',
  primaryLight: '#3b82f6',
  primaryDark: '#1e40af',

  // Success
  success: '#059669',
  successLight: '#10b981',
  successBg: '#d1fae5',
  successText: '#065f46',

  // Warning
  warning: '#d97706',
  warningLight: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',

  // Danger
  danger: '#dc2626',
  dangerLight: '#ef4444',
  dangerBg: '#fee2e2',
  dangerText: '#991b1b',

  // Info
  info: '#0369a1',
  infoBg: '#e0f2fe',
  infoText: '#0c4a6e',

  // Neutral
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Slate
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate900: '#0f172a',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',

  // Background
  bgWhite: '#fff',
  bgLight: '#f8fafc',
  bgLighter: '#f1f5f9',

  // Accent colors for phases
  arrival: { bg: '#e0f2fe', text: '#0369a1' },
  inHouse: { bg: '#ede9fe', text: '#6d28d9' },
  departure: { bg: '#fef3c7', text: '#b45309' },
  upcoming: { bg: '#f3f4f6', text: '#374151' },
};

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
};

export const BORDER_RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

export const TYPOGRAPHY = {
  h1: { fontSize: '1.875rem', fontWeight: 700, lineHeight: '2.25rem' },
  h2: { fontSize: '1.5rem', fontWeight: 700, lineHeight: '2rem' },
  h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: '1.75rem' },
  h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: '1.75rem' },
  body: { fontSize: '1rem', fontWeight: 400, lineHeight: '1.5rem' },
  bodySmall: { fontSize: '0.875rem', fontWeight: 400, lineHeight: '1.25rem' },
  label: { fontSize: '0.875rem', fontWeight: 600, lineHeight: '1.25rem' },
  labelSmall: { fontSize: '0.75rem', fontWeight: 600, lineHeight: '1rem' },
  caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: '1rem' },
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export const TRANSITIONS = {
  fast: 'all 0.15s ease-in-out',
  base: 'all 0.2s ease-in-out',
  slow: 'all 0.3s ease-in-out',
};

/**
 * Button Style Variants
 */
export const BUTTON_VARIANTS = {
  primary: {
    default: {
      background: COLORS.primary,
      color: '#fff',
      border: `1px solid ${COLORS.primary}`,
      hover: {
        background: COLORS.primaryDark,
        borderColor: COLORS.primaryDark,
      },
    },
    disabled: {
      background: COLORS.slate300,
      color: COLORS.slate400,
      border: `1px solid ${COLORS.slate300}`,
      cursor: 'not-allowed',
    },
  },
  success: {
    default: {
      background: COLORS.success,
      color: '#fff',
      border: `1px solid ${COLORS.success}`,
      hover: {
        background: COLORS.successLight,
        borderColor: COLORS.successLight,
      },
    },
    disabled: {
      background: COLORS.slate300,
      color: COLORS.slate400,
      border: `1px solid ${COLORS.slate300}`,
      cursor: 'not-allowed',
    },
  },
  secondary: {
    default: {
      background: COLORS.slate50,
      color: COLORS.slate600,
      border: `1px solid ${COLORS.slate200}`,
      hover: {
        background: COLORS.primary,
        color: '#fff',
        borderColor: COLORS.primary,
      },
    },
    disabled: {
      background: COLORS.slate100,
      color: COLORS.slate400,
      border: `1px solid ${COLORS.slate200}`,
      cursor: 'not-allowed',
    },
  },
  danger: {
    default: {
      background: COLORS.danger,
      color: '#fff',
      border: `1px solid ${COLORS.danger}`,
      hover: {
        background: COLORS.dangerLight,
        borderColor: COLORS.dangerLight,
      },
    },
    disabled: {
      background: COLORS.slate300,
      color: COLORS.slate400,
      border: `1px solid ${COLORS.slate300}`,
      cursor: 'not-allowed',
    },
  },
  ghost: {
    default: {
      background: 'transparent',
      color: COLORS.slate600,
      border: 'none',
      hover: {
        background: COLORS.slate100,
      },
    },
    disabled: {
      background: 'transparent',
      color: COLORS.slate400,
      border: 'none',
      cursor: 'not-allowed',
    },
  },
};

/**
 * Input Style Base
 */
export const INPUT_BASE = {
  padding: `${SPACING.sm} ${SPACING.md}`,
  border: `1px solid ${COLORS.slate200}`,
  borderRadius: BORDER_RADIUS.md,
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  transition: TRANSITIONS.fast,
  boxSizing: 'border-box',
  focus: {
    borderColor: COLORS.primary,
    outline: 'none',
    boxShadow: `0 0 0 3px ${COLORS.primary}20`,
  },
  error: {
    borderColor: COLORS.danger,
    boxShadow: `0 0 0 3px ${COLORS.danger}20`,
  },
};

/**
 * Modal Base Styles
 */
export const MODAL_BASE = {
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
    maxWidth: 500,
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: SPACING.xxl,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xxl,
    paddingBottom: SPACING.lg,
    borderBottom: `1px solid ${COLORS.slate200}`,
  },
};
