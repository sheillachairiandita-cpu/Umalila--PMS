import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import StatCard from './components/StatCard';
import BookingTable from './components/BookingTable';
import BookingFormModal from './components/BookingFormModal';
import Sidebar from './components/SideBar'; // Ensure the folder path and casing matches your file
import './App.css';

function App() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Track the active sidebar layout screen
  const [activePage, setActivePage] = useState('dashboard');

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
    <div className="app-layout">
      {/* 1. Master Sidebar Shell */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      {/* 2. Main Work Panel Display */}
      <main className="main-content">
        
        {/* VIEW: DASHBOARD PANEL */}
        {activePage === 'dashboard' && (
          <div className="dashboard-container">
            {/* Top Brand Header */}
            <header className="header-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>Umalila PMS</h1>
                <p style={{ color: '#64748b', margin: 0 }}>Operational Control & Property Overview</p>
              </div>
              <button className="add-booking-btn" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer'
              }} onClick={() => setIsModalOpen(true)}>
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
          </div>
        )}

        {/* VIEW: FRONT DESK VIEW PLACEHOLDER */}
        {activePage === 'frontdesk' && (
          <div className="placeholder-page">
            <h1 className="placeholder-page-title">Front Desk</h1>
            <p className="pms-text-muted">Your booking ledger timeline and visual interactive calendars live here.</p>
          </div>
        )}

        {/* VIEW: VILLA MANAGEMENT PLACEHOLDER */}
        {activePage === 'villas' && (
          <div className="placeholder-page">
            <h1 className="placeholder-page-title">Villa Units</h1>
            <p className="pms-text-muted">Manage pricing, metadata, and status rules for individual properties.</p>
          </div>
        )}

        {/* FALLBACK VIEW ROUTER FOR WORK-IN-PROGRESS SCREENS */}
        {!['dashboard', 'frontdesk', 'villas'].includes(activePage) && (
          <div className="placeholder-page">
            <h1 className="placeholder-page-title">
              {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
            </h1>
            <p className="pms-text-muted">This module is currently being calibrated.</p>
          </div>
        )}
      </main>

      {/* Form Overlay Component Container */}
      <BookingFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleBookingSuccess} 
      />
    </div>
  );
}

export default App;