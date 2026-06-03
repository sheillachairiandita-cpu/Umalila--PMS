import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import StatCard from './components/StatCard';
import BookingTable from './components/BookingTable';
import BookingFormModal from './components/BookingFormModal';
import './App.css';

function App() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/bookings');
      if (!response.ok) throw new Error('Failed to capture active booking ledger.');
      const data = await response.json();
      setBookings(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleBookingSuccess = () => {
    setIsModalOpen(false);
    fetchBookings(); // Automatically refresh data ledger
  };

  return (
    <div className="dashboard-container">
      {/* Top Brand Header */}
      <header className="header-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Umalila PMS</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Operational Control & Property Overview</p>
        </div>
        <button className="add-booking-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> New Reservation
        </button>
      </header>

      {/* Analytics Insight Row */}
      <section className="stats-grid">
        <StatCard title="Total Properties" value="3 Units" />
        <StatCard title="Active Reservations" value={loading ? '...' : `${bookings.length}`} />
        <StatCard 
          title="System Sync" 
          extraElement={
            <div style={{ fontSize: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              Connected to Cloud
            </div>
          } 
        />
      </section>

      {/* Main Timeline Ledger */}
      <BookingTable 
        bookings={bookings} 
        loading={loading} 
        error={error} 
        onRefresh={fetchBookings} 
      />

      {/* Form Overlay Component */}
      <BookingFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleBookingSuccess} 
      />
    </div>
  );
}

export default App;