import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { INPUT_BASE, COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

/**
 * Password input with show/hide visibility toggle.
 * Masked by default; toggle only affects local display.
 */
function PasswordInput({
  label,
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
  autoComplete = 'current-password',
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const sizeStyles = {
    sm: { padding: `${SPACING.xs} ${SPACING.sm}`, fontSize: '0.85rem' },
    md: { padding: `${SPACING.sm} ${SPACING.md}`, fontSize: '0.9rem' },
    lg: { padding: `${SPACING.md} ${SPACING.lg}`, fontSize: '1rem' },
  };

  const inputStyle = {
    ...INPUT_BASE,
    ...sizeStyles[size],
    width: '100%',
    paddingRight: '2.25rem',
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
      <div className="password-input-wrap">
        <input
          id={id || name}
          type={visible ? 'text' : 'password'}
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
          className={`input input-${size} password-input ${error ? 'error' : ''}`}
          autoComplete={autoComplete}
          {...props}
        />
        <button
          type="button"
          className="password-input__toggle"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <p className="input-error-text">{error}</p>
      )}
      {helpText && !error && (
        <p className="input-help-text">{helpText}</p>
      )}
    </div>
  );
}

export default PasswordInput;
