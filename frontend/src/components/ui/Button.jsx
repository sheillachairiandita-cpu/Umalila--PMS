import React from 'react';
import { BUTTON_VARIANTS, SPACING, BORDER_RADIUS, TYPOGRAPHY, TRANSITIONS } from '../../styles/theme';

/**
 * Button Component
 * Reusable button with multiple variants and sizes
 * 
 * @component
 * @example
 * <Button variant="primary" size="md">Save</Button>
 * <Button variant="success" onClick={handleClick}>Confirm</Button>
 * <Button variant="secondary" disabled>Disabled</Button>
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon: Icon,
  onClick,
  type = 'button',
  title,
  className = '',
  ...props
}) {
  const variantStyles = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const baseStyles = variantStyles.default;
  const disabledStyles = disabled ? variantStyles.disabled : {};

  const sizeStyles = {
    sm: {
      padding: `${SPACING.xs} ${SPACING.sm}`,
      fontSize: '0.75rem',
      fontWeight: 600,
      minHeight: '28px',
    },
    md: {
      padding: `${SPACING.sm} ${SPACING.md}`,
      fontSize: '0.85rem',
      fontWeight: 600,
      minHeight: '32px',
    },
    lg: {
      padding: `${SPACING.md} ${SPACING.lg}`,
      fontSize: '0.95rem',
      fontWeight: 600,
      minHeight: '40px',
    },
  };

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: TRANSITIONS.fast,
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : 'auto',
    opacity: loading ? 0.6 : 1,
    ...baseStyles,
    ...sizeStyles[size],
    ...disabledStyles,
  };

  const handleMouseEnter = (e) => {
    if (!disabled && !loading && variantStyles.default.hover) {
      Object.assign(e.currentTarget.style, variantStyles.default.hover);
    }
  };

  const handleMouseLeave = (e) => {
    Object.assign(e.currentTarget.style, {
      background: baseStyles.background,
      color: baseStyles.color,
      borderColor: baseStyles.border.split(' ')[3],
    });
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      style={style}
      className={`btn btn-${variant} btn-${size} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : size === 'md' ? 16 : 18} />}
      {loading ? 'Loading...' : children}
    </button>
  );
}

export default Button;
