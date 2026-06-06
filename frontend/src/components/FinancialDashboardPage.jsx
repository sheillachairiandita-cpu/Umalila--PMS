import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Eye,
  RefreshCw, Search, X, Filter, ChevronDown, ChevronUp,
  ArrowUpDown, Download, CreditCard, AlertCircle,
  CheckCircle, Clock,
} from 'lucide-react';
import { Badge } from './ui';
import TableActionButton from './TableActionButton';
import FinancialDetailsModal from './FinancialDetailsModal';
import ReservationPaymentModal from './ReservationPaymentModal';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString()}`;
}

// ─── KPI Strip ────────────────────────────────────────────────────────────
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

// ─── Sort Icon ────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ArrowUpDown size={11} color="var(--text-light)" style={{ marginLeft: 4, flexShrink: 0 }} />;
  return sortDir === 'asc'
    ? <ChevronUp   size={11} color="var(--navy)" style={{ marginLeft: 4, flexShrink: 0 }} />
    : <ChevronDown size={11} color="var(--navy)" style={{ marginLeft: 4, flexShrink: 0 }} />;
}

// ─── Income Table ─────────────────────────────────────────────────────────
function IncomeTable({ rows, loading, onViewDetails, onEdit, onDownloadInvoice, downloadingId }) {
  const [search, setSearch]       = useState('');
  const [payFilter, setPayFilter] = useState('all');
  const [sortField, setSortField] = useState('balanceDue');
  const [sortDir, setSortDir]     = useState('desc');

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let data = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.guestName?.toLowerCase().includes(q) ||
        r.invoiceId?.toLowerCase().includes(q)
      );
    }
    if (payFilter === 'unpaid') {
      data = data.filter(r => r.paymentStatus !== 'complete');
    } else if (payFilter !== 'all') {
      data = data.filter(r => r.paymentStatus === payFilter);
    }
    data.sort((a, b) => {
      let av = a[sortField] ?? '', bv = b[sortField] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [rows, search, payFilter, sortField, sortDir]);

  const unpaidCount = useMemo(() => rows.filter(r => r.paymentStatus !== 'complete').length, [rows]);
  const hasActiveFilters = search || payFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setPayFilter('all');
  };

  const Th = ({ field, children, align = 'left' }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: align }} onClick={() => toggleSort(field)}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {children}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </span>
    </th>
  );

  if (loading) return <div className="empty-state">Loading income records…</div>;
  if (!rows.length) return <div className="empty-state empty-state--dashed">No income records found.</div>;

  return (
    <div>
      {/* ── Filter bar matching ReservationPage style ── */}
      <div className="filter-bar">
        <div>
          <label className="filter-bar__label">Search</label>
          <div className="filter-bar__search-wrap">
            <Search size={13} className="filter-bar__search-icon" />
            <input
              type="text"
              className="filter-bar__input filter-bar__input--search"
              placeholder="Guest name or invoice…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="filter-bar__label">Payment</label>
          <select
            className="filter-bar__select"
            value={payFilter}
            onChange={e => setPayFilter(e.target.value)}
          >
            <option value="all">All Payments</option>
            <option value="unpaid">Unpaid / Outstanding ({unpaidCount})</option>
            <option value="pending">No DP</option>
            <option value="partial">DP Paid</option>
            <option value="complete">All Paid</option>
          </select>
        </div>

        <div />
        <div />

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
          : `${filtered.length} of ${rows.length} record${rows.length !== 1 ? 's' : ''}`}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state empty-state--dashed">
          <Filter size={30} color="var(--text-light)" style={{ marginBottom: 10 }} />
          <h3 className="section-card__title" style={{ marginBottom: 6 }}>No records match your filters</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Try adjusting your search or payment filter.</p>
        </div>
      ) : (
        <div className="table-scroll-wrap">
          <table className="pms-table">
            <thead>
              <tr>
                <Th field="invoiceId">Invoice</Th>
                <Th field="guestName">Guest</Th>
                <Th field="checkIn">Check-In</Th>
                <Th field="checkOut">Check-Out</Th>
                <Th field="totalAccommodation" align="right">Accommodation</Th>
                <Th field="totalMenuItems" align="right">F&B</Th>
                <Th field="totalAddons" align="right">Add-ons</Th>
                <Th field="total" align="right">Total</Th>
                <Th field="amountPaid" align="right">Paid</Th>
                <Th field="balanceDue" align="right">Balance Due</Th>
                <th className="text-center">Payment</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const hasBalance = (row.balanceDue || 0) > 0;
                const rowBg = hasBalance && row.paymentStatus === 'pending'
                  ? 'rgba(254,242,242,0.4)'
                  : hasBalance && row.paymentStatus === 'partial'
                  ? 'rgba(255,251,235,0.5)'
                  : undefined;

                return (
                  <tr key={row.bookingId} style={rowBg ? { background: rowBg } : undefined}>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)' }}>
                        {row.invoiceId}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                        {row.bookingId?.slice(0, 8)}…
                      </div>
                    </td>

                    <td className="cell-guest">{row.guestName}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>{row.checkIn}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>{row.checkOut}</td>

                    <td className="text-right cell-amount" style={{ color: 'var(--navy)' }}>
                      {formatRp(row.totalAccommodation)}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600, color: '#059669', fontSize: '0.82rem' }}>
                      {row.totalMenuItems > 0 ? formatRp(row.totalMenuItems) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td className="text-right" style={{ fontWeight: 600, color: '#7c3aed', fontSize: '0.82rem' }}>
                      {row.totalAddons > 0 ? formatRp(row.totalAddons) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td className="text-right">
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text)' }}>
                        {formatRp(row.total)}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontWeight: 600, color: '#059669', fontSize: '0.85rem' }}>
                      {row.amountPaid > 0 ? formatRp(row.amountPaid) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td className="text-right">
                      {hasBalance ? (
                        <span style={{
                          fontWeight: 700, fontSize: '0.85rem',
                          color: row.paymentStatus === 'pending' ? '#dc2626' : '#d97706',
                          padding: '2px 7px',
                          background: row.paymentStatus === 'pending' ? '#fef2f2' : '#fffbeb',
                          borderRadius: 6,
                          border: `1px solid ${row.paymentStatus === 'pending' ? '#fecaca' : '#fde68a'}`,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <AlertCircle size={10} />
                          {formatRp(row.balanceDue)}
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>
                          Settled ✓
                        </span>
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
                        <TableActionButton title="Manage Payment" variant="success" onClick={() => onEdit(row)}>
                          <CreditCard size={13} />
                        </TableActionButton>
                        <TableActionButton
                          title="Download Invoice"
                          variant="default"
                          onClick={() => onDownloadInvoice(row)}
                          loading={downloadingId === row.bookingId}
                        >
                          <Download size={13} />
                        </TableActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Downloader ───────────────────────────────────────────────────
async function downloadInvoice(bookingId) {
  const res = await fetch(`/api/bookings/${bookingId}/invoice`);
  if (!res.ok) throw new Error('Failed to generate invoice');
  const invoice = await res.json();
  const fmt = (n) => `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
  const menuRows = (invoice.menuItems || [])
    .map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${fmt(i.subtotal)}</td></tr>`)
    .join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice ${invoice.invoiceNumber}</title>
<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:40px}h1{margin:0 0 8px;font-size:1.5rem}.meta{color:#64748b;font-size:.9rem;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0}th{text-align:left;background:#f8fafc;font-size:.8rem;text-transform:uppercase;color:#64748b}.total-row td{font-size:1.1rem;font-weight:700;border-top:2px solid #0f172a}</style>
</head><body><h1>Umalila — Reservation Invoice</h1>
<div class="meta"><div>Invoice #: ${invoice.invoiceNumber}</div><div>Guest: ${invoice.guestName}</div><div>Stay: ${invoice.checkIn} → ${invoice.checkOut}</div><div>Villas: ${invoice.villaNames}</div><div>Generated: ${invoice.generatedAt}</div></div>
<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
<tbody><tr><td>Accommodation</td><td style="text-align:center">1</td><td style="text-align:right">${fmt(invoice.accommodation)}</td></tr>
<tr><td>Extra Beds</td><td style="text-align:center">—</td><td style="text-align:right">${fmt(invoice.extraBeds)}</td></tr>
<tr><td>Extra Breakfast</td><td style="text-align:center">—</td><td style="text-align:right">${fmt(invoice.extraBreakfast)}</td></tr>
${menuRows}</tbody>
<tfoot><tr><td colspan="2">Total</td><td style="text-align:right">${fmt(invoice.total)}</td></tr>
<tr><td colspan="2">Amount Paid</td><td style="text-align:right">${fmt(invoice.amountPaid)}</td></tr>
<tr class="total-row"><td colspan="2">Balance Due</td><td style="text-align:right">${fmt(invoice.balanceDue)}</td></tr>
</tfoot></table></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `invoice-${invoice.invoiceNumber}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────
function FinancialDashboardPage() {
  const [incomeRows, setIncomeRows]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [detailsRow, setDetailsRow]         = useState(null);
  const [editRow, setEditRow]               = useState(null);
  const [downloadingId, setDownloadingId]   = useState(null);

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

  const handleDownload = async (row) => {
    setDownloadingId(row.bookingId);
    try {
      await downloadInvoice(row.bookingId);
    } catch (err) {
      alert(err.message || 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const editBooking = editRow
    ? { id: editRow.bookingId, guest_full_name: editRow.guestName }
    : null;

  const unpaidCount = incomeRows.filter(r => r.paymentStatus !== 'complete').length;

  return (
    <div className="reservation-page">

      {/* ── KPI stats strip ── */}
      <KpiStrip rows={incomeRows} loading={loading} />

      {/* ── Outstanding alert ── */}
      {!loading && unpaidCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          marginBottom: 10,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: '#dc2626',
        }}>
          <AlertCircle size={14} />
          {unpaidCount} reservation{unpaidCount !== 1 ? 's' : ''} with outstanding balance
        </div>
      )}

      {/* ── Income ledger ── */}
      <div className="section-card section-card--spaced">
        <div className="section-card__header">
          <TrendingUp size={15} color="var(--green)" />
          <h3 className="section-card__title">Income Ledger</h3>
          <span className="section-card__count">{incomeRows.length} records</span>
          {unpaidCount > 0 && (
            <span style={{
              marginLeft: 6, fontSize: '0.65rem', fontWeight: 700,
              color: '#dc2626', background: '#fef2f2',
              border: '1px solid #fecaca', padding: '1px 7px', borderRadius: 10,
            }}>
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
            onDownloadInvoice={handleDownload}
            downloadingId={downloadingId}
          />
        </div>
      </div>

      {/* ── Outcome (placeholder) ── */}
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

      {/* ── Modals ── */}
      <FinancialDetailsModal
        isOpen={!!detailsRow}
        bookingId={detailsRow?.bookingId}
        guestName={detailsRow?.guestName}
        onClose={() => setDetailsRow(null)}
      />

      <ReservationPaymentModal
        isOpen={!!editRow}
        booking={editBooking}
        onClose={() => setEditRow(null)}
        onPaymentRecorded={() => {
          fetchIncome();
          setEditRow(null);
        }}
      />
    </div>
  );
}

export default FinancialDashboardPage;
