import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import DashboardStats from './components/DashboardStats';
import Overview from './components/Overview';
import Sidebar from './components/SideBar';
import CalendarPage from './components/CalendarPage';
import ReservationPage from './components/reservations/ReservationPage';
import FinancialDashboardPage from './components/financial/FinancialDashboardPage';
import Pricing from './components/pricing/Pricing';
import PublicReservationForm from './components/reservations/PublicReservationForm';
import PublicSuccessMessage from './components/reservations/PublicSuccessMessage';
import Dashboard from './components/Dashboard'; 
import './App.css';

function AdminPortal() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

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

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/dashboard');
      if (!response.ok) throw new Error('Failed to load dashboard stats.');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Dashboard stats error:', err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchStats();
  }, []);

  const handleBookingSuccess = () => {
    setIsModalOpen(false);
    fetchBookings();
    fetchStats();
  };

  const handleRefresh = () => {
    fetchBookings();
    fetchStats();
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <main className="main-content">
        {activePage === 'dashboard' && (
          <div className="dashboard-container">
            <DashboardStats stats={stats} loading={statsLoading} /> 
            <Overview
              bookings={bookings}
              loading={loading}
              error={error}
              onRefresh={handleRefresh}
            />
          </div>
        )}

        {activePage === 'calendar' && <CalendarPage onOpenBookingModal={() => setIsModalOpen(true)} />}
        {activePage === 'reservations' && <ReservationPage />}
        {activePage === 'financial' && <FinancialDashboardPage />}
        {activePage === 'pricing' && <Pricing />}
        {activePage === 'insights' && <Dashboard />}

        {activePage === 'reservationlist' && (
          <div className="dashboard-container">
            <header className="header-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="add-booking-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', backgroundColor: '#0f172a', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
                }}
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={16} /> New Reservation
              </button>
            </header>
            <Overview bookings={bookings} loading={loading} error={error} onRefresh={handleRefresh} />
          </div>
        )}

        {activePage === 'frontdesk' && (
          <div className="placeholder-page">
            <h1 className="placeholder-page-title">Front Desk</h1>
            <p className="pms-text-muted">Your booking ledger timeline and visual interactive calendars live here.</p>
          </div>
        )}

        {activePage === 'villas' && (
          <div className="placeholder-page">
            <h1 className="placeholder-page-title">Villa Units</h1>
            <p className="pms-text-muted">Manage pricing, metadata, and status rules for individual properties.</p>
          </div>
        )}

        {/* ↓ Add 'insights' to the exclusion list */}
        {!['dashboard', 'frontdesk', 'villas', 'calendar', 'reservations', 'financial', 'pricing', 'reservationlist', 'insights'].includes(activePage) && (
          <div className="placeholder-page">
            <h1 className="placeholder-page-title">
              {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
            </h1>
            <p className="pms-text-muted">This module is currently being calibrated.</p>
          </div>
        )}
      </main>

      <PublicReservationForm
        variant="modal"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicReservationForm />} />
        <Route path="/book" element={<Navigate to="/" replace />} />
        <Route path="/success" element={<PublicSuccessMessage />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
