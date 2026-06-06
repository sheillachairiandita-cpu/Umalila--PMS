import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Eye, Pencil,
  RefreshCw, Search, X, Filter, ChevronDown, ChevronUp,
  ArrowUpDown, Download, CreditCard
} from 'lucide-react';
import { Badge } from './ui';
import TableActionButton from './TableActionButton';
import FinancialDetailsModal from './FinancialDetailsModal';
import ReservationPaymentModal from './ReservationPaymentModal';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString()}`;
}

// ─── Summary KPI Strip ─────────────────────────────────────────────────────
function KpiStrip({ rows, loading }) {
  const totals = useMemo(() => {
    if (!rows.length) return { accommodation: 0, fb: 0, addons: 0, total: 0, paid: 0, balance: 0 };
    return rows.reduce(
      (acc, r) => ({
        accommodation: acc.accommodation + (r.totalAccommodation || 0),
        fb:            acc.fb            + (r.totalMenuItems    || 0),
        addons:        acc.addons        + (r.totalAddons       || 0),
        total:         acc.total         + (r.total             || 0),
        paid:          acc.paid          + (r.amountPaid        || 0),
        balance:       acc.balance       + (r.balanceDue        || 0),
      }),
      { accommodation: 0, fb: 0, addons: 0, total: 0, paid: 0, balance: 0 }
    );
  }, [rows]);

  const cards = [
    { label: 'Total Accommodation', value: totals.accommodation, color: 'var(--navy)' },
    { label: 'Total F&B',           value: totals.fb,            color: '#059669'      },
    { label: 'Total Add-ons',       value: totals.addons,        color: '#7c3aed'      },
    { label: 'Gross Revenue',       value: totals.total,         color: 'var(--navy)',  bold: true },
    { label: 'Amount Collected',    value: totals.paid,          color: '#059669',      bold: true },
    { label: 'Outstanding Balance', value: totals.balance,       color: '#dc2626',      bold: true },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 10,
      marginBottom: 14,
    }}>
      {cards.map(({ label, value, color, bold }) => (
        <div key={label} style={{
          background: 'var(--bg-white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-light)', marginBottom: 6 }}>
            {label}
          </div>
          <div style={{ fontSize: bold ? '1rem' : '0.9rem', fontWeight: bold ? 800 : 600, color: loading ? 'var(--text-light)' : color, lineHeight: 1.2 }}>
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

// ─── Main Income Table ────────────────────────────────────────────────────
function IncomeTable({ rows, loading, onViewDetails, onEdit, onDownloadInvoice, downloadingId }) {
  const [search, setSearch]         = useState('');
  const [payFilter, setPayFilter]   = useState('all');
  const [sortField, setSortField]   = useState('checkIn');
  const [sortDir, setSortDir]       = useState('desc');

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
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
    if (payFilter !== 'all') {
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

  const thStyle = (field) => ({
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  const Th = ({ field, children, align = 'left' }) => (
    <th style={{ ...thStyle(field), textAlign: align }} onClick={() => toggleSort(field)}>
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
      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search guest or invoice…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 28, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem', background: 'var(--bg-white)', boxSizing: 'border-box',
              fontFamily: 'var(--font-sans)', color: 'var(--text)', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={12} color="var(--text-light)" />
          <select
            value={payFilter}
            onChange={e => setPayFilter(e.target.value)}
            style={{
              padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem', background: 'var(--bg-white)', color: 'var(--text)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', outline: 'none',
            }}
          >
            <option value="all">All Payments</option>
            <option value="pending">No DP</option>
            <option value="partial">DP Paid</option>
            <option value="complete">All Paid</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-light)' }}>
          {filtered.length} of {rows.length} records
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-scroll-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="pms-table">
          <thead>
            <tr>
              <Th field="invoiceId">Invoice / Booking ID</Th>
              <Th field="guestName">Guest Name</Th>
              <Th field="checkIn">Check-In</Th>
              <Th field="checkOut">Check-Out</Th>
              <Th field="totalAccommodation" align="right">Accommodation</Th>
              <Th field="totalMenuItems" align="right">F&B</Th>
              <Th field="totalAddons" align="right">Add-ons</Th>
              <Th field="total" align="right">Total Price</Th>
              <Th field="amountPaid" align="right">Amount Paid</Th>
              <Th field="balanceDue" align="right">Balance Due</Th>
              <th className="text-center">Payment</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No records match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const balanceColor = (row.balanceDue || 0) > 0 ? '#dc2626' : '#059669';
                return (
                  <tr key={row.bookingId}>
                    {/* Invoice ID */}
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.03em' }}>
                        {row.invoiceId}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                        {row.bookingId?.slice(0, 8)}…
                      </div>
                    </td>

                    {/* Guest Name */}
                    <td className="cell-guest">{row.guestName}</td>

                    {/* Dates */}
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>{row.checkIn}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>{row.checkOut}</td>

                    {/* Accommodation */}
                    <td className="text-right cell-amount" style={{ color: 'var(--navy)' }}>
                      {formatRp(row.totalAccommodation)}
                    </td>

                    {/* F&B */}
                    <td className="text-right" style={{ fontWeight: 600, color: '#059669', fontSize: '0.82rem' }}>
                      {row.totalMenuItems > 0 ? formatRp(row.totalMenuItems) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>

                    {/* Add-ons */}
                    <td className="text-right" style={{ fontWeight: 600, color: '#7c3aed', fontSize: '0.82rem' }}>
                      {row.totalAddons > 0 ? formatRp(row.totalAddons) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>

                    {/* Total Price */}
                    <td className="text-right">
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text)' }}>
                        {formatRp(row.total)}
                      </span>
                    </td>

                    {/* Amount Paid */}
                    <td className="text-right" style={{ fontWeight: 600, color: '#059669', fontSize: '0.85rem' }}>
                      {formatRp(row.amountPaid)}
                    </td>

                    {/* Balance Due */}
                    <td className="text-right">
                      <span style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: balanceColor,
                        padding: (row.balanceDue || 0) > 0 ? '2px 7px' : undefined,
                        background: (row.balanceDue || 0) > 0 ? '#fef2f2' : undefined,
                        borderRadius: (row.balanceDue || 0) > 0 ? 6 : undefined,
                      }}>
                        {(row.balanceDue || 0) === 0 ? <span style={{ color: '#059669', fontSize: '0.8rem' }}>Settled ✓</span> : formatRp(row.balanceDue)}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="text-center">
                      <Badge type="payment" value={row.paymentStatus || 'pending'} />
                    </td>

                    {/* Actions */}
                    <td className="text-center">
                      <div className="table-action-group">
                        <TableActionButton title="View Details" variant="default" onClick={() => onViewDetails(row)}>
                          <Eye size={13} />
                        </TableActionButton>
                        <TableActionButton
                          title="Edit Payment"
                          variant="success"
                          onClick={() => onEdit(row)}
                        >
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
              })
            )}
          </tbody>

          {/* ── Totals footer ── */}
          {filtered.length > 1 && (
            <tfoot>
              <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Filtered Subtotals ({filtered.length} records)
                </td>
                <td className="text-right" style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--navy)', padding: '8px 12px' }}>
                  {formatRp(filtered.reduce((s, r) => s + (r.totalAccommodation || 0), 0))}
                </td>
                <td className="text-right" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#059669', padding: '8px 12px' }}>
                  {formatRp(filtered.reduce((s, r) => s + (r.totalMenuItems || 0), 0))}
                </td>
                <td className="text-right" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#7c3aed', padding: '8px 12px' }}>
                  {formatRp(filtered.reduce((s, r) => s + (r.totalAddons || 0), 0))}
                </td>
                <td className="text-right" style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', padding: '8px 12px' }}>
                  {formatRp(filtered.reduce((s, r) => s + (r.total || 0), 0))}
                </td>
                <td className="text-right" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#059669', padding: '8px 12px' }}>
                  {formatRp(filtered.reduce((s, r) => s + (r.amountPaid || 0), 0))}
                </td>
                <td className="text-right" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dc2626', padding: '8px 12px' }}>
                  {formatRp(filtered.reduce((s, r) => s + (r.balanceDue || 0), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Invoice Downloader (same as invoiceUtils.js) ─────────────────────────
async function downloadInvoice(bookingId) {
  const res = await fetch(`/api/bookings/${bookingId}/invoice`);
  if (!res.ok) throw new Error('Failed to generate invoice');
  const invoice = await res.json();
  const formatRp2 = (n) => `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
  const menuRows = (invoice.menuItems || [])
    .map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatRp2(i.subtotal)}</td></tr>`)
    .join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice ${invoice.invoiceNumber}</title>
<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:40px}h1{margin:0 0 8px;font-size:1.5rem}.meta{color:#64748b;font-size:.9rem;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0}th{text-align:left;background:#f8fafc;font-size:.8rem;text-transform:uppercase;color:#64748b}.total-row td{font-size:1.1rem;font-weight:700;border-top:2px solid #0f172a}</style>
</head><body><h1>Umalila — Reservation Invoice</h1>
<div class="meta"><div>Invoice #: ${invoice.invoiceNumber}</div><div>Guest: ${invoice.guestName}</div><div>Stay: ${invoice.checkIn} → ${invoice.checkOut}</div><div>Villas: ${invoice.villaNames}</div><div>Generated: ${invoice.generatedAt}</div></div>
<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
<tbody><tr><td>Accommodation</td><td style="text-align:center">1</td><td style="text-align:right">${formatRp2(invoice.accommodation)}</td></tr>
<tr><td>Extra Beds</td><td style="text-align:center">—</td><td style="text-align:right">${formatRp2(invoice.extraBeds)}</td></tr>
<tr><td>Extra Breakfast</td><td style="text-align:center">—</td><td style="text-align:right">${formatRp2(invoice.extraBreakfast)}</td></tr>
${menuRows}</tbody>
<tfoot><tr><td colspan="2">Total</td><td style="text-align:right">${formatRp2(invoice.total)}</td></tr>
<tr><td colspan="2">Amount Paid</td><td style="text-align:right">${formatRp2(invoice.amountPaid)}</td></tr>
<tr class="total-row"><td colspan="2">Balance Due</td><td style="text-align:right">${formatRp2(invoice.balanceDue)}</td></tr>
</tfoot></table></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `invoice-${invoice.invoiceNumber}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────
function FinancialDashboardPage() {
  const [incomeRows, setIncomeRows] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [detailsRow, setDetailsRow] = useState(null);
  const [editRow, setEditRow]       = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchIncome = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/financial/income');
      if (!res.ok) throw new Error('Failed to load income data');
      setIncomeRows(await res.json());
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

  return (
    <div className="reservation-page">
      {/* ── Page header ── */}
      <div className="financial-page-header" style={{ marginBottom: 14 }}>
        <DollarSign size={18} color="var(--navy)" />
        <h1 className="financial-page-header__title">Financial Dashboard</h1>
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

      {/* ── KPI strip ── */}
      <KpiStrip rows={incomeRows} loading={loading} />

      {/* ── Income ledger ── */}
      <div className="section-card section-card--spaced">
        <div className="section-card__header">
          <TrendingUp size={15} color="var(--green)" />
          <h3 className="section-card__title">Income Ledger</h3>
          <span className="section-card__count">{incomeRows.length} records</span>
        </div>
        <div className="section-card__body--flush">
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
