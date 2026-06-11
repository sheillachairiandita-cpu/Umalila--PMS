import React from 'react';
import { Badge, Modal, Card } from '../ui';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

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
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title="Reservation Details"
        onClose={onClose}
      />

      <Modal.Body>

          {/* Guest Information */}
          <div style={{ marginBottom: SPACING.lg }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textTertiary, marginBottom: SPACING.md }}>
              Guest Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Guest Name</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>{guestName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Phone</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>
                  {booking.guests?.phone_number || '—'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: SPACING.lg }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textTertiary, marginBottom: SPACING.md }}>
              Stay Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Check-In</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>{booking.check_in_date}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Check-Out</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>{booking.check_out_date}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Total Nights</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>{nights}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Guests</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>{booking.total_guests}</p>
              </div>
            </div>
          </div>

          {/* Property & Extras */}
          <div style={{ marginBottom: SPACING.lg }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textTertiary, marginBottom: SPACING.md }}>
              Property & Extras
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Units Assigned</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>
                  {booking.villa_names || 'No Units Assigned'}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Breakfasts</p>
                  <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>
                    {booking.total_breakfast || '0'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 4px 0' }}>Extra Beds</p>
                  <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>
                    {booking.extra_bed_qty || '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: SPACING.lg }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textTertiary, marginBottom: SPACING.md }}>
              Status
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 8px 0' }}>Booking Status</p>
                <Badge type="status" value={booking.status} />
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, margin: '0 0 8px 0' }}>Stay Phase</p>
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
            <div style={{ marginBottom: SPACING.lg }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', color: COLORS.textTertiary, marginBottom: SPACING.md }}>
                Notes
              </h3>
              <p style={{
                margin: 0, padding: SPACING.md, backgroundColor: COLORS.slate50, borderRadius: 8,
                fontSize: '0.9rem', color: COLORS.textSecondary, lineHeight: 1.5,
              }}>
                {booking.notes}
              </p>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default ReservationDetailsModal;
