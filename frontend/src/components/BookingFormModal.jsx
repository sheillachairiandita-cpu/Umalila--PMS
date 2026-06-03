import React, { useState, useEffect } from 'react';
import { X, User, Home, Info } from 'lucide-react';

function BookingFormModal({ isOpen, onClose, onSuccess }) {
  const [villas, setVillas] = useState([]);
  const [loadingVillas, setLoadingVillas] = useState(false);
  const [selectedVillaIds, setSelectedVillaIds] = useState([]);
  const [occupiedVillaIds, setOccupiedVillaIds] = useState([]); // 🔒 Tracks disabled units
  const [dateError, setDateError] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    checkInDate: '2026-06-10',
    checkOutDate: '2026-06-15',
    totalGuests: '2',
    totalPrice: 0,
    notes: ''
  });

  // Fetch all villas when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchVillas = async () => {
        setLoadingVillas(true);
        try {
          const response = await fetch('http://localhost:5000/api/villas');
          if (response.ok) {
            const data = await response.json();
            setVillas(data);
            setSelectedVillaIds([]);
          }
        } catch (err) {
          console.error("Failed to fetch available villas:", err);
        } finally {
          setLoadingVillas(false);
        }
      };
      fetchVillas();
    }
  }, [isOpen]);

  // 🔄 Fetch booked villas whenever the date range changes
useEffect(() => {
  if (isOpen && formData.checkInDate && formData.checkOutDate && !dateError) {
    const checkLiveAvailability = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/villas/availability?check_in=${formData.checkInDate}&check_out=${formData.checkOutDate}`
        );
        
        if (!response.ok) {
          console.warn("Availability check returned an error. Defaulting to show all.");
          return; // Simply stop here; don't crash
        }
        
        const data = await response.json();
        setOccupiedVillaIds(data.occupiedVillaIds || []);
        
        // Auto-deselect any villa that just became disabled
        setSelectedVillaIds(prev => prev.filter(id => !(data.occupiedVillaIds || []).includes(id)));
      } catch (err) {
        console.error("Communication error, but UI remains stable:", err);
      }
    };
    checkLiveAvailability();
  }
}, [formData.checkInDate, formData.checkOutDate, dateError, isOpen]);

  // Date Validation & Automatic Pricing Engine
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      
      if (checkOut <= checkIn) {
        setDateError('⚠️ Checkout date must occur after the check-in timeline.');
        setFormData(prev => ({ ...prev, totalPrice: 0 }));
        return;
      } else {
        setDateError('');
      }

      const timeDiff = checkOut.getTime() - checkIn.getTime();
      const totalNights = Math.ceil(timeDiff / (1000 * 3600 * 24));

      const combinedRatePerNight = villas
        .filter(v => selectedVillaIds.includes(v.id))
        .reduce((sum, v) => sum + (v.base_rate_per_night || 0), 0);

      setFormData(prev => ({ ...prev, totalPrice: totalNights * combinedRatePerNight }));
    }
  }, [formData.checkInDate, formData.checkOutDate, selectedVillaIds, villas]);

  if (!isOpen) return null;

  const handleVillaCheckboxChange = (villaId) => {
    if (occupiedVillaIds.includes(villaId)) return; // Prevent clicking disabled units
    setSelectedVillaIds(prev => 
      prev.includes(villaId) ? prev.filter(id => id !== villaId) : [...prev, villaId]
    );
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (dateError) return;

  try {
    // 1. Create Guest
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

    // 2. Create Booking (THIS WAS THE MISSING PART)
    const bookingResponse = await fetch('http://localhost:5000/api/bookings', {
      method: 'POST', // <--- THIS IS THE KEY FIX
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        villa_ids: selectedVillaIds,
        guest_id: newGuest.id,
        check_in_date: formData.checkInDate,
        check_out_date: formData.checkOutDate,
        total_guests: parseInt(formData.totalGuests),
        total_price: formData.totalPrice,
        notes: formData.notes
      })
    });

    const data = await bookingResponse.json();

    if (bookingResponse.status === 409) {
      alert(`Booking Denied: ${data.error}`);
      return;
    }

    if (!bookingResponse.ok) throw new Error(data.error || 'Failed to capture active booking ledger.');

    setSelectedVillaIds([]);
    onSuccess();
  } catch (err) {
    console.error("Booking error:", err.message);
    alert("Communication error: " + err.message);
  }
};

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Book New Reservation</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          
          <div className="form-section">
            <h4><User size={14} /> Guest Profile Details</h4>
            <div className="form-group">
              <label>Guest Full Name</label>
              <input type="text" placeholder="John Doe" required value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="john@example.com" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" placeholder="+62..." required value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4><Home size={14} /> Room Selection & Pricing</h4>
            
            <div className="form-row">
              <div className="form-group">
                <label>Check In</label>
                <input type="date" required value={formData.checkInDate} onChange={(e) => setFormData({...formData, checkInDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Check Out</label>
                <input type="date" required value={formData.checkOutDate} onChange={(e) => setFormData({...formData, checkOutDate: e.target.value})} />
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

            <div className="form-row">
              <div className="form-group">
                <label>Total Guests</label>
                <input type="number" placeholder="2" required value={formData.totalGuests} onChange={(e) => setFormData({...formData, totalGuests: e.target.value})} />
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
              <textarea placeholder="Special catering requests, early arrival accommodations..." rows="2" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}></textarea>
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

export default BookingFormModal;