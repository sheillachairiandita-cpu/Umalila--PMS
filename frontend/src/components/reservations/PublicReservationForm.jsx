import React, { useState, useEffect, useMemo } from 'react';
import { User, Home, Info, AlertTriangle, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Alert, Select } from '../ui';
import { COLORS } from '../../styles/theme';
import SubmittingOverlay from '../SubmittingOverlay';
import '../../App.css';

const API = '/api';

function addonPrice(addon) {
  return Number(addon?.price_per_night ?? addon?.price) || 0;
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phoneNumber: '',
  checkInDate: '',
  checkOutDate: '',
  adults: '2',
  children: '0',
  totalGuests: '2',
  totalPrice: 0,
  notes: '',
};

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  fontSize: '0.95rem',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontFamily: 'inherit',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '36px',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const qtyBtnStyle = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: '1rem',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Unified reservation form — public page, admin create modal, or edit modal.
 *
 * @param {'page'|'modal'} variant
 * @param {boolean} isOpen - modal visibility (modal variant only)
 * @param {object|null} booking - when set, edit mode
 */
function PublicReservationForm({
  variant = 'page',
  isOpen = true,
  onClose,
  onSuccess,
  booking = null,
  onSaved,
}) {
  const navigate = useNavigate();
  const isEditMode = Boolean(booking);
  const isModal = variant === 'modal';
  const isCancelled = isEditMode && booking?.status === 'cancelled';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [villas, setVillas] = useState([]);
  const [loadingVillas, setLoadingVillas] = useState(false);
  const [selectedVillaIds, setSelectedVillaIds] = useState([]);
  const [occupiedVillaIds, setOccupiedVillaIds] = useState([]);
  const [blockedVillaIds, setBlockedVillaIds] = useState([]);
  const [blockWarning, setBlockWarning] = useState('');
  const [dateError, setDateError] = useState('');
  const [addons, setAddons] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});
  const [discounts, setDiscounts] = useState([]);
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountId, setDiscountId] = useState('');
  const [cancelMode, setCancelMode] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const checkInDate = formData.checkInDate;
  const checkOutDate = formData.checkOutDate;

  // Load catalog + prefill when modal opens or booking changes
  useEffect(() => {
    if (isModal && !isOpen) return;

    const loadCatalog = async () => {
      setLoadingVillas(true);
      try {
        const requests = [
          fetch(`${API}/villas`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API}/addons`).then((r) => (r.ok ? r.json() : [])),
        ];
        if (isEditMode) {
          requests.push(fetch(`${API}/discounts`).then((r) => (r.ok ? r.json() : [])));
        }
        const [villaData, addonData, discountData] = await Promise.all(requests);
        setVillas(villaData);
        setAddons(addonData);
        if (isEditMode) {
          setDiscounts((discountData || []).filter((d) => d.is_active !== false && d.status !== 'inactive'));
        }
      } catch (err) {
        console.error('Failed to fetch form data:', err);
      } finally {
        setLoadingVillas(false);
      }
    };

    if (isEditMode && booking) {
      setFormData({
        fullName: booking.guests?.full_name || booking.guest_full_name || '',
        email: booking.guests?.email || '',
        phoneNumber: booking.guests?.phone_number || '',
        checkInDate: booking.check_in_date || '',
        checkOutDate: booking.check_out_date || '',
        adults: String(parseInt(booking.notes?.match(/Adults:\s*(\d+)/)?.[1] || booking.total_guests || '2', 10)),
        children: String(parseInt(booking.notes?.match(/Children:\s*(\d+)/)?.[1] || '0', 10)),
        totalGuests: String(booking.total_guests || '2'),
        totalPrice: Number(booking.total_price) || 0,
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
    } else if (!isEditMode && isModal) {
      setFormData({ ...EMPTY_FORM });
      setSelectedVillaIds([]);
      setSelectedAddons({});
      setOccupiedVillaIds([]);
      setBlockedVillaIds([]);
      setBlockWarning('');
      setDateError('');
      setError(null);
    }

    loadCatalog();
  }, [isModal, isOpen, isEditMode, booking]);

  // Availability check (bookings + admin date blocks)
  useEffect(() => {
    if ((isModal && !isOpen) || !checkInDate || !checkOutDate || dateError) return;

    const checkLiveAvailability = async () => {
      try {
        const response = await fetch(
          `${API}/villas/availability?check_in=${checkInDate}&check_out=${checkOutDate}`
        );
        if (!response.ok) return;
        const data = await response.json();
        const occupied = data.occupiedVillaIds || [];
        const blocked = data.blockedVillaIds || [];
        setOccupiedVillaIds(occupied);
        setBlockedVillaIds(blocked);

        const blockedNames = villas
          .filter((v) => blocked.includes(v.id))
          .map((v) => v.name);

        if (blockedNames.length > 0) {
          setBlockWarning(
            `The following villas are unavailable for ${checkInDate} to ${checkOutDate} due to scheduled blocks: ${blockedNames.join(', ')}.`
          );
        } else {
          setBlockWarning('');
        }

        setSelectedVillaIds((prev) =>
          prev.filter((id) => {
            if (blocked.includes(id)) return false;
            const isOriginallyAssigned = isEditMode && (booking?.booking_villas || []).some(
              (row) => (row.villa_id || row.villas?.id) === id
            );
            if (isOriginallyAssigned) return true;
            return !occupied.includes(id);
          })
        );
      } catch (err) {
        console.error('Availability check error:', err);
      }
    };

    checkLiveAvailability();
  }, [checkInDate, checkOutDate, dateError, isModal, isOpen, isEditMode, booking, villas]);

  // Date validation & pricing
  useEffect(() => {
    if (!checkInDate || !checkOutDate) return;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
      setDateError('⚠️ Checkout date must occur after the check-in timeline.');
      setFormData((prev) => ({ ...prev, totalPrice: 0 }));
      return;
    }

    setDateError('');
    const totalNights = Math.ceil((checkOut - checkIn) / (1000 * 3600 * 24));

    const villaRate = villas
      .filter((v) => selectedVillaIds.includes(v.id))
      .reduce((sum, v) => sum + (Number(v.base_rate_per_night) || 0), 0);

    const addonRate = addons.reduce((sum, addon) => {
      const qty = selectedAddons[addon.id] || 0;
      if (!qty) return sum;
      const unit = addonPrice(addon);
      const multiplier = addon.is_per_night !== false ? totalNights : 1;
      return sum + unit * qty * multiplier;
    }, 0);

    setFormData((prev) => ({
      ...prev,
      totalPrice: totalNights * villaRate + addonRate,
    }));
  }, [checkInDate, checkOutDate, selectedVillaIds, selectedAddons, villas, addons]);

  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate || dateError) return 0;
    return Math.max(
      0,
      Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 3600 * 24))
    );
  }, [checkInDate, checkOutDate, dateError]);

  const selectedDiscount = discounts.find((d) => d.id === discountId);
  const guestName = formData.fullName || booking?.guests?.full_name || booking?.guest_full_name;

  if (isModal && !isOpen) return null;
  if (isEditMode && !booking) return null;

  const isOriginallyAssignedVilla = (villaId) =>
    isEditMode && (booking?.booking_villas || []).some(
      (row) => (row.villa_id || row.villas?.id) === villaId
    );

  const handleVillaCheckboxChange = (villaId) => {
    if (
      cancelMode
      || occupiedVillaIds.includes(villaId)
      || blockedVillaIds.includes(villaId)
    ) return;
    setSelectedVillaIds((prev) =>
      prev.includes(villaId) ? prev.filter((id) => id !== villaId) : [...prev, villaId]
    );
  };

  const validateBlockConflicts = () => {
    const conflictIds = selectedVillaIds.filter((id) => blockedVillaIds.includes(id));
    if (conflictIds.length === 0) return true;

    const conflictNames = villas
      .filter((v) => conflictIds.includes(v.id))
      .map((v) => v.name)
      .join(', ');

    setError(
      `${conflictNames} ${conflictIds.length === 1 ? 'is' : 'are'} unavailable for the selected dates due to a scheduled block. Please choose different dates or accommodations.`
    );
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateError || isCancelled) return;

    if (isEditMode && cancelMode) {
      if (!cancellationReason.trim()) {
        setError('Cancellation reason is required.');
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await fetch(`${API}/bookings/${booking.id}/cancel`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellation_reason: cancellationReason.trim() }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to cancel reservation');
        }
        onSaved?.();
        onClose?.();
      } catch (err) {
        setError(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isEditMode) {
      if (selectedVillaIds.length === 0) {
        setError('Select at least one villa.');
        return;
      }
      if (!validateBlockConflicts()) return;
      if (applyDiscount && !discountId) {
        setError('Select a discount to apply.');
        return;
      }

      const selected_addons = Object.entries(selectedAddons)
        .filter(([, qty]) => qty > 0)
        .map(([addon_id, quantity]) => ({ addon_id, quantity }));

      setIsSubmitting(true);
      setError(null);
      try {
        const response = await fetch(`${API}/bookings/${booking.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            total_guests: parseInt(formData.totalGuests, 10) || booking.total_guests,
            notes: formData.notes,
            villa_ids: selectedVillaIds,
            selected_addons,
            apply_discount: applyDiscount,
            discount_id: applyDiscount ? discountId : null,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update reservation');
        }
        onSaved?.();
        onClose?.();
      } catch (err) {
        setError(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Create flow
    if (selectedVillaIds.length === 0) {
      setError('Select at least one villa.');
      return;
    }
    if (!validateBlockConflicts()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const guestResponse = await fetch(`${API}/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName,
          email: formData.email,
          phone_number: formData.phoneNumber,
        }),
      });
      if (!guestResponse.ok) throw new Error('Failed to create guest record.');
      const newGuest = await guestResponse.json();

      const selected_addons = Object.entries(selectedAddons)
        .filter(([, qty]) => qty > 0)
        .map(([addon_id, quantity]) => ({ addon_id, quantity }));

      const totalGuests =
        parseInt(formData.adults || 0, 10) + parseInt(formData.children || 0, 10);
      const notesWithGuests =
        `Adults: ${formData.adults}, Children: ${formData.children}` +
        (formData.notes ? `\n${formData.notes}` : '');

      const bookingResponse = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villa_ids: selectedVillaIds,
          guest_id: newGuest.id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          total_guests: totalGuests,
          total_price: formData.totalPrice,
          notes: notesWithGuests,
          selected_addons,
        }),
      });

      const data = await bookingResponse.json();
      if (bookingResponse.status === 409) {
        setError(`Booking denied: ${data.error}`);
        return;
      }
      if (!bookingResponse.ok) throw new Error(data.error || 'Failed to save booking.');

      setSelectedVillaIds([]);
      if (isModal) {
        onSuccess?.();
        onClose?.();
      } else {
        navigate('/success');
      }
    } catch (err) {
      console.error('Booking error:', err.message);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formTitle = isEditMode
    ? 'Edit Reservation'
    : isModal
      ? 'Book New Reservation'
      : 'New Reservation';

  const submitLabel = isEditMode
    ? (cancelMode ? 'Confirm Cancellation' : 'Save Changes')
    : isModal
      ? 'Confirm & Save Reservation'
      : 'Submit Reservation Request';

  const formBody = (
    <form onSubmit={handleSubmit} className="modal-form">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {isCancelled ? (
        <Alert
          type="warning"
          title="Cancelled Booking"
          message="This reservation has been cancelled and can no longer be edited."
        />
      ) : (
        <>
          {!isEditMode && (
            <div className="form-section">
              <h4><User size={14} /> Guest Profile Details</h4>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62..."
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {isEditMode && guestName && (
            <div className="form-section">
              <h4><User size={14} /> Guest</h4>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{guestName}</p>
              {formData.phoneNumber && (
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>{formData.phoneNumber}</p>
              )}
            </div>
          )}

          <div className="form-section">
            <h4><Home size={14} /> Room Selection & Pricing</h4>

            <div className="form-row">
              <div className="form-group">
                <label>Check In</label>
                <input
                  type="date"
                  required
                  value={checkInDate}
                  disabled={cancelMode}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Check Out</label>
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  disabled={cancelMode}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                />
              </div>
            </div>

            {dateError && <div className="date-error-banner">{dateError}</div>}
            {blockWarning && !dateError && (
              <div className="date-error-banner">{blockWarning}</div>
            )}

            {!isEditMode ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Number of Adults</label>
                  <select
                    value={formData.adults}
                    onChange={(e) => setFormData({ ...formData, adults: e.target.value })}
                    style={selectStyle}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>{n} Adult{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Number of Children</label>
                  <select
                    value={formData.children}
                    onChange={(e) => setFormData({ ...formData, children: e.target.value })}
                    style={selectStyle}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'Child' : 'Children'}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>Total Guests</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.totalGuests}
                  disabled={cancelMode}
                  onChange={(e) => setFormData({ ...formData, totalGuests: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label style={{ marginBottom: '6px' }}>
                Assigned Property Units (Select one or more)
              </label>
              <div className="checkbox-grid">
                {loadingVillas ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Syncing property portfolio…</span>
                ) : villas.length === 0 ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>No properties found in database</span>
                ) : (
                  villas.map((villa) => {
                    const isOccupied = occupiedVillaIds.includes(villa.id);
                    const isBlocked = blockedVillaIds.includes(villa.id);
                    const isOriginallyAssigned = isOriginallyAssignedVilla(villa.id);
                    const isUnavailable = isBlocked || (isOccupied && !isOriginallyAssigned);
                    const rowClass = [
                      'checkbox-row',
                      isUnavailable ? 'disabled-row' : '',
                      isBlocked ? 'disabled-row--blocked' : '',
                    ].filter(Boolean).join(' ');

                    return (
                      <div key={villa.id} className={rowClass}>
                        <input
                          type="checkbox"
                          id={`villa-${villa.id}-${isEditMode ? 'edit' : 'new'}`}
                          checked={selectedVillaIds.includes(villa.id)}
                          disabled={cancelMode || isUnavailable}
                          onChange={() => handleVillaCheckboxChange(villa.id)}
                        />
                        <label htmlFor={`villa-${villa.id}-${isEditMode ? 'edit' : 'new'}`} className="checkbox-text">
                          <span>
                            {villa.name}
                            {isBlocked && (
                              <small className="villa-unavailable-tag">(Dates blocked)</small>
                            )}
                            {isOccupied && !isBlocked && !isOriginallyAssigned && (
                              <small className="villa-unavailable-tag">(Unavailable)</small>
                            )}
                          </span>
                          <span className="villa-rate">
                            Rp {Number(villa.base_rate_per_night || 0).toLocaleString('id-ID')}/night
                          </span>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {addons.length > 0 && (
              <div className="form-group">
                <label style={{ marginBottom: '6px' }}>Add-ons</label>
                <div className="checkbox-grid">
                  {addons.map((addon) => (
                    <div key={addon.id} className="checkbox-row" style={{ justifyContent: 'space-between' }}>
                      <label className="checkbox-text" style={{ flex: 1 }}>
                        <span>{addon.name}</span>
                        <span className="villa-rate">
                          Rp {addonPrice(addon).toLocaleString('id-ID')}
                          {addon.is_per_night !== false ? '/night' : ' one-time'}
                        </span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                        <button
                          type="button"
                          style={qtyBtnStyle}
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
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 500 }}>
                          {selectedAddons[addon.id] || 0}
                        </span>
                        <button
                          type="button"
                          style={qtyBtnStyle}
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
              </div>
            )}

            {isEditMode && (
              <div
                style={{
                  padding: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <label className="checkbox-text" style={{ cursor: cancelMode ? 'not-allowed' : 'pointer' }}>
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
                  <span style={{ fontWeight: 600 }}>Apply promotional discount</span>
                </label>
                {applyDiscount && (
                  <div style={{ marginTop: 10 }}>
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
                  </div>
                )}
                {applyDiscount && selectedDiscount?.application_rule === 'highest_priced_single' && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                    This discount applies its percentage to the highest-priced villa only.
                  </p>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Duration</label>
                <input
                  type="text"
                  readOnly
                  value={nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : '—'}
                  style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                />
              </div>
              <div className="form-group">
                <label>Estimated Total (IDR)</label>
                <input
                  type="text"
                  readOnly
                  value={`Rp ${formData.totalPrice.toLocaleString('id-ID')}`}
                  style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#0f172a' }}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4><Info size={14} /> {isEditMode ? 'Notes' : 'Special Requests & Notes'}</h4>
            <div className="form-group">
              <textarea
                placeholder={
                  isEditMode
                    ? 'Internal notes about this reservation…'
                    : 'Early check-in, dietary requirements, special occasions…'
                }
                rows="3"
                value={formData.notes}
                disabled={cancelMode}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          {isEditMode && (
            <div className="edit-reservation-cancel-section">
              <label className="cancel-toggle">
                <input
                  type="checkbox"
                  checked={cancelMode}
                  onChange={(e) => {
                    setCancelMode(e.target.checked);
                    setError(null);
                  }}
                />
                <AlertTriangle size={14} />
                Cancel this reservation
              </label>
              {cancelMode && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Cancellation Reason</label>
                  <textarea
                    placeholder="Explain why this booking is being cancelled…"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    rows={3}
                    required
                  />
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, marginBottom: 0 }}>
                    Status and payment status will be set to cancelled.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isEditMode && !isModal && (
            <p style={{ fontSize: '0.78rem', color: COLORS.textTertiary, margin: '-4px 0 8px', lineHeight: 1.5 }}>
              No payment required now. Our team will confirm availability and send an invoice within 24 hours.
            </p>
          )}

          {isModal ? (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
                Close
              </Button>
              <Button
                type="submit"
                variant={cancelMode ? 'danger' : 'primary'}
                loading={isSubmitting}
                disabled={!!dateError || isCancelled}
              >
                {submitLabel}
              </Button>
            </div>
          ) : (
            <Button type="submit" variant="primary" fullWidth size="md" disabled={!!dateError}>
              {submitLabel}
            </Button>
          )}
        </>
      )}
    </form>
  );

  if (isModal) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        {isSubmitting && <SubmittingOverlay />}
        <Modal.Header
          title={formTitle}
          icon={isEditMode ? Pencil : undefined}
          subtitle={isEditMode ? guestName : undefined}
          onClose={onClose}
        />
        <Modal.Body>{formBody}</Modal.Body>
      </Modal>
    );
  }

  return (
    <div className="public-reservation-page">
      <aside className="public-welcome-panel">
        <div className="public-welcome-inner">
          <div className="public-brand">
            <span className="public-brand-name">Umalila</span>
            <span className="public-brand-sub">Alahan Panjang</span>
          </div>
          <div className="public-welcome-copy">
            <h1 className="public-welcome-title">Book Your Highland Stay</h1>
            <p className="public-welcome-desc">
              Perched at 1,400 m in the Minangkabau highlands, Umalila offers
              private villas with panoramic lake views, farm-to-table dining,
              and unhurried highland living.
            </p>
          </div>
          <ul className="public-feature-list">
            {['Mountain-view private villas', 'English garden', 'Daily breakfast included'].map((f) => (
              <li key={f} className="public-feature-item">
                <span className="public-feature-dot" />
                {f}
              </li>
            ))}
          </ul>
          <div className="public-welcome-meta">1°30′S · 100°28′E · 1,400 m elevation</div>
        </div>
      </aside>

      <main className="public-form-panel">
        <div className="modal-card public-form-card" style={{ position: 'relative' }}>
          {isSubmitting && <SubmittingOverlay />}
          <div className="modal-header">
            <h2>{formTitle}</h2>
          </div>
          {formBody}
        </div>
      </main>
    </div>
  );
}

export default PublicReservationForm;
