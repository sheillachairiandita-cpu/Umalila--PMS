import React, { memo } from 'react';
import { Search } from 'lucide-react';

export const DataTableRow = memo(function DataTableRow({ children, onClick, className = '' }) {
  return (
    <tr className={className} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {children}
    </tr>
  );
});

export function TableFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  actions,
}) {
  return (
    <div className="pms-table-toolbar">
      <div className="pms-table-toolbar__search">
        <Search size={16} className="pms-table-toolbar__search-icon" />
        <input
          type="search"
          className="pms-table-toolbar__input"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {filters && <div className="pms-table-toolbar__filters">{filters}</div>}
      {actions && <div className="pms-table-toolbar__actions">{actions}</div>}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  loading,
  emptyMessage = 'No records found.',
  renderRow,
  tableClassName = 'pms-table',
  mobileCards = true,
}) {
  if (loading) {
    return <div className="empty-state">Loading…</div>;
  }

  if (!rows?.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  const wrapClass = mobileCards
    ? 'table-scroll-wrap table-scroll-wrap--cards-mobile'
    : 'table-scroll-wrap';
  const tableClass = mobileCards
    ? `${tableClassName} pms-table--cards-mobile`
    : tableClassName;

  return (
    <div className={wrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.label} className={col.className || ''}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => renderRow(row))}
        </tbody>
      </table>
    </div>
  );
}
