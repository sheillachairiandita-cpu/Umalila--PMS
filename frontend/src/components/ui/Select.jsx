import React, { useState } from 'react';
import { INPUT_BASE, COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

/**
 * Select Component
 * Reusable select/dropdown component
 * 
 * @component
 * @example
 * <Select 
 *   label="Category" 
 *   options={[
 *     { value: 'option1', label: 'Option 1' },
 *     { value: 'option2', label: 'Option 2' }
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 */
function Select({
  label,
  options = [],
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
  placeholder = 'Select an option...',
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

  const selectStyle = {
    ...INPUT_BASE,
    ...sizeStyles[size],
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: disabled ? COLORS.slate50 : COLORS.bgWhite,
    borderColor: error ? COLORS.danger : isFocused ? COLORS.primary : COLORS.slate200,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: error 
      ? `0 0 0 3px ${COLORS.danger}20`
      : isFocused
      ? `0 0 0 3px ${COLORS.primary}20`
      : 'none',
  };

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }} className={`select-wrapper ${className}`}>
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
      <select
        id={id || name}
        name={name}
        value={value || ''}
        onChange={onChange}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        onFocus={() => setIsFocused(true)}
        disabled={disabled}
        style={selectStyle}
        className={`select select-${size} ${error ? 'error' : ''}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
    </div>
  );
}

export default Select;
