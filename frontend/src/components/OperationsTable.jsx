import React, { useState, useMemo } from 'react';
import {
  RefreshCw, ClipboardList, LogIn, LogOut, ShoppingCart, Eye,
} from 'lucide-react';
import { Badge } from './ui';
import FilterButtonGroup from './ui/FilterButtonGroup';
import TableActionButton from './TableActionButton';
import OrderModal from './OrderModal';
import FinancialDetailsModal from './FinancialDetailsModal';

const FILTER_OPTIONS = [
  { key: 'today',      label: 'Today'       },
  { key: 'upcoming-7', label: 'Next 7 Days' },
  { key: 'all-phases', label: 'All'         },
];

const BASE_URL = '/api';

function BreakfastCell({ count }) {
  if (!count) return <span className="cell-empty">—</span>;
  return <span className="cell-pill">{count}</span>;
}

function ExtraBedCell({ count }) {
  if (!count) return <span className="cell-empty">—</span>;
  return <span className="cell-pill">{count}</span>;
}

function rowClassName(phase) {
  const normalized = (phase || '').toLowerCase();
  if (normalized === 'arrival' || normalized === 'upcoming') return 'row-arrival';
  if (normalized === 'departure' || normalized === 'checked_out') return 'row-departure';
  return '';
}

function BookingActions({
  booking, todayISO,
  checkingInId, checkingOutId,
  onOrder, onCheckIn, onCheckOut, onViewDetails,
}) {
  const canCheckIn  = booking.status === 'confirmed';
  const canCheckOut = booking.status === 'checked_in' && booking.check_out_date <= todayISO;

  return (
    <div className="table-action-group">
      {/* View Details Ledger Folio Button */}
      <TableActionButton
        title="View Details"
        variant="default"
        onClick={onViewDetails}
      >
        <Eye size={13} />
      </TableActionButton>

      {booking.status === 'checked_in' && (
        <TableActionButton
          title="Add food & beverage order"
          variant="default"
          onClick={() => onOrder(booking)}
        >
          <ShoppingCart size={13} />
        </TableActionButton>
      )}

      {canCheckIn && (
        <TableActionButton
          title="Check in guest"
          variant="default"
          onClick={() => onCheckIn(booking.id)}
          disabled={checkingInId === booking.id}
          loading={checkingInId === booking.id}
        >
          <LogIn size={13} />
        </TableActionButton>
      )}

      {canCheckOut && (
        <TableActionButton
          title="Check out guest"
          variant="warning"
          onClick={() => onCheckOut(booking.id)}
          disabled={checkingOutId === booking.id}
          loading={checkingOutId === booking.id}
        >
          <LogOut size={13} />
        </TableActionButton>
      )}
    </div>
  );
}

function TableHead() {
  return (
    <thead>
      <tr>
        <th>Guest</th>
        <th>Unit</th>
        <th>Check In</th>
        <th>Check Out</th>
        <th className="text-center">Pax</th>
        <th className="text-center">Bfast</th>
        <th className="text-center">Extra Bed</th>
        <th className="text-center">Payment</th>
        <th>Status</th>
        <th>Phase</th>
        <th className="text-center">Actions</th>
      </tr>
    </thead>
  );
}

function BookingRow({ booking, todayISO, checkingInId, checkingOutId, onOrder, onCheckIn, onCheckOut, onViewDetails }) {
  // Automation: If status is checked_in, force phase display to 'In House'
  const computedPhase = booking.status === 'checked_in' ? 'In House' : booking.stay_phase;

  return (
    <tr className={rowClassName(computedPhase)}>
      <td className="cell-guest">
        {booking.guests?.full_name || 'Walk-in Guest'}
      </td>
      <td className="cell-truncate">{booking.villa_names || '—'}</td>
      <td>{booking.check_in_date}</td>
      <td>{booking.check_out_date}</td>
      <td className="text-center cell-amount">{booking.total_guests ?? '—'}</td>
      <td className="text-center"><BreakfastCell count={booking.total_breakfast} /></td>
      <td className="text-center"><ExtraBedCell count={booking.extra_bed_qty} /></td>
      <td className="text-center">
        <Badge type="payment" value={booking.payment_status || 'pending'} />
      </td>
      <td><Badge type="status" value={booking.status} /></td>
      <td>
        <Badge
          type="phase"
          value={computedPhase}
          icon={
            computedPhase === 'arrival'   ? '→' :
            computedPhase === 'departure' ? '←' : 
            computedPhase === 'In House'  ? '✓' : undefined
          }
        />
      </td>
      <td className="text-center">
        <BookingActions
          booking={booking}
          todayISO={todayISO}
          checkingInId={checkingInId}
          checkingOutId={checkingOutId}
          onOrder={onOrder}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onViewDetails={onViewDetails}
        />
      </td>
    </tr>
  );
}

