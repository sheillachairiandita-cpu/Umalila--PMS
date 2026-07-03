import React, { useState, useEffect, useMemo } from 'react';
import { User, Home, Info, AlertTriangle, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n/publicI18n';
import PublicLanguageSwitcher from '../../i18n/PublicLanguageSwitcher';
import { Button, Modal, Alert, Select } from '../ui';
import { COLORS } from '../../styles/theme';
import SubmittingOverlay from '../SubmittingOverlay';
import { useNotification } from '../../context/NotificationProvider';
import { parseCancellationReason, toProperCaseName } from '../../utils/bookingUtils';
import {
  computeStayRateBreakdown,
  formatPropertyRateForDates,
} from '../../utils/propertyRateUtils';
import umalilaLogo from '../../assets/Umalila-w.svg';
import '../../App.css';

import { formatRp } from '../../utils/formatCurrency';
import { apiFetch, apiJson } from '../../api/client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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

function RequiredLabel({ children }) {
  return (
    <label>
      {children}
      <span style={{ color: '#dc2626', marginLeft: 2 }} aria-hidden="true">*</span>
    </label>
  );
}

function formatMetaValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function getBookingManageToken(booking) {
  if (!booking?.id) return null;
  return booking.manage_token
    || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`booking_token_${booking.id}`) : null);
}

