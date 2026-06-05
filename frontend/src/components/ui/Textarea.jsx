import React, { useState } from 'react';
import { INPUT_BASE, COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

function Textarea({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  fullWidth = true,
  rows = 4,
  helpText,
  className = '',
  name,
  id,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);

  const textareaStyle = {
    ...INPUT_BASE,
    padding: `${SPACING.sm} ${SPACING.md}`,
    fontSize: '0.9rem',
    width: fullWidth ? '100%' : 'auto',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
    backgroundColor: disabled ? COLORS.slate50 : COLORS.bgWhite,
    borderColor: error ? COLORS.danger : isFocused ? COLORS.primary : COLORS.slate200,
    boxShadow: error
      ? `0 0 0 3px ${COLORS.danger}20`
      : isFocused
      ? `0 0 0 3px ${COLORS.primary}20`
      : 'none',
  };

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }} className={`textarea-wrapper ${className}`}>
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
      <textarea
        id={id || name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        onFocus={() => setIsFocused(true)}
        disabled={disabled}
        style={textareaStyle}
        className={`textarea ${error ? 'error' : ''}`}
        {...props}
      />
      {error && (
        <p style={{ marginTop: SPACING.xs, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.danger, margin: `${SPACING.xs} 0 0` }}>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p style={{ marginTop: SPACING.xs, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textTertiary, margin: `${SPACING.xs} 0 0` }}>
          {helpText}
        </p>
      )}
    </div>
  );
}

export default Textarea;
