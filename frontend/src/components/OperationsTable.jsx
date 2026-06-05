import React, { useState, useMemo } from 'react';
import {
  RefreshCw, ClipboardList, DollarSign, LogIn, LogOut,
  ShoppingCart, Eye
} from 'lucide-react';
import { Badge, Button } from './ui';
import FilterButtonGroup from './ui/FilterButtonGroup';
import { COLORS } from '../styles/theme';
import OrderModal from './OrderModal';
import FinancialSummaryModal from './FinancialSummaryModal';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: 'today',      label: 'Today'       },
  { key: 'upcoming-7', label: 'Next 7 Days' },
  { key: 'all-phases', label: 'All'         },
];

const BASE_URL = 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function BreakfastCell({ count }) {
  if (!count) return <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 26, height: 26, borderRadius: '50%',
      background: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '0.8rem',
    }}>
      {count}
    </span>
  );
}

function ExtraBedCell({ count }) {
  if (!count) return <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 26, height: 26, borderRadius: '50%',
      background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '0.8rem',
    }}>
      {count}
    </span>
  );
}

function rowBackground(phase) {
  if (phase === 'arrival')   return 'rgba(224,242,254,0.3)';
  if (phase === 'departure') return 'rgba(254,243,199,0.3)';
  return 'transparent';
}

function BookingActions({
  booking, todayISO,
  checkingInId, checkingOutId,
  onView, onPayment, onOrder, onCheckIn, onCheckOut,
}) {
  const canCheckIn  = booking.status === 'confirmed' && booking.stay_phase !== 'upcoming';
  const canCheckOut = booking.status === 'checked_in' && booking.check_out_date <= todayISO;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '6px', flexWrap: 'wrap',
    }}>
      <Button variant="secondary" size="sm" icon={Eye}
        title="View financial summary" onClick={() => onView(booking)}>
        View
      </Button>

      <Button variant="success" size="sm" icon={DollarSign}
        title="Record payment" onClick={() => onPayment(booking)}>
        Payment
      </Button>

      {booking.status === 'checked_in' && (
        <Button variant="secondary" size="sm" icon={ShoppingCart}
          title="Add food & beverage order" onClick={() => onOrder(booking)}
          style={{ borderColor: COLORS.info, color: COLORS.info }}>
          Order
        </Button>
      )}

      {canCheckIn && (
        <Button variant="primary" size="sm" icon={LogIn}
          title="Check in guest"
          onClick={() => onCheckIn(booking.id)}
          disabled={checkingInId === booking.id}
          loading={checkingInId === booking.id}>
          Check In
        </Button>
      )}

      {canCheckOut && (
        <Button variant="secondary" size="sm" icon={LogOut}
          title="Check out guest"
          onClick={() => onCheckOut(booking.id)}
          disabled={checkingOutId === booking.id}
          loading={checkingOutId === booking.id}
          style={{ borderColor: COLORS.warning, color: COLORS.warning }}>
          Check Out
        </Button>
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
        <th style={{ textAlign: 'center' }}>Pax</th>
        <th style={{ textAlign: 'center' }}>Bfast</th>
        <th style={{ textAlign: 'center' }}>Extra Bed</th>
        <th style={{ textAlign: 'center' }}>Payment</th>
        <th>Status</th>
        <th>Phase</th>
        <th style={{ textAlign: 'center' }}>Actions</th>
      </tr>
    </thead>
  );
}

function BookingRow({ booking, todayISO, checkingInId, checkingOutId, onView, onPayment, onOrder, onCheckIn, onCheckOut }) {
  return (
    <tr style={{ background: rowBackground(booking.stay_phase) }}>
      <td>
        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
          {booking.guests?.full_name || 'Walk-in Guest'}
        </div>
      </td>
      <td style={{ fontSize: '0.85rem' }}>{booking.villa_names || '—'}</td>
      <td style={{ fontSize: '0.82rem', color: '#475569' }}>{booking.check_in_date}</td>
      <td style={{ fontSize: '0.82rem', color: '#475569' }}>{booking.check_out_date}</td>
      <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
        {booking.total_guests ?? '—'}
      </td>
      <td style={{ textAlign: 'center' }}><BreakfastCell count={booking.total_breakfast} /></td>
      <td style={{ textAlign: 'center' }}><ExtraBedCell count={booking.extra_bed_qty} /></td>
      <td><Badge type="payment" value={booking.payment_status || 'pending'} /></td>
      <td><Badge type="status" value={booking.status} /></td>
      <td>
        <Badge
          type="phase"
          value={booking.stay_phase}
          icon={
            booking.stay_phase === 'arrival'   ? '→' :
            booking.stay_phase === 'departure' ? '←' : undefined
          }
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        <BookingActions
          booking={booking}
          todayISO={todayISO}
          checkingInId={checkingInId}
          checkingOutId={checkingOutId}
          onView={onView}
          onPayment={onPayment}
          onOrder={onOrder}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
        />
      </td>
    </tr>
  );
}

function SectionHeader({ smartFilter, setSmartFilter, loading, onRefresh, today }) {
  return (
    <div className="section-title" style={{ padding: '12px 20px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={16} color="#1e3a8a" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            Reservation
            {smartFilter === 'today'      && ' — Today'}
            {smartFilter === 'upcoming-7' && ' — Next Week'}
            {smartFilter === 'all-phases' && ' — All Reservations'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 4 }}>{today}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FilterButtonGroup options={FILTER_OPTIONS} active={smartFilter} onChange={setSmartFilter} />
          <button onClick={onRefresh} title="Refresh"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Custom hooks
// ─────────────────────────────────────────────────────────────

function useBookingActions(onRefresh) {
  const [checkingInId,  setCheckingInId]  = useState(null);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const handleCheckIn = async (bookingId) => {
    setCheckingInId(bookingId);
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/check-in`, {
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
      const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/check-out`, {
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
        const isInHouse   = b.check_in_date  <  todayISO && b.check_out_date > todayISO;
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

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

function OperationsTable({ bookings, loading, error, onRefresh }) {
  const [smartFilter, setSmartFilter] = useState('today');
  const [viewModalBooking,  setViewModalBooking]  = useState(null);
  const [orderModalBooking, setOrderModalBooking] = useState(null);

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
        {!loading && error && <div className="empty-state" style={{ color: '#ef4444' }}>⚠️ {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">No reservations match this filter.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
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
                    onView={setViewModalBooking}
                    onPayment={setViewModalBooking}
                    onOrder={setOrderModalBooking}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <FinancialSummaryModal
        isOpen={!!viewModalBooking}
        booking={viewModalBooking}
        onClose={() => setViewModalBooking(null)}
        onPaymentRecorded={() => { onRefresh(); setViewModalBooking(null); }}
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