function SectionHeader({ smartFilter, setSmartFilter, loading, onRefresh, today }) {
  return (
    <div className="section-title" style={{ padding: '10px 16px' }}>
      <div className="section-header-row">
        <div className="section-header-row__title">
          <ClipboardList size={15} color="var(--navy)" />
          <span>
            Reservation
            {smartFilter === 'today'      && ' — Today'}
            {smartFilter === 'upcoming-7' && ' — Next Week'}
            {smartFilter === 'all-phases' && ' — All Reservations'}
          </span>
          <span className="section-header-row__meta">{today}</span>
        </div>
        <div className="section-header-row__actions">
          <FilterButtonGroup options={FILTER_OPTIONS} active={smartFilter} onChange={setSmartFilter} />
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh"
            className="icon-btn-ghost"
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

function useBookingActions(onRefresh) {
  const [checkingInId,  setCheckingInId]  = useState(null);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const handleCheckIn = async (bookingId) => {
    setCheckingInId(bookingId);
    try {
      const res = await fetch(`${BASE_URL}/bookings/${bookingId}/check-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Check-in failed');
      }
      onRefresh();
    } catch (err) {
      alert('Error checking in: ' + err.message);
    } finally {
      setCheckingInId(null);
    }
  };

  const handleCheckOut = async (bookingId) => {
    setCheckingOutId(bookingId);
    try {
      const res = await fetch(`${BASE_URL}/bookings/${bookingId}/check-out`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Check-out failed');
      }
      onRefresh();
    } catch (err) {
      alert('Error checking out: ' + err.message);
    } finally {
      setCheckingOutId(null);
    }
  };

  return { checkingInId, checkingOutId, handleCheckIn, handleCheckOut };
}

function useFilteredBookings(bookings, smartFilter, todayISO) {
  return useMemo(() => {
    const sevenDaysLater = new Date(todayISO);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterISO = sevenDaysLater.toISOString().split('T')[0];

    if (smartFilter === 'today') {
      return bookings.filter(b => {
        const isArrival   = b.check_in_date  === todayISO;
        const isDeparture = b.check_out_date === todayISO;
        const isInHouse   = b.status === 'checked_in' || (b.check_in_date < todayISO && b.check_out_date > todayISO);
        return isArrival || isDeparture || isInHouse;
      });
    }
    if (smartFilter === 'upcoming-7') {
      return bookings.filter(b =>
        b.check_in_date > todayISO &&
        b.check_in_date <= sevenDaysLaterISO &&
        !['checked_out', 'cancelled'].includes(b.status)
      );
    }
    return bookings.filter(b => b.status !== 'cancelled');
  }, [bookings, todayISO, smartFilter]);
}

function OperationsTable({ bookings, loading, error, onRefresh }) {
  const [smartFilter, setSmartFilter] = useState('today');
  const [orderModalBooking, setOrderModalBooking] = useState(null);
  const [detailsRow, setDetailsRow] = useState(null);

  const today    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  const { checkingInId, checkingOutId, handleCheckIn, handleCheckOut } = useBookingActions(onRefresh);
  const filtered = useFilteredBookings(bookings, smartFilter, todayISO);

  return (
    <>
      <main className="data-section">
        <SectionHeader
          smartFilter={smartFilter}
          setSmartFilter={setSmartFilter}
          loading={loading}
          onRefresh={onRefresh}
          today={today}
        />

        {loading && <div className="empty-state">Loading reservations...</div>}
        {!loading && error && <div className="empty-state text-error">⚠️ {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">No reservations match this filter.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="table-scroll-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="pms-table">
              <TableHead />
              <tbody>
                {filtered.map(booking => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    todayISO={todayISO}
                    checkingInId={checkingInId}
                    checkingOutId={checkingOutId}
                    onOrder={setOrderModalBooking}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onViewDetails={() => setDetailsRow({
                      bookingId: booking.id,
                      guestName: booking.guests?.full_name || 'Walk-in Guest'
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <FinancialDetailsModal
        isOpen={!!detailsRow}
        bookingId={detailsRow?.bookingId}
        guestName={detailsRow?.guestName}
        onClose={() => setDetailsRow(null)}
      />

      <OrderModal
        isOpen={!!orderModalBooking}
        booking={orderModalBooking}
        onClose={() => setOrderModalBooking(null)}
        onOrderSaved={onRefresh}
      />
    </>
  );
}

export default OperationsTable;