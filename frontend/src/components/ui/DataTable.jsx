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
      {filters}
      {actions}
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
}) {
  if (loading) {
    return <div className="empty-state">Loading…</div>;
  }

  if (!rows?.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <table className={tableClassName}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key || col.label}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => renderRow(row))}
      </tbody>
    </table>
  );
}
