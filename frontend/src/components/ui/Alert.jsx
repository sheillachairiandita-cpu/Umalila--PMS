import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../styles/theme';

/**
 * Alert Component
 * Displays alerts with different severity levels
 * 
 * @component
 * @example
 * <Alert type="error" title="Error" message="Something went wrong" />
 * <Alert type="success" message="Operation completed successfully" />
 * <Alert type="info" message="Here's some information" />
 */
function Alert({
  type = 'info',
  title,
  message,
  onClose,
  icon: CustomIcon,
  className = '',
  ...props
}) {
  const alertConfig = {
    error: {
      bg: COLORS.dangerBg,
      border: COLORS.danger,
      text: COLORS.dangerText,
      icon: AlertCircle,
      color: COLORS.danger,
    },
    success: {
      bg: COLORS.successBg,
      border: COLORS.success,
      text: COLORS.successText,
      icon: CheckCircle,
      color: COLORS.success,
    },
    warning: {
      bg: COLORS.warningBg,
      border: COLORS.warning,
      text: COLORS.warningText,
      icon: AlertCircle,
      color: COLORS.warning,
    },
    info: {
      bg: COLORS.infoBg,
      border: COLORS.info,
      text: COLORS.infoText,
      icon: Info,
      color: COLORS.info,
    },
  };

  const config = alertConfig[type] || alertConfig.info;
  const Icon = CustomIcon || config.icon;

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        display: 'flex',
        gap: SPACING.md,
      }}
      className={`alert alert-${type} ${className}`}
      role="alert"
      {...props}
    >
      <Icon size={16} color={config.color} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        {title && (
          <h4
            style={{
              ...TYPOGRAPHY.label,
              color: config.text,
              margin: '0 0 4px 0',
            }}
          >
            {title}
          </h4>
        )}
        {message && (
          <p
            style={{
              ...TYPOGRAPHY.bodySmall,
              color: config.text,
              margin: 0,
            }}
          >
            {message}
          </p>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: config.text,
            cursor: 'pointer',
            padding: 0,
            fontSize: '1.25rem',
            lineHeight: 1,
          }}
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Alert;
