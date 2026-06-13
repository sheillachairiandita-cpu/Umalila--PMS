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
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';
import { PendingQueueCard, PendingQueueList } from '../ui/PendingQueueCard';
import { Button, Modal, Alert, Textarea } from '../ui';
import { downloadReservationInvoice } from '../../utils/invoiceUtils';
import { PAYMENT_FILTER_OPTIONS, TIMEFRAME_FILTER_OPTIONS } from '../../utils/statusConfigs';
import { matchesTimeframeFilter } from '../../utils/tableFilters';
import ReservationPaymentModal from './ReservationPaymentModal';
import PublicReservationForm from './PublicReservationForm';
import SummaryModal from '../financial/SummaryModal';
import { useMutation } from '../../context/MutationProvider';
import { sortReservationsByRecency } from '../../utils/bookingUtils';

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
    <KpiCardGrid>
      {metrics.map(({ label, value, icon }) => (
        <KpiCard
          key={label}
          icon={icon}
          label={label}
          value={value}
          loading={loading}
        />
      ))}
    </KpiCardGrid>
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

function PendingRequestsTable({ requests, onApprove, onDecline, onView, loading }) {
  const [actionId, setActionId] = useState(null);

  if (loading) {
    return <div className="empty-state">Loading pending requests…</div>;
  }

  if (requests.length === 0) {
    return (
      <PendingQueueList
        empty
        emptyMessage="No reservation requests awaiting approval."
      />
    );
  }

  const handleApprove = async (requestId) => {
    setActionId(requestId);
    try {
      await onApprove(requestId);
    } finally {
      setActionId(null);
    }
  };

  return (
    <PendingQueueList>
      {requests.map((request) => (
        <PendingQueueCard
          key={request.id}
          id={request.display_id || request.guest_full_name}
          meta={(
            <>
              <span>{request.check_in_date}</span>
              <span className="pending-queue-card__dot">→</span>
              <span>{request.check_out_date}</span>
              <span className="pending-queue-card__dot">·</span>
              <span>{request.adults} adults, {request.children} children</span>
            </>
          )}
          description={request.display_id ? request.guest_full_name : null}
          actions={(
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={Eye}
                onClick={() => onView(request)}
              >
                View
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={CheckCircle}
                loading={actionId === request.id}
                onClick={() => handleApprove(request.id)}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={XCircle}
                onClick={() => onDecline(request)}
              >
                Decline
              </Button>
            </>
          )}
        />
      ))}
    </PendingQueueList>
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
                      Rp {(Number(res.ledger_total ?? res.total_price) || 0).toLocaleString('id-ID')}
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
  const { runMutation } = useMutation();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editBooking, setEditBooking] = useState(null);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [viewRequest, setViewRequest] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [declineError, setDeclineError] = useState(null);
  const [prioritizeId, setPrioritizeId] = useState(null);

  const processBookings = (bookingsData, topId = null) => {
    const pending = bookingsData
      .filter((b) => b.status === 'pending')
      .map((b) => ({
        ...b,
        guest_full_name: b.guests?.full_name || 'Unknown Guest',
        adults: parseInt(b.notes?.match(/Adults:\s*(\d+)/)?.[1] || '0', 10),
        children: parseInt(b.notes?.match(/Children:\s*(\d+)/)?.[1] || '0', 10),
      }));

    const reservations = sortReservationsByRecency(
      bookingsData
        .filter((b) => b.status !== 'pending')
        .map((b) => ({
          ...b,
          guest_full_name: b.guests?.full_name || 'Unknown Guest',
          payment_status: b.status === 'cancelled' ? 'cancelled' : (b.payment_status || 'pending'),
          phase_status: b.status === 'cancelled' ? 'cancelled' : (b.stay_phase || b.status),
        })),
      topId || prioritizeId,
    );

    setPendingRequests(pending);
    setAllReservations(reservations);
    setStats({
      totalBookings: bookingsData.length,
      pendingApproval: pending.length,
      confirmedBookings: reservations.filter((b) => b.status === 'confirmed').length,
    });
  };

  const fetchData = async ({ silent = false, topId = null } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [bookingsRes, incomeRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/financial/income'),
      ]);
      if (!bookingsRes.ok) throw new Error('Failed to fetch bookings');
      const bookingsData = await bookingsRes.json();
      const incomeData = incomeRes.ok ? await incomeRes.json() : [];
      const ledgerById = Object.fromEntries(
        (incomeData || []).map((row) => [row.bookingId, row])
      );
      const enriched = bookingsData.map((b) => ({
        ...b,
        ledger_total: ledgerById[b.id]?.total ?? b.total_price,
        ledger_discount: ledgerById[b.id]?.discountAmount ?? 0,
      }));
      processBookings(enriched, topId);
    } catch (err) {
      console.error('Error fetching data:', err);
      throw err;
    } finally {
      if (!silent) setLoading(false);
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

  const handlePaymentRecorded = () => runMutation({
    mutation: async () => {},
    refresh: () => fetchData({ silent: true }),
    showSuccess: false,
    overlayMessage: 'Refreshing reservations…',
  });

  const handleReservationSaved = () => runMutation({
    mutation: async () => {},
    refresh: () => fetchData({ silent: true }),
    showSuccess: false,
    overlayMessage: 'Refreshing reservations…',
  });

  const handleDeclineRequest = async (reason) => {
    if (!declineTarget) return;

    setDeclineSubmitting(true);
    setDeclineError(null);

    const result = await runMutation({
      mutation: async () => {
        const response = await fetch(`/api/bookings/${declineTarget.id}/cancel`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellation_reason: reason }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to decline request');
        }
        return response.json();
      },
      refresh: () => fetchData({ silent: true, topId: declineTarget.id }),
      successMessage: 'Reservation request declined.',
      errorMessage: null,
      overlayMessage: 'Declining request…',
    });

    setDeclineSubmitting(false);

    if (result.ok) {
      setDeclineTarget(null);
      setPrioritizeId(declineTarget.id);
    } else {
      setDeclineError(result.error?.message || 'Failed to decline request');
    }
  };

  const handleApproveRequest = async (requestId) => {
    await runMutation({
      mutation: async () => {
        const response = await fetch(`/api/bookings/${requestId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        });
        if (!response.ok) throw new Error('Failed to approve request');
        return response.json();
      },
      refresh: () => fetchData({ silent: true, topId: requestId }),
      successMessage: 'Reservation approved successfully.',
      overlayMessage: 'Approving reservation…',
    });
    setPrioritizeId(requestId);
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
        <div className="section-card__body">
          <PendingRequestsTable
            requests={pendingRequests}
            onApprove={handleApproveRequest}
            onView={setViewRequest}
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

      <SummaryModal
        isOpen={!!viewRequest}
        bookingId={viewRequest?.id}
        guestName={viewRequest?.guest_full_name}
        displayId={viewRequest?.display_id}
        onClose={() => setViewRequest(null)}
      />
    </div>
  );
}

export default ReservationPage;
