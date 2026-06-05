import React, { useState, useMemo } from 'react';
import { RefreshCw, ClipboardList, ArrowUpRight, DollarSign, LogIn, LogOut } from 'lucide-react';
import { Badge, Button } from './ui';
import FilterButtonGroup from './ui/FilterButtonGroup';
import { COLORS } from '../styles/theme';
import OrderModal from './OrderModal';
import FinancialSummaryModal from './FinancialSummaryModal';

const FILTER_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming-7', label: 'Next 7 Days' },
  { key: 'all-phases', label: 'All' },
];

function OperationsTable({ bookings, loading, error, onRefresh }) {
  const [smartFilter, setSmartFilter] = useState('today');
  const [orderModalBooking, setOrderModalBooking] = useState(null);
  const [financialModalBooking, setFinancialModalBooking] = useState(null);
  const [checkingInId, setCheckingInId] = useState(null);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  const handleCheckIn = async (bookingId) => {
    setCheckingInId(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Check-in failed');
      onRefresh(); // Refresh bookings to update status
    } catch (err) {
      alert('Error checking in: ' + err.message);
    } finally {
      setCheckingInId(null);
    }
  };

  const handleCheckOut = async (bookingId) => {
    setCheckingOutId(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Check-out failed');
      onRefresh(); // Refresh bookings to update status
    } catch (err) {
      alert('Error checking out: ' + err.message);
    } finally {
      setCheckingOutId(null);
    }
  };

  const filtered = useMemo(() => {
    const now = new Date(todayISO);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterISO = sevenDaysLater.toISOString().split('T')[0];

    if (smartFilter === 'today') {
      return bookings.filter(b => {
        const isArrival   = b.check_in_date === todayISO;
        const isDeparture = b.check_out_date === todayISO;
        const isInHouse   = b.check_in_date <= todayISO && b.check_out_date > todayISO;
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

  return (
    <>
      <main className="data-section">
        <div className="section-title" style={{ padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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
              <FilterButtonGroup
                options={FILTER_OPTIONS}
                active={smartFilter}
                onChange={setSmartFilter}
              />
              <button
                onClick={onRefresh}
                title="Refresh"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
              >
                <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading reservations...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: '#ef4444' }}>⚠️ {error}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No reservations match this filter.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pms-table">
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
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr
                    key={booking.id}
                    style={{
                      background:
                        booking.stay_phase === 'arrival'
                          ? 'rgba(224,242,254,0.3)'
                          : booking.stay_phase === 'departure'
                          ? 'rgba(254,243,199,0.3)'
                          : 'transparent',
                    }}
                  >
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
                    <td style={{ textAlign: 'center' }}>
                      {booking.total_breakfast > 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: '50%',
                          background: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '0.8rem',
                        }}>
                          {booking.total_breakfast}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {booking.extra_bed_qty > 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: '50%',
                          background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '0.8rem',
                        }}>
                          {booking.extra_bed_qty}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      <Badge
                        type="payment"
                        value={booking.payment_status || 'pending'}
                      />
                    </td>

                    <td>
                      <Badge type="status" value={booking.status} />
                    </td>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* View button */}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ArrowUpRight}
                          title="View reservation"
                          onClick={() => alert(`Actions for booking ${booking.id} — TBD`)}
                        >
                          View
                        </Button>

                        {/* Payment button */}
                        <Button
                          variant="success"
                          size="sm"
                          icon={DollarSign}
                          title="View financial summary"
                          onClick={() => setFinancialModalBooking(booking)}
                        >
                          Payment
                        </Button>

                        {/* Check-in button */}
                        {booking.status === 'confirmed' && booking.stay_phase !== 'upcoming' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={LogIn}
                            title="Check in guest"
                            onClick={() => handleCheckIn(booking.id)}
                            disabled={checkingInId === booking.id}
                            loading={checkingInId === booking.id}
                          >
                            Check In
                          </Button>
                        )}

                        {/* Check-out button */}
                        {booking.status === 'checked_in' && booking.check_out_date <= todayISO && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={LogOut}
                            title="Check out guest"
                            onClick={() => handleCheckOut(booking.id)}
                            disabled={checkingOutId === booking.id}
                            loading={checkingOutId === booking.id}
                            style={{ borderColor: COLORS.warning, color: COLORS.warning }}
                          >
                            Check Out
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Order Modal */}
      <OrderModal
        isOpen={!!orderModalBooking}
        booking={orderModalBooking}
        onClose={() => setOrderModalBooking(null)}
        onOrderSaved={() => {
          onRefresh();          // refresh bookings so order_total updates in table
        }}
      />

      {/* Financial Summary Modal */}
      <FinancialSummaryModal
        isOpen={!!financialModalBooking}
        booking={financialModalBooking}
        onClose={() => setFinancialModalBooking(null)}
        onPaymentRecorded={() => {
          onRefresh();          // refresh bookings to update payment status
        }}
      />
    </>
  );
}

export default OperationsTable;
