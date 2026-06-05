import React from 'react';

/**
 * FilterButtonGroup Component
 * Generic filter button group for any filter options
 * Used for date ranges, status filters, category filters, etc.
 * 
 * @component
 * @example
 * <FilterButtonGroup
 *   options={[
 *     { key: 'today', label: 'Today' },
 *     { key: 'upcoming-7', label: 'Next 7 Days' },
 *     { key: 'all-phases', label: 'All' }
 *   ]}
 *   active={activeFilter}
 *   onChange={setActiveFilter}
 * />
 */
function FilterButtonGroup({ options, active, onChange, variant = 'pill', className = '' }) {
  const baseStyle = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  };

  const buttonStyle = (isActive) => ({
    padding: '4px 10px',
    borderRadius: variant === 'pill' ? '20px' : '6px',
    border: '1px solid',
    borderColor: isActive ? '#1e3a8a' : '#e2e8f0',
    background: isActive ? '#1e3a8a' : 'transparent',
    color: isActive ? '#fff' : '#64748b',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    textTransform: 'capitalize',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={baseStyle} className={`filter-button-group ${className}`}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={buttonStyle(active === key)}
          className={`filter-btn ${active === key ? 'active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default FilterButtonGroup;
