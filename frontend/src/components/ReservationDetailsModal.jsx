import React from 'react';
import { X } from 'lucide-react';
import Badge from './ui/Badge';

// ============================================
// DETAILS MODAL - Shows full reservation info
// ============================================
function ReservationDetailsModal({ isOpen, booking, onClose }) {
  if (!isOpen || !booking) return null;

  const guestName = booking.guests?.full_name || 'Unknown Guest';

  const nights = Math.ceil(
    (new Date(booking.check_out_date) - new Date(booking.check_in_date)) / (1000 * 3600 * 24)
  );

  return (
    <>
      {/* Modal Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 999,
        }}
      />

      {/* Modal Card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#fff', borderRadius: 12,
        boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
        zIndex: 1000, maxHeight: '90vh', overflow: 'auto',
        width: '90%', maxWidth: 600,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 20, borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
            Reservation Details
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>

          {/* Guest Information */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
              Guest Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Guest Name</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>{guestName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Phone</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                  {booking.guests?.phone_number || '—'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
              Stay Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Check-In</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>{booking.check_in_date}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Check-Out</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>{booking.check_out_date}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Total Nights</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>{nights}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Guests</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>{booking.total_guests}</p>
              </div>
            </div>
          </div>

          {/* Property & Extras */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
              Property & Extras
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Units Assigned</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                  {booking.villa_names || 'No Units Assigned'}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Breakfasts</p>
                  <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                    {booking.total_breakfast || '0'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Extra Beds</p>
                  <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                    {booking.extra_bed_qty || '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
              Status
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 8px 0' }}>Booking Status</p>
                <Badge type="status" value={booking.status} />
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 8px 0' }}>Stay Phase</p>
                <Badge
                  type="phase"
                  value={booking.stay_phase}
                  icon={
                    booking.stay_phase === 'arrival' ? '→' :
                    booking.stay_phase === 'departure' ? '←' : undefined
                  }
                />
              </div>
            </div>
          </div>

          {booking.notes && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
                Notes
              </h3>
              <p style={{
                margin: 0, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8,
                fontSize: '0.9rem', color: '#475569', lineHeight: 1.5,
              }}>
                {booking.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ReservationDetailsModal;
