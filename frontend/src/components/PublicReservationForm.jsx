import React, { useState, useEffect } from 'react';
import { X, User, Home, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Add this line
import SubmittingOverlay from './SubmittingOverlay';

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
    totalGuests: '2',
    totalPrice: 0,
    notes: ''
  });

  // Fetch villas AND addons when modal opens — both in one useEffect
  useEffect(() => {
    // Reset form state every time modal opens
    setFormData({
      fullName: '',
      email: '',
      phoneNumber: '',
      checkInDate: '',
      checkOutDate: '',
      totalGuests: '2',
      totalPrice: 0,
      notes: ''
    });
    setSelectedVillaIds([]);
    setOccupiedVillaIds([]);
    setSelectedAddons({});
    setDateError('');

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
        console.error('Failed to fetch initial modal data:', err);
      } finally {
        setLoadingVillas(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch availability whenever date range changes
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
        setSelectedVillaIds(prev => prev.filter(id => !(data.occupiedVillaIds || []).includes(id)));
      } catch (err) {
        console.error('Availability check error:', err);
      }
    };

    checkLiveAvailability();
  }, [formData.checkInDate, formData.checkOutDate, dateError]);

  // Date validation & automatic pricing
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
      totalPrice: totalNights * (villaRate + addonRate)
    }));
  }, [formData.checkInDate, formData.checkOutDate, selectedVillaIds, selectedAddons, villas, addons]);

  const handleVillaCheckboxChange = (villaId) => {
    if (occupiedVillaIds.includes(villaId)) return;
    setSelectedVillaIds(prev =>
      prev.includes(villaId) ? prev.filter(id => id !== villaId) : [...prev, villaId]
    );
  };

  const handleSubmit = async (e) => {
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
          phone_number: formData.phoneNumber
        })
      });

      if (!guestResponse.ok) throw new Error('Failed to create guest record.');
      const newGuest = await guestResponse.json();

      const selected_addons = Object.entries(selectedAddons)
        .filter(([_, qty]) => qty > 0)
        .map(([addon_id, quantity]) => ({ addon_id, quantity }));

      const bookingResponse = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villa_ids: selectedVillaIds,
          guest_id: newGuest.id,
          check_in_date: formData.checkInDate,
          check_out_date: formData.checkOutDate,
          total_guests: parseInt(formData.totalGuests),
          total_price: formData.totalPrice,
          notes: formData.notes,
          selected_addons
        })
      });

      const data = await bookingResponse.json();

      if (bookingResponse.status === 409) {
        alert(`Booking Denied: ${data.error}`);
        return;
      }

      if (!bookingResponse.ok) throw new Error(data.error || 'Failed to save booking.');

      // Clear the inputs
      setSelectedVillaIds([]);
      
      // Replace "onSuccess()" with our safe route router push!
      navigate('/success'); 

    } catch (err) {
      console.error('Booking error:', err.message);
      alert('Communication error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <div className="modal-card" style={{ position: 'relative' }}>
        {isSubmitting && <SubmittingOverlay />}
        <form onSubmit={handleSubmit} className="modal-form">

          <div className="form-section">
            <h4><User size={14} /> Guest Profile Details</h4>
            <div className="form-group">
              <label>Guest Full Name</label>
              <input type="text" placeholder="John Doe" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="john@example.com" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" placeholder="+62..." required value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4><Home size={14} /> Room Selection & Pricing</h4>

            <div className="form-row">
              <div className="form-group">
                <label>Check In</label>
                <input type="date" required value={formData.checkInDate} onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Check Out</label>
                <input type="date" required value={formData.checkOutDate} onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })} />
              </div>
            </div>

            {dateError && <div className="date-error-banner">{dateError}</div>}

            <div className="form-group">
              <label style={{ marginBottom: '6px' }}>Assigned Property Units (Select one or more)</label>
              <div className="checkbox-grid">
                {loadingVillas ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Syncing property portfolio rows...</span>
                ) : villas.length === 0 ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>No properties found in database</span>
                ) : (
                  villas.map(villa => {
                    const isBooked = occupiedVillaIds.includes(villa.id);
                    return (
                      <div key={villa.id} className={`checkbox-row ${isBooked ? 'disabled-row' : ''}`}>
                        <input
                          type="checkbox"
                          id={`villa-${villa.id}`}
                          checked={selectedVillaIds.includes(villa.id)}
                          disabled={isBooked}
                          onChange={() => handleVillaCheckboxChange(villa.id)}
                        />
                        <label htmlFor={`villa-${villa.id}`} className="checkbox-text">
                          <span style={{ color: isBooked ? '#94a3b8' : 'inherit' }}>
                            {villa.name} {isBooked && <small style={{ color: '#ef4444', fontStyle: 'italic', marginLeft: '6px' }}>(Unavailable)</small>}
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

            <div className="form-group">
              <label style={{ marginBottom: '6px' }}>Add-ons (per night)</label>
              <div className="checkbox-grid">
                {addons.length === 0 ? (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>No add-ons available</span>
                ) : (
                  addons.map(addon => (
                    <div key={addon.id} className="checkbox-row" style={{ justifyContent: 'space-between' }}>
                      <label className="checkbox-text" style={{ flex: 1 }}>
                        <span>{addon.name}</span>
                        <span className="villa-rate">Rp {addon.price_per_night?.toLocaleString()}/night</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedAddons(prev => ({
                            ...prev,
                            [addon.id]: Math.max(0, (prev[addon.id] || 0) - 1)
                          }))}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            border: '1px solid #cbd5e1', background: '#f8fafc',
                            cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >−</button>
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 500 }}>
                          {selectedAddons[addon.id] || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAddons(prev => ({
                            ...prev,
                            [addon.id]: (prev[addon.id] || 0) + 1
                          }))}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            border: '1px solid #cbd5e1', background: '#f8fafc',
                            cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Guests</label>
                <input type="number" placeholder="2" required value={formData.totalGuests} onChange={(e) => setFormData({ ...formData, totalGuests: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Calculated Price (IDR)</label>
                <input
                  type="text"
                  readOnly
                  value={`Rp ${formData.totalPrice.toLocaleString()}`}
                  style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#0f172a' }}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4><Info size={14} /> Internal System Notes</h4>
            <div className="form-group">
              <textarea placeholder="Special catering requests, early arrival accommodations..." rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}></textarea>
            </div>
          </div>

          <button type="submit" className="submit-form-btn" disabled={!!dateError} style={{ opacity: dateError ? 0.5 : 1, cursor: dateError ? 'not-allowed' : 'pointer' }}>
            Confirm & Save Reservation
          </button>
        </form>
      </div>
    </div>
  );
}

export default PublicReservationForm;
