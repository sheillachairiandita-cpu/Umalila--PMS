import React, { useMemo, useState } from 'react';
import { Edit, Eye, Filter, Plus } from 'lucide-react';
import { Badge, Button } from '../ui';
import TableActionButton from '../TableActionButton';
import TablePagination from '../ui/TablePagination';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_OPTIONS,
  TIMEFRAME_FILTER_OPTIONS,
} from '../../utils/statusConfigs';
import { matchesTimeframeFilter } from '../../utils/tableFilters';
import { formatRp } from '../../utils/formatCurrency';

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'pending', label: 'Pending' },
];

function ExpenseLedgerTable({ expenses, loading, onEdit, onViewProof, onAddExpense }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...expenses];

    if (categoryFilter !== 'all') {
      data = data.filter((e) => e.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      data = data.filter((e) => e.status === statusFilter);
    }

    if (timeframeFilter !== 'all') {
      data = data.filter((e) => matchesTimeframeFilter(e.transactionDate, timeframeFilter));
    }

    return data.sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));
  }, [expenses, categoryFilter, statusFilter, timeframeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div>
      <div className="filter-bar filter-bar--expense-ledger filter-bar--with-actions">
        <div>
          <label className="filter-bar__label">Category</label>
          <select
            className="filter-bar__select"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-bar__label">Date Range</label>
          <select
            className="filter-bar__select"
            value={timeframeFilter}
            onChange={(e) => { setTimeframeFilter(e.target.value); setCurrentPage(1); }}
          >
            {TIMEFRAME_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-bar__label">Status</label>
          <select
            className="filter-bar__select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {onAddExpense && (
          <div className="filter-bar__actions">
            <Button variant="primary" icon={Plus} onClick={onAddExpense}>
              Add New Expense
            </Button>
          </div>
        )}
      </div>

      <div className="table-result-count">
        {filtered.length === 0
          ? 'No results'
          : `Showing ${startIdx + 1}–${Math.min(startIdx + itemsPerPage, filtered.length)} of ${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {loading ? (
        <div className="empty-state">Loading expense ledger…</div>
      ) : paginatedData.length === 0 ? (
        <div className="empty-state empty-state--dashed">
          <Filter size={30} color="var(--text-light)" style={{ marginBottom: 10 }} />
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>No expenses match your filters.</p>
        </div>
      ) : (
        <div className="table-scroll-wrap table-scroll-wrap--cards-mobile">
          <table className="pms-table pms-table--financial pms-table--cards-mobile">
            <thead>
              <tr>
                <th>Display ID</th>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th>Date</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((expense) => (
                <tr key={expense.id}>
                  <td data-label="Display ID">
                    <span className="cell-booking-id">{expense.displayId || '—'}</span>
                  </td>
                  <td data-label="Category">{EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}</td>
                  <td className="cell-truncate" data-label="Description">{expense.description || '—'}</td>
                  <td className="text-right" data-label="Amount">{formatRp(expense.amount)}</td>
                  <td data-label="Date">{expense.transactionDate}</td>
                  <td className="text-center" data-label="Status">
                    <Badge type="expense" value={expense.status} />
                  </td>
                  <td className="text-center" data-label="Actions">
                    <div className="table-action-group">
                      <TableActionButton title="Edit" variant="default" onClick={() => onEdit(expense)}>
                        <Edit size={13} />
                      </TableActionButton>
                      <TableActionButton
                        title="View Proof"
                        variant="default"
                        onClick={() => onViewProof(expense)}
                        disabled={!expense.proof}
                      >
                        <Eye size={13} />
                      </TableActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

export default ExpenseLedgerTable;
