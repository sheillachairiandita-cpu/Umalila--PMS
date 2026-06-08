import React, { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal, Button, Input, Textarea, Alert, Select } from './ui';
import { COLORS, SPACING } from '../styles/theme';

function EditReservationModal({ isOpen, booking, onClose, onSaved }) {
  const [form, setForm] = useState({
    check_in_date: '',
    check_out_date: '',
    total_guests: '',
    notes: '',
  });
  const [villas, setVillas] = useState([]);
  const [addons, setAddons] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [selectedVillaIds, setSelectedVillaIds] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountId, setDiscountId] = useState('');
  const [occupiedVillaIds, setOccupiedVillaIds] = useState([]);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !booking) return;

    setForm({
      check_in_date: booking.check_in_date || '',
      check_out_date: booking.check_out_date || '',
      total_guests: String(booking.total_guests || ''),
      notes: booking.notes || '',
    });
    setSelectedVillaIds(
      (booking.booking_villas || [])
        .map((row) => row.villa_id || row.villas?.id)
        .filter(Boolean)
    );
    const addonMap = {};
    (booking.booking_addons || []).forEach((row) => {
      const id = row.addon_id || row.addons?.id;
      if (id) addonMap[id] = row.quantity || 1;
    });
    setSelectedAddons(addonMap);
    setApplyDiscount(!!booking.discount_id);
    setDiscountId(booking.discount_id || booking.discounts?.id || '');
    setCancelMode(false);
    setCancellationReason('');
    setError(null);

    Promise.all([
      fetch('/api/villas').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/addons').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/discounts').then((r) => (r.ok ? r.json() : [])),
    ]).then(([villaData, addonData, discountData]) => {
      setVillas(villaData);
      setAddons(addonData);
      setDiscounts((discountData || []).filter((d) => d.is_active !== false && d.status !== 'inactive'));
    }).catch(() => {});
  }, [isOpen, booking]);

  useEffect(() => {
    if (!isOpen || !form.check_in_date || !form.check_out_date) return;
    fetch(`/api/villas/availability?check_in=${form.check_in_date}&check_out=${form.check_out_date}`)
      .then((r) => (r.ok ? r.json() : { occupiedVillaIds: [] }))
      .then((data) => {
        const occupied = (data.occupiedVillaIds || []).filter(
          (id) => !(booking.booking_villas || []).some((row) => (row.villa_id || row.villas?.id) === id)
        );
        setOccupiedVillaIds(occupied);
      })
      .catch(() => setOccupiedVillaIds([]));
  }, [isOpen, form.check_in_date, form.check_out_date, booking]);

  const estimatedTotal = useMemo(() => {
    if (!form.check_in_date || !form.check_out_date) return 0;
    const nights = Math.max(
      Math.ceil((new Date(form.check_out_date) - new Date(form.check_in_date)) / (1000 * 60 * 60 * 24)),
      1
    );
    const villaRate = villas
      .filter((v) => selectedVillaIds.includes(v.id))
      .reduce((sum, v) => sum + (Number(v.base_rate_per_night) || 0), 0);
    const addonRate = addons.reduce((sum, addon) => {
      const qty = selectedAddons[addon.id] || 0;
      if (!qty) return sum;
      const unit = Number(addon.price_per_night) || Number(addon.price) || 0;
      const multiplier = addon.is_per_night !== false ? nights : 1;
      return sum + unit * qty * multiplier;
    }, 0);
    return nights * villaRate + addonRate;
  }, [form.check_in_date, form.check_out_date, selectedVillaIds, selectedAddons, villas, addons]);

  if (!isOpen || !booking) return null;

  const isCancelled = booking.status === 'cancelled';
  const selectedDiscount = discounts.find((d) => d.id === discountId);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const toggleVilla = (villaId) => {
    if (occupiedVillaIds.includes(villaId)) return;
    setSelectedVillaIds((prev) =>
      prev.includes(villaId) ? prev.filter((id) => id !== villaId) : [...prev, villaId]
    );
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
    if (selectedVillaIds.length === 0) {
      setError('Select at least one villa.');
      return;
    }
    if (applyDiscount && !discountId) {
      setError('Select a discount to apply.');
      return;
    }

    const selected_addons = Object.entries(selectedAddons)
      .filter(([, qty]) => qty > 0)
      .map(([addon_id, quantity]) => ({ addon_id, quantity }));

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
          villa_ids: selectedVillaIds,
          selected_addons,
          apply_discount: applyDiscount,
          discount_id: applyDiscount ? discountId : null,
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
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

            <div style={{ marginBottom: SPACING.lg }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: COLORS.textSecondary, marginBottom: SPACING.sm }}>
                Villa Units
              </p>
              <div className="checkbox-list">
                {villas.map((villa) => {
                  const isBooked = occupiedVillaIds.includes(villa.id);
                  return (
                    <div key={villa.id} className={`checkbox-row ${isBooked ? 'disabled-row' : ''}`}>
                      <input
                        type="checkbox"
                        id={`edit-villa-${villa.id}`}
                        checked={selectedVillaIds.includes(villa.id)}
                        disabled={cancelMode || isBooked}
                        onChange={() => toggleVilla(villa.id)}
                      />
                      <label htmlFor={`edit-villa-${villa.id}`} className="checkbox-text">
                        <span>
                          {villa.name}
                          {isBooked && (
                            <small style={{ color: '#ef4444', fontStyle: 'italic', marginLeft: '6px' }}>
                              (Unavailable)
                            </small>
                          )}
                        </span>
                        <span className="villa-rate">
                          Rp {Number(villa.base_rate_per_night || 0).toLocaleString('id-ID')}/night
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: SPACING.lg }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: COLORS.textSecondary, marginBottom: SPACING.sm }}>
                Add-ons
              </p>
              {addons.map((addon) => (
                <div key={addon.id} className="checkbox-row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <span>{addon.name}</span>
                    <span className="villa-rate">
                      Rp {Number(addon.price_per_night || addon.price || 0).toLocaleString('id-ID')}
                      {addon.is_per_night !== false ? '/night' : ' one-time'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="qty-btn"
                      disabled={cancelMode}
                      onClick={() =>
                        setSelectedAddons((prev) => ({
                          ...prev,
                          [addon.id]: Math.max(0, (prev[addon.id] || 0) - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <span>{selectedAddons[addon.id] || 0}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      disabled={cancelMode}
                      onClick={() =>
                        setSelectedAddons((prev) => ({
                          ...prev,
                          [addon.id]: (prev[addon.id] || 0) + 1,
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginBottom: SPACING.lg,
                padding: SPACING.md,
                background: COLORS.bgLight,
                border: `1px solid ${COLORS.slate200}`,
                borderRadius: '8px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  cursor: cancelMode ? 'not-allowed' : 'pointer',
                  marginBottom: applyDiscount ? SPACING.md : 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={applyDiscount}
                  disabled={cancelMode}
                  onChange={(e) => {
                    setApplyDiscount(e.target.checked);
                    if (!e.target.checked) setDiscountId('');
                    else if (discounts.length === 1) setDiscountId(discounts[0].id);
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Apply promotional discount</span>
              </label>

              {applyDiscount && (
                <Select
                  label="Discount Code"
                  value={discountId}
                  onChange={(e) => setDiscountId(e.target.value)}
                  disabled={cancelMode}
                  placeholder="Select a discount…"
                  options={discounts.map((d) => ({
                    value: d.id,
                    label: `${d.promo_code || d.code} — ${d.name} (${d.type === 'percentage' ? `${d.value}%` : `Rp ${Number(d.value).toLocaleString('id-ID')}`})`,
                  }))}
                />
              )}

              {applyDiscount && selectedDiscount?.application_rule === 'highest_priced_single' && (
                <p style={{ fontSize: '0.75rem', color: COLORS.textTertiary, marginTop: SPACING.sm, marginBottom: 0 }}>
                  This discount applies its percentage to the highest-priced villa in this reservation only.
                </p>
              )}
            </div>

            <Textarea
              label="Notes"
              placeholder="Internal notes about this reservation…"
              value={form.notes}
              onChange={handleChange('notes')}
              disabled={cancelMode}
              rows={3}
              style={{ marginBottom: SPACING.lg }}
            />

            {!cancelMode && estimatedTotal > 0 && (
              <p style={{ fontSize: '0.82rem', color: COLORS.textSecondary, marginBottom: SPACING.lg }}>
                Estimated pre-discount total: <strong>Rp {estimatedTotal.toLocaleString('id-ID')}</strong>
                {applyDiscount ? ' (discount calculated on save)' : ''}
              </p>
            )}

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
