import React, { useState, useMemo } from 'react';
import {
  RefreshCw, ClipboardList, LogIn, LogOut, ShoppingCart, Eye,
  Users, CalendarClock,
} from 'lucide-react';
import { Badge } from '../ui';
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';
import { PHASE_CONFIG } from '../../utils/statusConfigs';
import FilterButtonGroup from '../ui/FilterButtonGroup';
import TableActionButton from '../TableActionButton';
import OrderModal from './OrderModal';
import SummaryModal from '../financial/SummaryModal';
import { isInHouseToday } from '../../utils/bookingUtils';
import { useMutation } from '../../context/MutationProvider';

const FILTER_OPTIONS = [
  { key: 'today',      label: 'Today'       },
  { key: 'upcoming-7', label: 'Next 7 Days' },
  { key: 'all-phases', label: 'All'         },
];

const BASE_URL = '/api';

const PHASE_CARD_CONFIG = [
  { key: 'arrival',   label: PHASE_CONFIG.arrival.label,   icon: LogIn },
  { key: 'in-house',  label: PHASE_CONFIG['in-house'].label, icon: Users },
  { key: 'departure', label: PHASE_CONFIG.departure.label, icon: LogOut },
  { key: 'upcoming',  label: PHASE_CONFIG.upcoming.label,  icon: CalendarClock },
];

function getBookingStatus(booking) {
  return booking.booking_status || booking.status;
}

function computePhaseConfig(booking, todayISO) {
  const bookingStatus = getBookingStatus(booking);
  if (bookingStatus === 'cancelled') return 'cancelled';
  if (bookingStatus === 'checked_in') {
    if (isInHouseToday({ ...booking, booking_status: bookingStatus }, todayISO)) {
      return 'in-house';
    }
    if (booking.check_in_date > todayISO) return 'upcoming';
    return 'departure';
  }
  if (booking.check_in_date === todayISO) return 'arrival';
  if (booking.check_out_date === todayISO) return 'departure';
  if (booking.check_in_date > todayISO) return 'upcoming';
  if (booking.check_in_date < todayISO && booking.check_out_date > todayISO) return 'in-house';
  return 'upcoming';
}

function normalizeBooking(booking, todayISO) {
  const bookingStatus = getBookingStatus(booking);
  const isCancelled = bookingStatus === 'cancelled';

  return {
    ...booking,
    booking_status: bookingStatus,
    phase_config: isCancelled ? 'cancelled' : computePhaseConfig(booking, todayISO),
    payment_status: isCancelled ? 'cancelled' : (booking.payment_status || 'pending'),
  };
}

function isActiveBooking(booking) {
  return getBookingStatus(booking) !== 'cancelled';
}

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
  const canCheckIn  = booking.booking_status === 'confirmed';
  const canCheckOut = booking.booking_status === 'checked_in' && booking.check_out_date === todayISO;

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

      {booking.booking_status === 'checked_in' && (
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
  const phase = booking.phase_config;

  return (
    <tr className={rowClassName(phase)}>
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
      <td><Badge type="status" value={booking.booking_status} /></td>
      <td>
        <Badge
          type="phase"
          value={phase}
          icon={
            phase === 'arrival'   ? '→' :
            phase === 'departure' ? '←' :
            phase === 'in-house'  ? '✓' : undefined
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
  const { runMutation } = useMutation();
  const [checkingInId,  setCheckingInId]  = useState(null);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const handleCheckIn = async (bookingId) => {
    setCheckingInId(bookingId);
    await runMutation({
      mutation: async () => {
        const res = await fetch(`${BASE_URL}/bookings/${bookingId}/check-in`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Check-in failed');
        }
        return res.json();
      },
      refresh: onRefresh,
      successMessage: 'Guest checked in successfully.',
      overlayMessage: 'Checking in guest…',
    });
    setCheckingInId(null);
  };

  const handleCheckOut = async (bookingId) => {
    setCheckingOutId(bookingId);
    await runMutation({
      mutation: async () => {
        const res = await fetch(`${BASE_URL}/bookings/${bookingId}/check-out`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Check-out failed');
        }
        return res.json();
      },
      refresh: onRefresh,
      successMessage: 'Guest checked out successfully.',
      overlayMessage: 'Checking out guest…',
    });
    setCheckingOutId(null);
  };

  return { checkingInId, checkingOutId, handleCheckIn, handleCheckOut };
}

function useActiveBookings(bookings, todayISO) {
  return useMemo(
    () => bookings
      .filter(isActiveBooking)
      .map(b => normalizeBooking(b, todayISO)),
    [bookings, todayISO],
  );
}

function usePhaseMetrics(activeBookings, todayISO) {
  return useMemo(() => {
    const counts = { arrival: 0, 'in-house': 0, departure: 0, upcoming: 0 };
    for (const booking of activeBookings) {
      if (isInHouseToday(booking, todayISO)) {
        counts['in-house'] += 1;
        continue;
      }
      const phase = booking.phase_config;
      if (phase === 'in-house') continue;
      if (phase && phase !== 'cancelled' && Object.hasOwn(counts, phase)) {
        counts[phase] += 1;
      }
    }
    return counts;
  }, [activeBookings, todayISO]);
}

function useFilteredBookings(activeBookings, smartFilter, todayISO) {
  return useMemo(() => {
    const sevenDaysLater = new Date(todayISO);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterISO = sevenDaysLater.toISOString().split('T')[0];

    if (smartFilter === 'today') {
      return activeBookings.filter(b => {
        const isArrival   = b.check_in_date  === todayISO;
        const isDeparture = b.check_out_date === todayISO;
        const isInHouse   = isInHouseToday(b, todayISO);
        return isArrival || isDeparture || isInHouse;
      });
    }
    if (smartFilter === 'upcoming-7') {
      return activeBookings.filter(b =>
        b.check_in_date > todayISO &&
        b.check_in_date <= sevenDaysLaterISO &&
        !['checked_out', 'cancelled'].includes(b.booking_status),
      );
    }
    return activeBookings;
  }, [activeBookings, todayISO, smartFilter]);
}

function PhaseMetricsCards({ metrics, loading }) {
  return (
    <KpiCardGrid className="kpi-card-grid--four">
      {PHASE_CARD_CONFIG.map(({ key, label, icon }) => (
        <KpiCard
          key={key}
          icon={icon}
          label={label}
          value={metrics[key] ?? 0}
          loading={loading}
        />
      ))}
    </KpiCardGrid>
  );
}

function Overview({ bookings, loading, error, onRefresh }) {
  const [smartFilter, setSmartFilter] = useState('today');
  const [orderModalBooking, setOrderModalBooking] = useState(null);
  const [detailsRow, setDetailsRow] = useState(null);

  const today    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  const { checkingInId, checkingOutId, handleCheckIn, handleCheckOut } = useBookingActions(onRefresh);
  const activeBookings = useActiveBookings(bookings, todayISO);
  const phaseMetrics = usePhaseMetrics(activeBookings, todayISO);
  const filtered = useFilteredBookings(activeBookings, smartFilter, todayISO);

  return (
    <>
      <PhaseMetricsCards metrics={phaseMetrics} loading={loading} />

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
                      guestName: booking.guests?.full_name || 'Walk-in Guest',
                      displayId: booking.display_id,
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <SummaryModal
        isOpen={!!detailsRow}
        bookingId={detailsRow?.bookingId}
        guestName={detailsRow?.guestName}
        displayId={detailsRow?.displayId}
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

export default Overview;