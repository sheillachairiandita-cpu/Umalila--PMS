import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Eye, Pencil } from 'lucide-react';
import { Badge } from './ui';
import TableActionButton from './TableActionButton';
import FinancialDetailsModal from './FinancialDetailsModal';
import ReservationPaymentModal from './ReservationPaymentModal';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString()}`;
}

function IncomeTable({ rows, loading, onViewDetails, onEdit }) {
  if (loading) {
    return <div className="empty-state">Loading income records…</div>;
  }

  if (!rows.length) {
    return <div className="empty-state empty-state--dashed">No income records found.</div>;
  }

  return (
    <div className="table-scroll-wrap" style={{ border: 'none', borderRadius: 0 }}>
      <table className="pms-table">
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Guest Name</th>
            <th className="text-right">Total Accommodation</th>
            <th className="text-right">Total Add-ons</th>
            <th className="text-right">Total Menu Items</th>
            <th className="text-center">Payment Status</th>
            <th className="text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.bookingId}>
              <td className="cell-guest">{row.invoiceId}</td>
              <td>{row.guestName}</td>
              <td className="text-right">{formatRp(row.totalAccommodation)}</td>
              <td className="text-right">{formatRp(row.totalAddons)}</td>
              <td className="text-right">{formatRp(row.totalMenuItems)}</td>
              <td className="text-center">
                <Badge type="payment" value={row.paymentStatus || 'pending'} />
              </td>
              <td className="text-center">
                <div className="table-action-group">
                  <TableActionButton
                    title="View Details"
                    variant="default"
                    onClick={() => onViewDetails(row)}
                  >
                    <Eye size={13} />
                  </TableActionButton>
                  <TableActionButton
                    title="Edit Payment"
                    variant="success"
                    onClick={() => onEdit(row)}
                  >
                    <Pencil size={13} />
                  </TableActionButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinancialDashboardPage() {
  const [incomeRows, setIncomeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsRow, setDetailsRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

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

  useEffect(() => {
    fetchIncome();
  }, []);

  const editBooking = editRow
    ? { id: editRow.bookingId, guest_full_name: editRow.guestName }
    : null;

  return (
    <div className="reservation-page">
      <div className="financial-page-header">
        <DollarSign size={18} color="var(--navy)" />
        <h1 className="financial-page-header__title">Financial Dashboard</h1>
      </div>

      <div className="section-card section-card--spaced">
        <div className="section-card__header">
          <TrendingUp size={15} color="var(--green)" />
          <h3 className="section-card__title">Income</h3>
          <span className="section-card__count">{incomeRows.length} records</span>
        </div>
        <div className="section-card__body--flush">
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
