import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal, Button, Input, Textarea, Alert } from './ui';
import { COLORS, SPACING } from '../styles/theme';
function EditReservationModal({ isOpen, booking, onClose, onSaved }) {
  const [form, setForm] = useState({
    check_in_date: '',
    check_out_date: '',
    total_guests: '',
    notes: '',
  });
  const [cancelMode, setCancelMode] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && booking) {
      setForm({
        check_in_date: booking.check_in_date || '',
        check_out_date: booking.check_out_date || '',
        total_guests: String(booking.total_guests || ''),
        notes: booking.notes || '',
      });
      setCancelMode(false);
      setCancellationReason('');
      setError(null);
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  const isCancelled = booking.status === 'cancelled';

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (cancelMode) {
      if (!cancellationReason.trim()) {
        setError('Cancellation reason is required.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellation_reason: cancellationReason.trim() }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to cancel reservation');
        }
        onSaved?.();
        onClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!form.check_in_date || !form.check_out_date) {
      setError('Check-in and check-out dates are required.');
      return;
    }
    if (new Date(form.check_out_date) <= new Date(form.check_in_date)) {
      setError('Check-out must be after check-in.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_in_date: form.check_in_date,
          check_out_date: form.check_out_date,
          total_guests: parseInt(form.total_guests, 10) || booking.total_guests,
          notes: form.notes,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update reservation');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title="Edit Reservation"
        icon={Pencil}
        subtitle={booking.guest_full_name || booking.guests?.full_name}
        onClose={onClose}
      />

      <Modal.Body>
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {isCancelled ? (
          <Alert
            type="warning"
            title="Cancelled Booking"
            message="This reservation has been cancelled and can no longer be edited."
          />
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: SPACING.md,
                marginBottom: SPACING.lg,
              }}
            >
              <Input
                label="Check-In"
                type="date"
                value={form.check_in_date}
                onChange={handleChange('check_in_date')}
                disabled={cancelMode}
                required
              />
              <Input
                label="Check-Out"
                type="date"
                value={form.check_out_date}
                onChange={handleChange('check_out_date')}
                disabled={cancelMode}
                required
              />
            </div>

            <Input
              label="Total Guests"
              type="number"
              min="1"
              value={form.total_guests}
              onChange={handleChange('total_guests')}
              disabled={cancelMode}
              style={{ marginBottom: SPACING.lg }}
            />

            <Textarea
              label="Notes"
              placeholder="Internal notes about this reservation…"
              value={form.notes}
              onChange={handleChange('notes')}
              disabled={cancelMode}
              rows={3}
              style={{ marginBottom: SPACING.lg }}
            />

            <div
              style={{
                borderTop: `1px solid ${COLORS.slate200}`,
                paddingTop: SPACING.lg,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  cursor: 'pointer',
                  marginBottom: cancelMode ? SPACING.md : 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={cancelMode}
                  onChange={(e) => {
                    setCancelMode(e.target.checked);
                    setError(null);
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: COLORS.dangerText }}>
                  Cancel this reservation
                </span>
              </label>

              {cancelMode && (
                <Textarea
                  label="Cancellation Reason"
                  placeholder="Explain why this booking is being cancelled…"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  required
                  rows={3}
                  helpText="This reason will be recorded in the booking notes."
                />
              )}
            </div>
          </>
        )}
      </Modal.Body>

      {!isCancelled && (
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button
            variant={cancelMode ? 'danger' : 'primary'}
            onClick={handleSave}
            loading={submitting}
          >
            {cancelMode ? 'Confirm Cancellation' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

export default EditReservationModal;
