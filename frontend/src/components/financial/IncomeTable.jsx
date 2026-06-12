import React, { useMemo, useState } from 'react';
import { Eye, Filter, Search, X } from 'lucide-react';
import { Badge } from '../ui';
import TableActionButton from '../TableActionButton';
import TablePagination from '../ui/TablePagination';
import {
  PAYMENT_FILTER_OPTIONS,
  TIMEFRAME_FILTER_OPTIONS,
} from '../../utils/statusConfigs';
import { matchesTimeframeFilter } from '../../utils/tableFilters';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString('id-ID')}`;
}

function IncomeTable({ rows, loading, onViewDetails }) {
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const unpaidCount = useMemo(() => rows.filter((r) => r.paymentStatus !== 'complete').length, [rows]);

  const filtered = useMemo(() => {
    let data = [...rows];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.guestName?.toLowerCase().includes(q) ||
          r.displayId?.toLowerCase().includes(q) ||
          r.invoiceId?.toLowerCase().includes(q)
      );
    }

    if (payFilter === 'unpaid') {
      data = data.filter((r) => r.paymentStatus !== 'complete');
    } else if (payFilter !== 'all') {
      data = data.filter((r) => r.paymentStatus === payFilter);
    }

    if (timeframeFilter !== 'all') {
      data = data.filter((r) => matchesTimeframeFilter(r.checkIn, timeframeFilter));
    }

    return data;
  }, [rows, search, payFilter, timeframeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

  const hasActiveFilters = search || payFilter !== 'all' || timeframeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setPayFilter('all');
    setTimeframeFilter('all');
    setCurrentPage(1);
  };

  const paymentOptions = PAYMENT_FILTER_OPTIONS.map((o) =>
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
          <table className="pms-table pms-table--financial">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Guest</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th className="text-right">Accommodation</th>
                <th className="text-right">F&B</th>
                <th className="text-right">Add-ons</th>
                <th className="text-right">Discount</th>
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
                  <td className="text-right">{formatRp(row.totalAccommodation)}</td>
                  <td className="text-right">
                    {row.totalMenuItems > 0 ? formatRp(row.totalMenuItems) : '—'}
                  </td>
                  <td className="text-right">
                    {row.totalAddons > 0 ? formatRp(row.totalAddons) : '—'}
                  </td>
                  <td className="text-right">
                    {(row.discountAmount || 0) > 0 ? (
                      <span className="financial-summary-discount">−{formatRp(row.discountAmount)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">{formatRp(row.total)}</td>
                  <td className="text-right">
                    {row.amountPaid > 0 ? formatRp(row.amountPaid) : '—'}
                  </td>
                  <td className="text-right">
                    {(row.balanceDue || 0) > 0 ? (
                      <span className="cell-balance-due">{formatRp(row.balanceDue)}</span>
                    ) : (
                      'Settled'
                    )}
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

export default IncomeTable;
