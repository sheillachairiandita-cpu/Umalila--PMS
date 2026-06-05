import React from 'react';

/**
 * Icon-only table action button — styles live in App.css (.table-action-btn)
 */
function TableActionButton({
  onClick,
  title,
  children,
  variant = 'default',
  disabled = false,
  loading = false,
}) {
  return (
    <button
      type="button"
      className={`table-action-btn table-action-btn--${variant}`}
      onClick={onClick}
      title={title}
      disabled={disabled || loading}
      aria-label={title}
    >
      {loading ? <span className="table-action-btn__loading">…</span> : children}
    </button>
  );
}

export default TableActionButton;
