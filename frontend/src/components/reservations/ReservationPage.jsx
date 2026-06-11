import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  X,
  Pencil,
  Download,
  CreditCard,
  XCircle,
} from 'lucide-react';
import Badge from '../ui/Badge';
import TableActionButton from '../TableActionButton';
import TablePagination from '../ui/TablePagination';
import ReservationPaymentModal from './ReservationPaymentModal';
import PublicReservationForm from './PublicReservationForm';
import { Modal, Button, Alert, Textarea } from '../ui';
import { downloadReservationInvoice } from '../../utils/invoiceUtils';
import { PAYMENT_FILTER_OPTIONS, TIMEFRAME_FILTER_OPTIONS } from '../../utils/statusConfigs';
import { matchesTimeframeFilter } from '../../utils/tableFilters';

// =====================================================
// 📊 SECTION 1: DASHBOARD STATS CARDS
// =====================================================
function DashboardMetrics({ stats, loading }) {
  const metrics = [
    { label: 'Total Bookings', value: stats?.totalBookings || 0, icon: Calendar },
    { label: 'Pending Approval', value: stats?.pendingApproval || 0, icon: Clock },
    { label: 'Confirmed', value: stats?.confirmedBookings || 0, icon: CheckCircle },
  ];

  return (
    <div className="stats-grid">
      {metrics.map(({ label, value, icon: Icon }) => (
        <div key={label} className="metric-card">
          <div className="metric-card__icon-bg">
            <Icon color="var(--navy)" />
          </div>
          <div className="metric-card__label-row">
            <Icon color="var(--text-muted)" />
            <span className="metric-card__label">{label}</span>
          </div>
          <div className={loading ? 'metric-card__value--loading' : 'metric-card__value'}>
            {loading ? '—' : value}
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// 📋 SECTION 2: PENDING REQUESTS TABLE
// =====================================================

const DECLINE_REASONS = [
  'Guest requested cancellation',
  'Dates unavailable / overbooking',
  'Incomplete or invalid guest information',
  'Duplicate reservation request',
  'Payment not received in time',
  'Other',
];

function DeclineRequestModal({ request, onClose, onConfirm, submitting, error }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    setSelectedReason('');
    setCustomReason('');
  }, [request?.id]);

  if (!request) return null;

  const resolvedReason =
    selectedReason === 'Other'
      ? customReason.trim()
      : selectedReason;

  const canSubmit = resolvedReason.length > 0;

  return (
    <Modal isOpen={!!request} onClose={onClose} size="md">
      <Modal.Header
        title="Decline Request"
        icon={XCircle}
        subtitle={request.guest_full_name}
      />
      <Modal.Body>
        {error && <Alert type="error" message={error} />}
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
          Select a reason for declining this reservation request. The booking and payment status will be set to cancelled.
        </p>
        <div className="decline-reason-list">
          {DECLINE_REASONS.map((reason) => (
            <label key={reason} className="decline-reason-option">
              <input
                type="radio"
                name="decline-reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => setSelectedReason(reason)}
              />
              <span>{reason}</span>
            </label>
          ))}
        </div>
        {selectedReason === 'Other' && (
          <Textarea
            label="Custom reason"
            placeholder="Describe why this request is being declined…"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            rows={3}
            required
            style={{ marginTop: 12 }}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Back
        </Button>
        <Button
          variant="danger"
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => onConfirm(resolvedReason)}
        >
          Decline Request
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function PendingRequestsTable({ requests, onApprove, onDecline, loading }) {
  if (loading) {
    return <div className="empty-state">Loading pending requests…</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="empty-state empty-state--dashed">
        <CheckCircle size={32} color="var(--green)" style={{ marginBottom: 10, opacity: 0.7 }} />
        <h3 className="section-card__title" style={{ marginBottom: 6 }}>All clear — no pending requests</h3>
        <p className="text-muted" style={{ fontSize: '0.8rem' }}>All reservation requests have been processed.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll-wrap" style={{ border: 'none', borderRadius: 0 }}>
      <table className="pms-table">
        <thead>
          <tr>
            <th>Guest</th>
            <th>Check-In</th>
            <th>Check-Out</th>
            <th className="text-center">Adults / Children</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="cell-guest">{request.guest_full_name}</td>
              <td>{request.check_in_date}</td>
              <td>{request.check_out_date}</td>
              <td className="text-center">{request.adults} / {request.children}</td>
              <td className="text-center">
                <div className="table-action-group">
                  <TableActionButton
                    title="View details"
                    variant="default"
                    onClick={() => alert(`Details for ${request.guest_full_name} — TBD`)}
                  >
                    <Eye size={13} />
                  </TableActionButton>
                  <TableActionButton
                    title="Approve request"
                    variant="success"
                    onClick={() => onApprove(request.id)}
                  >
                    <CheckCircle size={13} />
                  </TableActionButton>
                  <TableActionButton
                    title="Decline request"
                    variant="danger"
                    onClick={() => onDecline(request)}
                  >
                    <XCircle size={13} />
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

// =====================================================
// 📅 SECTION 3: ALL RESERVATIONS LIST
// =====================================================

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'checked_out', label: 'Checked Out' },
  { key: 'cancelled', label: 'Cancelled' },
];

function AllReservationsTable({
  reservations,
  loading,
  onEdit,
  onDownloadInvoice,
  onPayment,
  downloadingId,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    return reservations.filter((res) => {
      if (
        searchTerm &&
        !res.guest_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !res.villa_names?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !res.display_id?.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;

      if (paymentFilter !== 'all' && res.payment_status !== paymentFilter)
        return false;
      if (statusFilter !== 'all' && res.status !== statusFilter) return false;
      if (!matchesTimeframeFilter(res.check_in_date, timeframeFilter)) return false;
      return true;
    });
  }, [reservations, searchTerm, paymentFilter, statusFilter, timeframeFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

  const hasActiveFilters =
    searchTerm ||
    paymentFilter !== 'all' ||
    statusFilter !== 'all' ||
    timeframeFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setPaymentFilter('all');
    setStatusFilter('all');
    setTimeframeFilter('all');
    setCurrentPage(1);
  };

  return (
    <div>
      <div className="filter-bar">
        <div>
          <label className="filter-bar__label">Search</label>
          <div className="filter-bar__search-wrap">
            <Search size={13} className="filter-bar__search-icon" />
            <input
              type="text"
              className="filter-bar__input filter-bar__input--search"
              placeholder="Guest name or villa…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div>
          <label className="filter-bar__label">Payment</label>
          <select
            className="filter-bar__select"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            {PAYMENT_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-bar__label">Status</label>
          <select
            className="filter-bar__select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-bar__label">Timeframe</label>
          <select
            className="filter-bar__select"
            value={timeframeFilter}
            onChange={(e) => {
              setTimeframeFilter(e.target.value);
              setCurrentPage(1);
            }}
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
          : `Showing ${startIdx + 1}–${Math.min(
              startIdx + itemsPerPage,
              filtered.length
            )} of ${filtered.length} reservation${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state">Loading reservations…</div>
      ) : paginatedData.length === 0 ? (
        <div className="empty-state empty-state--dashed">
          <Filter size={30} color="var(--text-light)" style={{ marginBottom: 10 }} />
          <h3 className="section-card__title" style={{ marginBottom: 6 }}>No reservations found</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className="table-scroll-wrap">
          <table className="pms-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Villas</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Payment</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((res) => {
                const isCancelled = res.status === 'cancelled';
                return (
                  <tr key={res.id}>
                    <td className="cell-guest">{res.guest_full_name}</td>
                    <td className="cell-truncate">{res.villa_names || '—'}</td>
                    <td>{res.check_in_date}</td>
                    <td>{res.check_out_date}</td>
                    <td className="text-right cell-amount">
                      Rp {res.total_price?.toLocaleString() || '0'}
                    </td>
                    <td className="text-center">
                      <Badge type="payment" value={res.payment_status || 'pending'} />
                    </td>
                    <td className="text-center">
                      <Badge type="status" value={res.status} />
                    </td>
                    <td className="text-center">
                      <div className="table-action-group">
                        <TableActionButton
                          title="Edit Reservation"
                          variant="default"
                          onClick={() => onEdit(res)}
                        >
                          <Pencil size={13} />
                        </TableActionButton>
                        <TableActionButton
                          title="Download Invoice"
                          variant="success"
                          onClick={() => onDownloadInvoice(res)}
                          loading={downloadingId === res.id}
                        >
                          <Download size={13} />
                        </TableActionButton>
                        <TableActionButton
                          title="Payment"
                          variant="warning"
                          onClick={() => onPayment(res)}
                          disabled={isCancelled}
                        >
                          <CreditCard size={13} />
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

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

// =====================================================
// 🎯 MAIN COMPONENT: RESERVATION PAGE
// =====================================================
function ReservationPage() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editBooking, setEditBooking] = useState(null);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [declineError, setDeclineError] = useState(null);

  const processBookings = (bookingsData) => {
    const pending = bookingsData
      .filter((b) => b.status === 'pending')
      .map((b) => ({
        ...b,
        guest_full_name: b.guests?.full_name || 'Unknown Guest',
        adults: parseInt(b.notes?.match(/Adults:\s*(\d+)/)?.[1] || '0'),
        children: parseInt(b.notes?.match(/Children:\s*(\d+)/)?.[1] || '0'),
      }));

    const approved = bookingsData
      .filter((b) => b.status !== 'pending')
      .map((b) => ({
        ...b,
        guest_full_name: b.guests?.full_name || 'Unknown Guest',
        payment_status: b.payment_status || 'pending',
      }));

    setPendingRequests(pending);
    setAllReservations(approved);
    setStats({
      totalBookings: bookingsData.length,
      pendingApproval: pending.length,
      confirmedBookings: approved.filter((b) => b.status === 'confirmed').length,
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const bookingsRes = await fetch('/api/bookings');
      if (!bookingsRes.ok) throw new Error('Failed to fetch bookings');
      const bookingsData = await bookingsRes.json();
      processBookings(bookingsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadInvoice = async (reservation) => {
    try {
      setDownloadingId(reservation.id);
      await downloadReservationInvoice(reservation.id, reservation.display_id);
    } catch (err) {
      console.error('Invoice download failed:', err);
      alert(err.message || 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePaymentRecorded = () => {
    fetchData();
  };

  const handleReservationSaved = () => {
    fetchData();
  };

  const handleDeclineRequest = async (reason) => {
    if (!declineTarget) return;

    setDeclineSubmitting(true);
    setDeclineError(null);
    try {
      const response = await fetch(`/api/bookings/${declineTarget.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason: reason }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to decline request');
      }

      setPendingRequests((prev) => prev.filter((r) => r.id !== declineTarget.id));
      setStats((prev) => ({
        ...prev,
        pendingApproval: Math.max(0, prev.pendingApproval - 1),
      }));
      setDeclineTarget(null);
    } catch (err) {
      setDeclineError(err.message);
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const response = await fetch(
        `/api/bookings/${requestId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        }
      );
      if (!response.ok) throw new Error('Failed to approve request');

      const approvedRequest = pendingRequests.find((r) => r.id === requestId);
      if (approvedRequest) {
        setPendingRequests(pendingRequests.filter((r) => r.id !== requestId));
        setAllReservations([
          ...allReservations,
          {
            ...approvedRequest,
            status: 'confirmed',
            payment_status: 'pending',
          },
        ]);
        setStats((prev) => ({
          ...prev,
          pendingApproval: prev.pendingApproval - 1,
          confirmedBookings: prev.confirmedBookings + 1,
        }));
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request');
    }
  };

  return (
    <div className="reservation-page">
      <DashboardMetrics stats={stats} loading={statsLoading} />

      <div className="section-card section-card--spaced">
        <div className="section-card__header">
          <Clock size={15} color="var(--text-muted)" />
          <h3 className="section-card__title">Pending Requests</h3>
          {pendingRequests.length > 0 && (
            <span className="section-card__count section-card__count--accent">
              {pendingRequests.length} awaiting
            </span>
          )}
        </div>
        <div className="section-card__body--flush">
          <PendingRequestsTable
            requests={pendingRequests}
            onApprove={handleApproveRequest}
            onDecline={(request) => {
              setDeclineError(null);
              setDeclineTarget(request);
            }}
            loading={loading}
          />
        </div>
      </div>

      <div className="section-card">
        <div className="section-card__header">
          <Calendar size={15} color="var(--navy)" />
          <h3 className="section-card__title">All Reservations</h3>
          <span className="section-card__count">{allReservations.length} total</span>
        </div>
        <div className="section-card__body">
          <AllReservationsTable
            reservations={allReservations}
            loading={loading}
            onEdit={setEditBooking}
            onDownloadInvoice={handleDownloadInvoice}
            onPayment={setPaymentBooking}
            downloadingId={downloadingId}
          />
        </div>
      </div>

      <PublicReservationForm
        variant="modal"
        isOpen={!!editBooking}
        booking={editBooking}
        onClose={() => setEditBooking(null)}
        onSaved={handleReservationSaved}
      />

      <ReservationPaymentModal
        isOpen={!!paymentBooking}
        booking={paymentBooking}
        onClose={() => setPaymentBooking(null)}
        onPaymentRecorded={handlePaymentRecorded}
      />

      <DeclineRequestModal
        request={declineTarget}
        onClose={() => {
          if (!declineSubmitting) {
            setDeclineTarget(null);
            setDeclineError(null);
          }
        }}
        onConfirm={handleDeclineRequest}
        submitting={declineSubmitting}
        error={declineError}
      />
    </div>
  );
}

export default ReservationPage;
