import React, { useState, useEffect } from 'react';
import { User, Home, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Card } from './ui';
import { COLORS, SPACING } from '../styles/theme';
import SubmittingOverlay from './SubmittingOverlay';
import '../App.css';

function PublicReservationForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [villas, setVillas] = useState([]);
  const [loadingVillas, setLoadingVillas] = useState(false);
  const [selectedVillaIds, setSelectedVillaIds] = useState([]);
  const [occupiedVillaIds, setOccupiedVillaIds] = useState([]);
  const [dateError, setDateError] = useState('');
  const [addons, setAddons] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState({});

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    checkInDate: '',
    checkOutDate: '',
    adults: '2',
    children: '0',
    totalPrice: 0,
    notes: '',
  });

  // Fetch villas & addons on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingVillas(true);
      try {
        const [villasRes, addonsRes] = await Promise.all([
          fetch('http://localhost:5000/api/villas'),
          fetch('http://localhost:5000/api/addons'),
        ]);
        if (villasRes.ok) setVillas(await villasRes.json());
        if (addonsRes.ok) setAddons(await addonsRes.json());
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      } finally {
        setLoadingVillas(false);
      }
    };
    fetchInitialData();
  }, []);

  // Live availability check when dates change
  useEffect(() => {
    if (!formData.checkInDate || !formData.checkOutDate || dateError) return;
    const checkLiveAvailability = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/villas/availability?check_in=${formData.checkInDate}&check_out=${formData.checkOutDate}`
        );
        if (!response.ok) return;
        const data = await response.json();
        setOccupiedVillaIds(data.occupiedVillaIds || []);
        setSelectedVillaIds(prev =>
          prev.filter(id => !(data.occupiedVillaIds || []).includes(id))
        );
      } catch (err) {
        console.error('Availability check error:', err);
      }
    };
    checkLiveAvailability();
  }, [formData.checkInDate, formData.checkOutDate, dateError]);

  // Date validation & auto pricing
  useEffect(() => {
    if (!formData.checkInDate || !formData.checkOutDate) return;

    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);

    if (checkOut <= checkIn) {
      setDateError('⚠️ Checkout date must occur after the check-in timeline.');
      setFormData(prev => ({ ...prev, totalPrice: 0 }));
      return;
    }

    setDateError('');
    const totalNights = Math.ceil((checkOut - checkIn) / (1000 * 3600 * 24));

    const villaRate = villas
      .filter(v => selectedVillaIds.includes(v.id))
      .reduce((sum, v) => sum + (v.base_rate_per_night || 0), 0);

    const addonRate = addons.reduce((sum, addon) => {
      const qty = selectedAddons[addon.id] || 0;
      return sum + addon.price_per_night * qty;
    }, 0);

    setFormData(prev => ({
      ...prev,
      totalPrice: totalNights * (villaRate + addonRate),
    }));
  }, [
    formData.checkInDate,
    formData.checkOutDate,
    selectedVillaIds,
    selectedAddons,
    villas,
    addons,
  ]);

  const handleVillaCheckboxChange = villaId => {
    if (occupiedVillaIds.includes(villaId)) return;
    setSelectedVillaIds(prev =>
      prev.includes(villaId) ? prev.filter(id => id !== villaId) : [...prev, villaId]
    );
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (dateError) return;
    setIsSubmitting(true);

    try {
      const guestResponse = await fetch('http://localhost:5000/api/guests', {
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

      const totalGuests = parseInt(formData.adults || 0) + parseInt(formData.children || 0);
      const notesWithGuests =
        `Adults: ${formData.adults}, Children: ${formData.children}` +
        (formData.notes ? `\n${formData.notes}` : '');

      const bookingResponse = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villa_ids: selectedVillaIds,
          guest_id: newGuest.id,
          check_in_date: formData.checkInDate,
          check_out_date: formData.checkOutDate,
          total_guests: totalGuests,
          total_price: formData.totalPrice,
          notes: notesWithGuests,
          selected_addons,
        }),
      });

      const data = await bookingResponse.json();
      if (bookingResponse.status === 409) { alert(`Booking Denied: ${data.error}`); return; }
      if (!bookingResponse.ok) throw new Error(data.error || 'Failed to save booking.');

      setSelectedVillaIds([]);
      navigate('/success');
    } catch (err) {
      console.error('Booking error:', err.message);
      alert('Communication error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nights =
    formData.checkInDate && formData.checkOutDate && !dateError
      ? Math.max(0, Math.ceil(
          (new Date(formData.checkOutDate) - new Date(formData.checkInDate)) / (1000 * 3600 * 24)
        ))
      : 0;

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

  return (
    <div className="public-reservation-page">

      {/* ── LEFT: Welcome Panel ─────────────────────────────────── */}
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
            {[
              'Mountain-view private villas',
              'English garden',
              'Daily breakfast included',
              
            ].map(f => (
              <li key={f} className="public-feature-item">
                <span className="public-feature-dot" />
                {f}
              </li>
            ))}
          </ul>

          <div className="public-welcome-meta">
            1°30′S · 100°28′E · 1,400 m elevation
          </div>
        </div>
      </aside>

      {/* ── RIGHT: Booking Form ─────────────────────────────────── */}
      <main className="public-form-panel">
        <div className="modal-card public-form-card" style={{ position: 'relative' }}>
          {isSubmitting && <SubmittingOverlay />}

          <div className="modal-header">
            <h2>New Reservation</h2>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">

            {/* ── Guest Details ──────────────────────────────── */}
            <div className="form-section">
              <h4><User size={14} /> Guest Profile Details</h4>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  required
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62..."
                    required
                    value={formData.phoneNumber}
                    onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* ── Stay & Pricing ─────────────────────────────── */}
            <div className="form-section">
              <h4><Home size={14} /> Room Selection & Pricing</h4>

              {/* Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Check In</label>
                  <input
                    type="date"
                    required
                    value={formData.checkInDate}
                    onChange={e => setFormData({ ...formData, checkInDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Check Out</label>
                  <input
                    type="date"
                    required
                    value={formData.checkOutDate}
                    onChange={e => setFormData({ ...formData, checkOutDate: e.target.value })}
                  />
                </div>
              </div>

              {dateError && <div className="date-error-banner">{dateError}</div>}

              {/* Adults & Children */}
              <div className="form-row">
                <div className="form-group">
                  <label>Number of Adults</label>
                  <select
                    value={formData.adults}
                    onChange={e => setFormData({ ...formData, adults: e.target.value })}
                    style={selectStyle}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} Adult{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Number of Children</label>
                  <select
                    value={formData.children}
                    onChange={e => setFormData({ ...formData, children: e.target.value })}
                    style={selectStyle}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'Child' : 'Children'}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Villa checkboxes */}
              <div className="form-group">
                <label style={{ marginBottom: '6px' }}>
                  Assigned Property Units (Select one or more)
                </label>
                <div className="checkbox-grid">
                  {loadingVillas ? (
                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      Syncing property portfolio…
                    </span>
                  ) : villas.length === 0 ? (
                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      No properties found in database
                    </span>
                  ) : (
                    villas.map(villa => {
                      const isBooked = occupiedVillaIds.includes(villa.id);
                      return (
                        <div key={villa.id} className={`checkbox-row${isBooked ? ' disabled-row' : ''}`}>
                          <input
                            type="checkbox"
                            id={`pvilla-${villa.id}`}
                            checked={selectedVillaIds.includes(villa.id)}
                            disabled={isBooked}
                            onChange={() => handleVillaCheckboxChange(villa.id)}
                          />
                          <label htmlFor={`pvilla-${villa.id}`} className="checkbox-text">
                            <span style={{ color: isBooked ? '#94a3b8' : 'inherit' }}>
                              {villa.name}
                              {isBooked && (
                                <small style={{ color: '#ef4444', fontStyle: 'italic', marginLeft: '6px' }}>
                                  (Unavailable)
                                </small>
                              )}
                            </span>
                            <span className="villa-rate" style={{ color: isBooked ? '#cbd5e1' : '#64748b' }}>
                              Rp {villa.base_rate_per_night?.toLocaleString()}/night
                            </span>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add-ons */}
              {addons.length > 0 && (
                <div className="form-group">
                  <label style={{ marginBottom: '6px' }}>Add-ons (per night)</label>
                  <div className="checkbox-grid">
                    {addons.map(addon => (
                      <div key={addon.id} className="checkbox-row" style={{ justifyContent: 'space-between' }}>
                        <label className="checkbox-text" style={{ flex: 1 }}>
                          <span>{addon.name}</span>
                          <span className="villa-rate">Rp {addon.price_per_night?.toLocaleString()}/night</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAddons(prev => ({
                                ...prev,
                                [addon.id]: Math.max(0, (prev[addon.id] || 0) - 1),
                              }))
                            }
                            style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              border: '1px solid #cbd5e1', background: '#f8fafc',
                              cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >−</button>
                          <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 500 }}>
                            {selectedAddons[addon.id] || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAddons(prev => ({
                                ...prev,
                                [addon.id]: (prev[addon.id] || 0) + 1,
                              }))
                            }
                            style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              border: '1px solid #cbd5e1', background: '#f8fafc',
                              cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration + price row */}
              <div className="form-row">
                <div className="form-group">
                  <label>Duration</label>
                  <input
                    type="text"
                    readOnly
                    value={nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}` : '—'}
                    style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                  />
                </div>
                <div className="form-group">
                  <label>Estimated Total (IDR)</label>
                  <input
                    type="text"
                    readOnly
                    value={`Rp ${formData.totalPrice.toLocaleString()}`}
                    style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#0f172a' }}
                  />
                </div>
              </div>
            </div>

            {/* ── Notes ──────────────────────────────────────── */}
            <div className="form-section">
              <h4><Info size={14} /> Special Requests & Notes</h4>
              <div className="form-group">
                <textarea
                  placeholder="Early check-in, dietary requirements, special occasions…"
                  rows="3"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: COLORS.textTertiary, margin: '-4px 0 8px', lineHeight: 1.5 }}>
              No payment required now. Our team will confirm availability and send an invoice within 24 hours.
            </p>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="md"
              disabled={!!dateError}
            >
              Submit Reservation Request
            </Button>

          </form>
        </div>
      </main>
    </div>
  );
}

export default PublicReservationForm;
