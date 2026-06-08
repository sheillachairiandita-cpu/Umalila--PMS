import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Eye,
  RefreshCw, Search, X, Filter,
  CreditCard, AlertCircle, CheckCircle,
} from 'lucide-react';
import { Badge } from './ui';
import TableActionButton from './TableActionButton';
import TablePagination from './TablePagination';
import FinancialDetailsModal from './FinancialDetailsModal';
import {
  FINANCIAL_PAYMENT_FILTER_OPTIONS,
  TIMEFRAME_FILTER_OPTIONS,
} from '../utils/statusConfigs';
import { matchesTimeframeFilter } from '../utils/tableFilters';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString()}`;
}

function KpiStrip({ rows, loading }) {
  const totals = useMemo(() => {
    if (!rows.length) return { accommodation: 0, fb: 0, addons: 0, total: 0, paid: 0, balance: 0, unpaidCount: 0 };
    return rows.reduce(
      (acc, r) => ({
        accommodation: acc.accommodation + (r.totalAccommodation || 0),
        fb:            acc.fb            + (r.totalMenuItems    || 0),
        addons:        acc.addons        + (r.totalAddons       || 0),
        total:         acc.total         + (r.total             || 0),
        paid:          acc.paid          + (r.amountPaid        || 0),
        balance:       acc.balance       + (r.balanceDue        || 0),
        unpaidCount:   acc.unpaidCount   + (r.paymentStatus !== 'complete' ? 1 : 0),
      }),
      { accommodation: 0, fb: 0, addons: 0, total: 0, paid: 0, balance: 0, unpaidCount: 0 }
    );
  }, [rows]);

  const cards = [
    { label: 'Accommodation',     value: totals.accommodation, icon: DollarSign },
    { label: 'Food & Beverage',   value: totals.fb,            icon: TrendingUp  },
    { label: 'Add-ons',           value: totals.addons,        icon: TrendingUp  },
    { label: 'Gross Revenue',     value: totals.total,         icon: DollarSign  },
    { label: 'Amount Collected',  value: totals.paid,          icon: CheckCircle },
    { label: 'Outstanding',       value: totals.balance,       icon: AlertCircle },
  ];

  return (
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="metric-card">
          <div className="metric-card__icon-bg">
            <Icon color="var(--navy)" />
          </div>
          <div className="metric-card__label-row">
            <Icon color="var(--text-muted)" />
            <span className="metric-card__label">{label}</span>
          </div>
          <div className={loading ? 'metric-card__value--loading' : 'metric-card__value'} style={{ fontSize: '1.1rem' }}>
            {loading ? '—' : formatRp(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function IncomeTable({ rows, loading, onViewDetails, onEdit }) {
  const [search, setSearch]           = useState('');
  const [payFilter, setPayFilter]     = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const unpaidCount = useMemo(() => rows.filter(r => r.paymentStatus !== 'complete').length, [rows]);

  const filtered = useMemo(() => {
    let data = [...rows];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.guestName?.toLowerCase().includes(q) ||
        r.displayId?.toLowerCase().includes(q) ||
        r.invoiceId?.toLowerCase().includes(q)
      );
    }

    if (payFilter === 'unpaid') {
      data = data.filter(r => r.paymentStatus !== 'complete');
    } else if (payFilter !== 'all') {
      data = data.filter(r => r.paymentStatus === payFilter);
    }

    if (timeframeFilter !== 'all') {
      data = data.filter(r => matchesTimeframeFilter(r.checkIn, timeframeFilter));
    }

    return data;
  }, [rows, search, payFilter, timeframeFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

  const hasActiveFilters = search || payFilter !== 'all' || timeframeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setPayFilter('all');
    setTimeframeFilter('all');
    setCurrentPage(1);
  };

  const paymentOptions = FINANCIAL_PAYMENT_FILTER_OPTIONS.map((o) =>
    o.key === 'unpaid' ? { ...o, label: `Unpaid / Outstanding (${unpaidCount})` } : o
  );

  return (
    <div>
      <div className="filter-bar filter-bar--financial">
        <div>
          <label className="filter-bar__label">Search</label>
          <div className="filter-bar__search-wrap">
            <Search size={13} className="filter-bar__search-icon" />
            <input
              type="text"
              className="filter-bar__input filter-bar__input--search"
              placeholder="Guest name or booking ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        <div>
          <label className="filter-bar__label">Payment</label>
          <select
            className="filter-bar__select"
            value={payFilter}
            onChange={(e) => { setPayFilter(e.target.value); setCurrentPage(1); }}
          >
            {paymentOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-bar__label">Timeframe</label>
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

        {hasActiveFilters ? (
          <button type="button" className="filter-bar__clear" onClick={clearFilters}>
            <X size={11} /> Clear
          </button>
        ) : (
          <div />
        )}
      </div>

      <div className="table-result-count">
        {filtered.length === 0
          ? 'No results'
          : `Showing ${startIdx + 1}–${Math.min(startIdx + itemsPerPage, filtered.length)} of ${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {loading ? (
        <div className="empty-state">Loading income records…</div>
      ) : paginatedData.length === 0 ? (
        <div className="empty-state empty-state--dashed">
          <Filter size={30} color="var(--text-light)" style={{ marginBottom: 10 }} />
          <h3 className="section-card__title" style={{ marginBottom: 6 }}>
            {rows.length === 0 ? 'No income records found' : 'No records match your filters'}
          </h3>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            {rows.length === 0
              ? 'Income records will appear here once bookings are created.'
              : 'Try adjusting your search, payment, or timeframe filter.'}
          </p>
        </div>
      ) : (
        <div className="table-scroll-wrap">
          <table className="pms-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Guest</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th className="text-right">Accommodation</th>
                <th className="text-right">F&B</th>
                <th className="text-right">Add-ons</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance Due</th>
                <th className="text-center">Payment</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => (
                <tr key={row.bookingId}>
                  <td>
                    <span className="cell-booking-id">{row.displayId || row.invoiceId}</span>
                  </td>
                  <td className="cell-guest">{row.guestName}</td>
                  <td>{row.checkIn}</td>
                  <td>{row.checkOut}</td>
                  <td className="text-right cell-amount">{formatRp(row.totalAccommodation)}</td>
                  <td className="text-right cell-amount">
                    {row.totalMenuItems > 0 ? formatRp(row.totalMenuItems) : '—'}
                  </td>
                  <td className="text-right cell-amount">
                    {row.totalAddons > 0 ? formatRp(row.totalAddons) : '—'}
                  </td>
                  <td className="text-right cell-amount">{formatRp(row.total)}</td>
                  <td className="text-right cell-amount">
                    {row.amountPaid > 0 ? formatRp(row.amountPaid) : '—'}
                  </td>
                  <td className="text-right cell-amount">
                    {(row.balanceDue || 0) > 0 ? formatRp(row.balanceDue) : 'Settled'}
                  </td>
                  <td className="text-center">
                    <Badge type="payment" value={row.paymentStatus || 'pending'} />
                  </td>
                  <td className="text-center">
                    <div className="table-action-group">
                      <TableActionButton title="View Details" variant="default" onClick={() => onViewDetails(row)}>
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

function FinancialDashboardPage() {
  const [incomeRows, setIncomeRows] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [detailsRow, setDetailsRow] = useState(null);
  const [editRow, setEditRow]       = useState(null);

  const fetchIncome = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/financial/income');
      if (!res.ok) throw new Error('Failed to load income data');
      const data = await res.json();
      const sorted = [...data].sort((a, b) => {
        const order = { pending: 0, partial: 1, complete: 2 };
        const diff = (order[a.paymentStatus] ?? 1) - (order[b.paymentStatus] ?? 1);
        if (diff !== 0) return diff;
        return (b.checkIn || '').localeCompare(a.checkIn || '');
      });
      setIncomeRows(sorted);
    } catch (err) {
      console.error(err);
      setIncomeRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncome(); }, []);

  const editBooking = editRow
    ? {
        id: editRow.bookingId,
        display_id: editRow.displayId,
        guest_full_name: editRow.guestName,
      }
    : null;

  const unpaidCount = incomeRows.filter(r => r.paymentStatus !== 'complete').length;

  return (
    <div className="reservation-page">
      <KpiStrip rows={incomeRows} loading={loading} />

      {!loading && unpaidCount > 0 && (
        <div className="alert-banner alert-banner--danger">
          <AlertCircle size={14} />
          {unpaidCount} reservation{unpaidCount !== 1 ? 's' : ''} with outstanding balance
        </div>
      )}

      <div className="section-card section-card--spaced">
        <div className="section-card__header">
          <TrendingUp size={15} color="var(--green)" />
          <h3 className="section-card__title">Income Ledger</h3>
          <span className="section-card__count">{incomeRows.length} records</span>
          {unpaidCount > 0 && (
            <span className="section-card__count section-card__count--accent">
              {unpaidCount} unpaid
            </span>
          )}
          <button
            type="button"
            onClick={fetchIncome}
            title="Refresh"
            className="icon-btn-ghost"
            style={{ marginLeft: 'auto' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
          </button>
        </div>
        <div className="section-card__body">
          <IncomeTable
            rows={incomeRows}
            loading={loading}
            onViewDetails={setDetailsRow}
            onEdit={setEditRow}
          />
        </div>
      </div>

      <div className="section-card">
        <div className="section-card__header">
          <TrendingDown size={15} color="var(--text-muted)" />
          <h3 className="section-card__title">Outcome</h3>
          <span className="section-card__count">TBD</span>
        </div>
        <div className="section-card__body">
          <div className="empty-state empty-state--dashed" style={{ padding: '24px' }}>
            <p className="text-muted" style={{ fontSize: '0.88rem' }}>
              Expense and outcome tracking will be available in a future release.
            </p>
          </div>
        </div>
      </div>

      <FinancialDetailsModal
        isOpen={!!detailsRow}
        bookingId={detailsRow?.bookingId}
        guestName={detailsRow?.guestName}
        displayId={detailsRow?.displayId}
        onClose={() => setDetailsRow(null)}
      />
    </div>
  );
}

export default FinancialDashboardPage;
