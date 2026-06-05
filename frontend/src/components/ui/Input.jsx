import React, { useState } from 'react';
import { INPUT_BASE, COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

/**
 * Input Component
 * Reusable form input with error states and labels
 * 
 * @component
 * @example
 * <Input 
 *   label="Email" 
 *   type="email" 
 *   placeholder="user@example.com"
 *   error={error}
 *   value={value}
 *   onChange={handleChange}
 * />
 */
function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
  helpText,
  className = '',
  name,
  id,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);

  const sizeStyles = {
    sm: { padding: `${SPACING.xs} ${SPACING.sm}`, fontSize: '0.85rem' },
    md: { padding: `${SPACING.sm} ${SPACING.md}`, fontSize: '0.9rem' },
    lg: { padding: `${SPACING.md} ${SPACING.lg}`, fontSize: '1rem' },
  };

  const inputStyle = {
    ...INPUT_BASE,
    ...sizeStyles[size],
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: disabled ? COLORS.slate50 : COLORS.bgWhite,
    borderColor: error ? COLORS.danger : isFocused ? COLORS.primary : COLORS.slate200,
    boxShadow: error 
      ? `0 0 0 3px ${COLORS.danger}20`
      : isFocused
      ? `0 0 0 3px ${COLORS.primary}20`
      : 'none',
  };

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }} className={`input-wrapper ${className}`}>
      {label && (
        <label
          htmlFor={id || name}
          style={{
            display: 'block',
            marginBottom: SPACING.sm,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: TYPOGRAPHY.label.fontWeight,
            color: COLORS.textSecondary,
          }}
        >
          {label}
          {required && <span style={{ color: COLORS.danger, marginLeft: '4px' }}>*</span>}
        </label>
      )}
      <input
        id={id || name}
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        onFocus={() => setIsFocused(true)}
        disabled={disabled}
        style={inputStyle}
        className={`input input-${size} ${error ? 'error' : ''}`}
        {...props}
      />
      {error && (
        <p
          style={{
            marginTop: SPACING.xs,
            fontSize: TYPOGRAPHY.caption.fontSize,
            color: COLORS.danger,
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
      {helpText && !error && (
        <p
          style={{
            marginTop: SPACING.xs,
            fontSize: TYPOGRAPHY.caption.fontSize,
            color: COLORS.textTertiary,
            margin: 0,
          }}
        >
          {helpText}
        </p>
      )}
    </div>
  );
}

export default Input;