function bookingTokenQuery(booking) {
  const token = getBookingManageToken(booking);
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notify = useNotification();
  const isEditMode = Boolean(booking);
  const isModal = variant === 'modal';
  const isPublicPage = !isModal && !isEditMode;
  const isCancelled = isEditMode && booking?.status === 'cancelled';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState([]);
  const [occupiedPropertyIds, setOccupiedPropertyIds] = useState([]);
  const [blockedPropertyIds, setBlockedPropertyIds] = useState([]);
  const [blockWarning, setBlockWarning] = useState('');
  const [dateError, setDateError] = useState('');
  const [addons, setAddons] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});
  const [discounts, setDiscounts] = useState([]);
  const [pricingHolidays, setPricingHolidays] = useState([]);
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
      setLoadingProperties(true);
      try {
        const requests = [
          apiFetch('/properties').then((r) => (r.ok ? r.json() : [])),
          apiFetch('/addons').then((r) => (r.ok ? r.json() : [])),
          apiFetch('/pricing/holidays').then((r) => (r.ok ? r.json() : [])),
        ];
        if (isEditMode) {
          requests.push(apiFetch('/discounts').then((r) => (r.ok ? r.json() : [])));
        }
        const [propertyData, addonData, holidayData, discountData] = await Promise.all(requests);
        setProperties(propertyData);
        setAddons(addonData);
        setPricingHolidays(holidayData || []);
        if (isEditMode) {
          setDiscounts((discountData || []).filter((d) => d.status === 'active'));
        }
      } catch (err) {
        console.error('Failed to fetch form data:', err);
      } finally {
        setLoadingProperties(false);
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
      setSelectedPropertyIds(
        (booking.booking_properties || [])
          .map((row) => row.property_id || row.properties?.id)
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
      setSelectedPropertyIds([]);
      setSelectedAddons({});
      setOccupiedPropertyIds([]);
      setBlockedPropertyIds([]);
      setBlockWarning('');
      setDateError('');
      setError(null);
    }

    loadCatalog();
  }, [isModal, isOpen, isEditMode, booking]);

  const debouncedCheckIn = useDebouncedValue(checkInDate, 400);
  const debouncedCheckOut = useDebouncedValue(checkOutDate, 400);

  // Availability check (bookings + admin date blocks)
  useEffect(() => {
    if ((isModal && !isOpen) || !debouncedCheckIn || !debouncedCheckOut || dateError) return;

    const checkLiveAvailability = async () => {
      try {
        const response = await apiFetch(
          `/properties/availability?check_in=${debouncedCheckIn}&check_out=${debouncedCheckOut}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        const occupied = data.occupiedPropertyIds || [];
        const blocked = data.blockedPropertyIds || [];
        setOccupiedPropertyIds(occupied);
        setBlockedPropertyIds(blocked);

        setSelectedPropertyIds((prev) =>
          prev.filter((id) => {
            if (blocked.includes(id)) return false;
            const isOriginallyAssigned = isEditMode && (booking?.booking_properties || []).some(
              (row) => (row.property_id || row.properties?.id) === id
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
  }, [debouncedCheckIn, debouncedCheckOut, dateError, isModal, isOpen, isEditMode, booking?.id]);

  // Date validation
  useEffect(() => {
    if (!checkInDate || !checkOutDate) {
      setDateError('');
      return;
    }

    const checkIn = new Date(`${checkInDate}T12:00:00`);
    const checkOut = new Date(`${checkOutDate}T12:00:00`);

    if (checkOut <= checkIn) {
      setDateError('checkoutAfterCheckin');
      return;
    }

    setDateError('');
  }, [checkInDate, checkOutDate]);

  const selectedProperties = useMemo(
    () => properties.filter((v) => selectedPropertyIds.includes(v.id)),
    [properties, selectedPropertyIds]
  );

  const emptyRateBreakdown = {
    weekdayNights: 0,
    weekendNights: 0,
    holidayNights: 0,
    weekdayTotal: 0,
    weekendTotal: 0,
    holidayTotal: 0,
    propertyTotal: 0,
    nights: 0,
  };

  const rateBreakdown = useMemo(() => {
    if (!checkInDate || !checkOutDate || dateError) return emptyRateBreakdown;

    const checkIn = new Date(`${checkInDate}T12:00:00`);
    const checkOut = new Date(`${checkOutDate}T12:00:00`);
    if (checkOut <= checkIn) return emptyRateBreakdown;

    return computeStayRateBreakdown(selectedProperties, checkInDate, checkOutDate, pricingHolidays);
  }, [checkInDate, checkOutDate, dateError, selectedProperties, pricingHolidays]);

  const nights = rateBreakdown.nights;
  const hasValidDates = nights > 0;

  const addonTotal = useMemo(() => {
    if (!hasValidDates) return 0;
    return addons.reduce((sum, addon) => {
      const qty = selectedAddons[addon.id] || 0;
      if (!qty) return sum;
      const unit = addonPrice(addon);
      const multiplier = addon.is_per_night !== false ? nights : 1;
      return sum + unit * qty * multiplier;
    }, 0);
  }, [hasValidDates, nights, addons, selectedAddons]);

  const estimatedTotal = useMemo(() => {
    if (!hasValidDates) return 0;
    return rateBreakdown.propertyTotal + addonTotal;
  }, [hasValidDates, rateBreakdown.propertyTotal, addonTotal]);

  const selectedDiscount = discounts.find((d) => d.id === discountId);
  const guestName = formData.fullName || booking?.guests?.full_name || booking?.guest_full_name;

  if (isModal && !isOpen) return null;
  if (isEditMode && !booking) return null;

  const isOriginallyAssignedProperty = (propertyId) =>
    isEditMode && (booking?.booking_properties || []).some(
      (row) => (row.property_id || row.properties?.id) === propertyId
    );

  const handlePropertyCheckboxChange = (propertyId) => {
    if (
      cancelMode
      || occupiedPropertyIds.includes(propertyId)
      || blockedPropertyIds.includes(propertyId)
    ) return;
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId]
    );
  };

  const validateBlockConflicts = () => {
    const conflictIds = selectedPropertyIds.filter((id) => blockedPropertyIds.includes(id));
    if (conflictIds.length === 0) return true;

    const conflictNames = properties
      .filter((v) => conflictIds.includes(v.id))
      .map((v) => v.name)
      .join(', ');

    setError(
      t(`publicReservation.errors.propertyUnavailableBlock_${conflictIds.length === 1 ? 'one' : 'other'}`, {
        names: conflictNames,
      })
    );
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateError || isCancelled) return;

    if (isEditMode && cancelMode) {
      if (!cancellationReason.trim()) {
        setError(t('publicReservation.errors.cancellationReasonRequired'));
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await apiFetch(`/bookings/${booking.id}/cancel${bookingTokenQuery(booking)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellation_reason: cancellationReason.trim() }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || t('publicReservation.errors.failedCancelReservation'));
        }
        notify.success(t('publicReservation.notifications.reservationCancelled'));
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
      if (selectedPropertyIds.length === 0) {
        setError(t('publicReservation.errors.selectAtLeastOneProperty'));
        return;
      }
      if (!validateBlockConflicts()) return;
      if (applyDiscount && !discountId) {
        setError(t('publicReservation.errors.selectDiscountToApply'));
        return;
      }

      const selected_addons = Object.entries(selectedAddons)
        .filter(([, qty]) => qty > 0)
        .map(([addon_id, quantity]) => ({ addon_id, quantity }));

      setIsSubmitting(true);
      setError(null);
      try {
        const response = await apiFetch(`/bookings/${booking.id}${bookingTokenQuery(booking)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            total_guests: parseInt(formData.totalGuests, 10) || booking.total_guests,
            notes: formData.notes,
            property_ids: selectedPropertyIds,
            selected_addons,
            apply_discount: applyDiscount,
            discount_id: applyDiscount ? discountId : null,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || t('publicReservation.errors.failedUpdateReservation'));
        }
        notify.success(t('publicReservation.notifications.reservationUpdated'));
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
    if (selectedPropertyIds.length === 0) {
      setError(t('publicReservation.errors.selectAtLeastOneProperty'));
      return;
    }
    if (!validateBlockConflicts()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const guestResponse = await apiFetch('/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: toProperCaseName(formData.fullName),
          email: formData.email,
          phone_number: formData.phoneNumber,
        }),
      });
      if (!guestResponse.ok) throw new Error(t('publicReservation.errors.failedCreateGuest'));
      const newGuest = await guestResponse.json();

      const selected_addons = Object.entries(selectedAddons)
        .filter(([, qty]) => qty > 0)
        .map(([addon_id, quantity]) => ({ addon_id, quantity }));

      const totalGuests =
        parseInt(formData.adults || 0, 10) + parseInt(formData.children || 0, 10);
      const notesWithGuests =
        `Adults: ${formData.adults}, Children: ${formData.children}` +
        (formData.notes ? `\n${formData.notes}` : '');

      const bookingResponse = await apiFetch('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: selectedPropertyIds,
          guest_id: newGuest.id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          total_guests: totalGuests,
          total_price: estimatedTotal,
          notes: notesWithGuests,
          selected_addons,
        }),
      });

      const data = await bookingResponse.json();
      if (bookingResponse.status === 409) {
        setError(t('publicReservation.errors.bookingDenied', { error: data.error }));
        return;
      }
      if (!bookingResponse.ok) throw new Error(data.error || t('publicReservation.errors.failedSaveBooking'));

      if (data?.id && data?.manage_token) {
        sessionStorage.setItem(`booking_token_${data.id}`, data.manage_token);
      }

      setSelectedPropertyIds([]);
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
    ? t('publicReservation.editReservation')
    : isModal
      ? t('publicReservation.bookNewReservation')
      : t('publicReservation.newReservation');

  const submitLabel = isEditMode
    ? (cancelMode ? t('publicReservation.confirmCancellation') : t('publicReservation.saveChanges'))
    : isModal
      ? t('publicReservation.confirmSaveReservation')
      : t('publicReservation.submitReservationRequest');

  const welcomeFeatures = t('publicReservation.features', { returnObjects: true });
  const showWelcomeFeatures = Array.isArray(welcomeFeatures) && welcomeFeatures.length > 0;

  const formBody = (
    <form onSubmit={handleSubmit} className="modal-form">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {isCancelled ? (
        <>
          <Alert
            type="warning"
            title={t('publicReservation.cancelledBooking')}
            message={t('publicReservation.cancelledBookingMessage')}
          />
          <div className="form-section">
            <h4><AlertTriangle size={14} /> {t('publicReservation.cancellationReason')}</h4>
            <p className="cancellation-reason-display">
              {parseCancellationReason(booking?.notes) || t('publicReservation.noCancellationReason')}
            </p>
          </div>
        </>
      ) : (
        <>
          {!isEditMode && (
            <div className="form-section">
              <h4><User size={14} /> {t('publicReservation.guestProfileDetails')}</h4>
              <div className="form-group">
                <RequiredLabel>{t('publicReservation.fullName')}</RequiredLabel>
                <input
                  type="text"
                  placeholder={t('publicReservation.fullNamePlaceholder')}
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <RequiredLabel>{t('publicReservation.emailAddress')}</RequiredLabel>
                  <input
                    type="email"
                    placeholder={t('publicReservation.emailPlaceholder')}
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <RequiredLabel>{t('publicReservation.phoneWhatsApp')}</RequiredLabel>
                  <input
                    type="text"
                    placeholder={t('publicReservation.phonePlaceholder')}
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {isEditMode && (guestName || formData.phoneNumber || booking?.display_id) && (
            <div className="form-section">
              <h4><User size={14} /> {t('publicReservation.guestProfileDetails')}</h4>
              <div className="financial-meta-header" style={{ marginBottom: 0 }}>
                <div className="financial-meta-row">
                  <span className="financial-meta-label">{t('publicReservation.fullName')}</span>
                  <span className="financial-meta-value">{formatMetaValue(guestName)}</span>
                </div>
                <div className="financial-meta-row">
                  <span className="financial-meta-label">{t('publicReservation.phoneWhatsApp')}</span>
                  <span className="financial-meta-value">{formatMetaValue(formData.phoneNumber)}</span>
                </div>
                <div className="financial-meta-row">
                  <span className="financial-meta-label">{t('publicReservation.bookingId')}</span>
                  <span className="financial-meta-value financial-meta-value--mono">
                    {formatMetaValue(booking?.display_id)}
                  </span>
                </div>
                {formData.email && (
                  <div className="financial-meta-row financial-meta-row--divider">
                    <span className="financial-meta-label">{t('publicReservation.emailAddress')}</span>
                    <span className="financial-meta-value">{formatMetaValue(formData.email)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="form-section">
            <h4><Home size={14} /> {t('publicReservation.roomSelectionPricing')}</h4>

            <div className="form-row">
              <div className="form-group">
                {isPublicPage ? (
                  <RequiredLabel>{t('publicReservation.checkIn')}</RequiredLabel>
                ) : (
                  <label>{t('publicReservation.checkIn')}</label>
                )}
                <input
                  type="date"
                  required
                  value={checkInDate}
                  disabled={cancelMode}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                {isPublicPage ? (
                  <RequiredLabel>{t('publicReservation.checkOut')}</RequiredLabel>
                ) : (
                  <label>{t('publicReservation.checkOut')}</label>
                )}
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  disabled={cancelMode}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                />
              </div>
            </div>

            {dateError && (
              <div className="date-error-banner">{t(`publicReservation.errors.${dateError}`)}</div>
            )}
            {blockWarning && !dateError && (
              <div className="date-error-banner">{blockWarning}</div>
            )}

            {!isEditMode ? (
              <div className="form-row">
                <div className="form-group">
                  <RequiredLabel>{t('publicReservation.numberOfAdults')}</RequiredLabel>
                  <select
                    value={formData.adults}
                    onChange={(e) => setFormData({ ...formData, adults: e.target.value })}
                    style={selectStyle}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n > 1 ? t('publicReservation.adults') : t('publicReservation.adult')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <RequiredLabel>{t('publicReservation.numberOfChildren')}</RequiredLabel>
                  <select
                    value={formData.children}
                    onChange={(e) => setFormData({ ...formData, children: e.target.value })}
                    style={selectStyle}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? t('publicReservation.child') : t('publicReservation.children')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>{t('publicReservation.totalGuests')}</label>
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
                {t('publicReservation.assignedPropertyUnits')}
                {isPublicPage && (
                  <span style={{ color: '#dc2626', marginLeft: 2 }} aria-hidden="true">*</span>
                )}
              </label>
              <div className="checkbox-grid">
                {loadingProperties ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{t('publicReservation.syncingPortfolio')}</span>
                ) : properties.length === 0 ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{t('publicReservation.noPropertiesFound')}</span>
                ) : (
                  properties.map((property) => {
                    const isOccupied = occupiedPropertyIds.includes(property.id);
                    const isBlocked = blockedPropertyIds.includes(property.id);
                    const isOriginallyAssigned = isOriginallyAssignedProperty(property.id);
                    const isUnavailable = isBlocked || (isOccupied && !isOriginallyAssigned);
                    const rowClass = [
                      'checkbox-row',
                      isUnavailable ? 'disabled-row' : '',
                      isBlocked ? 'disabled-row--blocked' : '',
                    ].filter(Boolean).join(' ');

                    return (
                      <div key={property.id} className={rowClass}>
                        <input
                          type="checkbox"
                          id={`property-${property.id}-${isEditMode ? 'edit' : 'new'}`}
                          checked={selectedPropertyIds.includes(property.id)}
                          disabled={cancelMode || isUnavailable}
                          onChange={() => handlePropertyCheckboxChange(property.id)}
                        />
                        <label htmlFor={`property-${property.id}-${isEditMode ? 'edit' : 'new'}`} className="checkbox-text">
                          <span>
                            {property.name}
                            {isBlocked && (
                              <small className="property-unavailable-tag">{t('publicReservation.datesBlocked')}</small>
                            )}
                            {isOccupied && !isBlocked && !isOriginallyAssigned && (
                              <small className="property-unavailable-tag">{t('publicReservation.unavailable')}</small>
                            )}
                          </span>
                          <span className="property-rate">
                            {formatPropertyRateForDates(property, checkInDate, checkOutDate, pricingHolidays)}
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
                <label style={{ marginBottom: '6px' }}>{t('publicReservation.addons')}</label>
                <div className="checkbox-grid">
                  {addons.map((addon) => (
                    <div key={addon.id} className="checkbox-row" style={{ justifyContent: 'space-between' }}>
                      <label className="checkbox-text" style={{ flex: 1 }}>
                        <span>{addon.name}</span>
                        <span className="property-rate">
                          Rp {addonPrice(addon).toLocaleString('id-ID')}
                          {addon.is_per_night !== false ? t('publicReservation.perNight') : t('publicReservation.oneTime')}
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
                  <span style={{ fontWeight: 600 }}>{t('publicReservation.applyPromotionalDiscount')}</span>
                </label>
                {applyDiscount && (
                  <div style={{ marginTop: 10 }}>
                    <Select
                      label={t('publicReservation.discountCode')}
                      value={discountId}
                      onChange={(e) => setDiscountId(e.target.value)}
                      disabled={cancelMode}
                      placeholder={t('publicReservation.selectDiscount')}
                      options={discounts.map((d) => ({
                        value: d.id,
                        label: `${d.promo_code || d.code} — ${d.name} (${d.type === 'percentage' ? `${d.value}%` : `Rp ${Number(d.value).toLocaleString('id-ID')}`})`,
                      }))}
                    />
                  </div>
                )}
                {applyDiscount && selectedDiscount?.application_rule === 'highest_priced_single' && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                    {t('publicReservation.discountHighestPricedNote')}
                  </p>
                )}
              </div>
            )}

            {hasValidDates && selectedPropertyIds.length > 0 && (
              <div className="reservation-price-breakdown">
                <p className="reservation-price-breakdown__title">{t('publicReservation.accommodationBreakdown')}</p>
                <ul className="reservation-price-breakdown__list">
                  {rateBreakdown.weekdayNights > 0 && (
                    <li>
                      <span>{t('publicReservation.weekdayNights', { count: rateBreakdown.weekdayNights })}</span>
                      <span>{formatRp(rateBreakdown.weekdayTotal)}</span>
                    </li>
                  )}
                  {rateBreakdown.weekendNights > 0 && (
                    <li>
                      <span>{t('publicReservation.weekendNights', { count: rateBreakdown.weekendNights })}</span>
                      <span>{formatRp(rateBreakdown.weekendTotal)}</span>
                    </li>
                  )}
                  {rateBreakdown.holidayNights > 0 && (
                    <li>
                      <span>{t('publicReservation.holidayNights', { count: rateBreakdown.holidayNights })}</span>
                      <span>{formatRp(rateBreakdown.holidayTotal)}</span>
                    </li>
                  )}
                  {selectedProperties.length > 1 && (
                    <li className="reservation-price-breakdown__subtotal">
                      <span>{t('publicReservation.propertySubtotal', { count: selectedProperties.length })}</span>
                      <span>{formatRp(rateBreakdown.propertyTotal)}</span>
                    </li>
                  )}
                </ul>
                {addonTotal > 0 && (
                  <div className="reservation-price-breakdown__addon">
                    <span>{t('publicReservation.addonsLabel')}</span>
                    <span>{formatRp(addonTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {!hasValidDates && checkInDate && checkOutDate && !dateError && (
              <p className="reservation-price-hint">{t('publicReservation.selectValidDatesHint')}</p>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>{t('publicReservation.duration')}</label>
                <input
                  type="text"
                  readOnly
                  value={rateBreakdown.nights > 0
                    ? `${rateBreakdown.nights} ${rateBreakdown.nights !== 1 ? t('publicReservation.nights') : t('publicReservation.night')}`
                    : '—'}
                  style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                />
              </div>
              <div className="form-group">
                <label>{t('publicReservation.estimatedTotalIdr')}</label>
                <input
                  type="text"
                  readOnly
                  value={hasValidDates ? formatRp(estimatedTotal) : '—'}
                  style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#0f172a' }}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4><Info size={14} /> {isEditMode ? t('publicReservation.notes') : t('publicReservation.specialRequestsNotes')}</h4>
            <div className="form-group">
              <textarea
                placeholder={
                  isEditMode
                    ? t('publicReservation.notesPlaceholderEdit')
                    : t('publicReservation.notesPlaceholderPublic')
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
                {t('publicReservation.cancelThisReservation')}
              </label>
              {cancelMode && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>{t('publicReservation.cancellationReason')}</label>
                  <textarea
                    placeholder={t('publicReservation.cancellationReasonPlaceholder')}
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    rows={3}
                    required
                  />
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, marginBottom: 0 }}>
                    {t('publicReservation.cancelStatusNote')}
                  </p>
                </div>
              )}
            </div>
          )}

          {!isEditMode && !isModal && (
            <p style={{ fontSize: '0.78rem', color: COLORS.textTertiary, margin: '-4px 0 8px', lineHeight: 1.5 }}>
              {t('publicReservation.noPaymentRequiredNote')}
            </p>
          )}

          {isModal ? (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
                {t('publicReservation.close')}
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
            <img src={umalilaLogo} alt="Umalila" className="public-brand-logo" />
          </div>
          <div className="public-welcome-copy">
            <h1 className="public-welcome-title">{t('publicReservation.bookYourHighlandStay')}</h1>
            <p className="public-welcome-desc">
              {t('publicReservation.welcomeDesc')}
            </p>
          </div>
          {showWelcomeFeatures && (
            <ul className="public-feature-list">
              {welcomeFeatures.map((feature) => (
                <li key={feature} className="public-feature-item">
                  <span className="public-feature-dot" />
                  {feature}
                </li>
              ))}
            </ul>
          )}
          <div className="public-welcome-meta">{t('publicReservation.welcomeMeta')}</div>
        </div>
      </aside>

      <main className="public-form-panel">
        <div className="modal-card public-form-card" style={{ position: 'relative' }}>
          {isPublicPage && <PublicLanguageSwitcher />}
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
