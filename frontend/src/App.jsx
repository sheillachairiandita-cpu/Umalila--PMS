import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import Overview from './components/overview/Overview';
import Sidebar from './components/SideBar';
import CalendarPage from './components/calendar/CalendarPage';
import ReservationPage from './components/reservations/ReservationPage';
import FinancialDashboardPage from './components/financial/FinancialDashboardPage';
import Pricing from './components/pricing/Pricing';
import Users from './components/users/Users';
import PublicReservationForm from './components/reservations/PublicReservationForm';
import PublicSuccessMessage from './components/reservations/PublicSuccessMessage';
import Dashboard from './components/dashboard/Dashboard';
import LoginPage from './components/auth/LoginPage';
import ChangePasswordPage from './components/auth/ChangePasswordPage';
import Profile from './components/users/Profile';
import ProtectedPage from './components/auth/ProtectedPage';
import { NotificationProvider } from './context/NotificationProvider';
import { MutationProvider } from './context/MutationProvider';
import { AuthProvider, RequireAuth, DefaultAdminRedirect, useAuth } from './context/AuthProvider';
import RequirePermission from './components/auth/RequirePermission';
import { PERMISSIONS } from './auth/permissions';
import './App.css';

function OverviewPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bookings', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to capture active booking ledger.');
      const data = await response.json();
      setBookings(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return (
    <div className="dashboard-container">
      <Overview
        bookings={bookings}
        loading={loading}
        error={error}
        onRefresh={fetchBookings}
      />
    </div>
  );
}

function CalendarRoute() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBookingSuccess = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <CalendarPage onOpenBookingModal={() => setIsModalOpen(true)} />
      <RequirePermission permission={PERMISSIONS.CALENDAR_BOOK}>
        <PublicReservationForm
          variant="modal"
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleBookingSuccess}
        />
      </RequirePermission>
    </>
  );
}

function SettingsPage() {
  return (
    <div className="placeholder-page">
      <h1 className="placeholder-page-title">Settings</h1>
      <p className="pms-text-muted">System configuration and preferences.</p>
    </div>
  );
}

function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const activePage = location.pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard';

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onLogout={handleLogout}
      />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function AdminApp() {
  return (
    <AuthProvider>
      <MutationProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            element={(
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            )}
          >
            <Route index element={<DefaultAdminRedirect />} />
            <Route
              path="dashboard"
              element={(
                <ProtectedPage page="dashboard">
                  <OverviewPage />
                </ProtectedPage>
              )}
            />
            <Route
              path="calendar"
              element={(
                <ProtectedPage page="calendar">
                  <CalendarRoute />
                </ProtectedPage>
              )}
            />
            <Route
              path="reservations"
              element={(
                <ProtectedPage page="reservations">
                  <ReservationPage />
                </ProtectedPage>
              )}
            />
            <Route
              path="financial"
              element={(
                <ProtectedPage page="financial">
                  <FinancialDashboardPage />
                </ProtectedPage>
              )}
            />
            <Route
              path="insights"
              element={(
                <ProtectedPage page="insights">
                  <Dashboard />
                </ProtectedPage>
              )}
            />
            <Route
              path="pricing"
              element={(
                <ProtectedPage page="pricing">
                  <Pricing />
                </ProtectedPage>
              )}
            />
            <Route
              path="users"
              element={(
                <ProtectedPage page="users">
                  <Users />
                </ProtectedPage>
              )}
            />
            <Route
              path="profile"
              element={<Profile />}
            />
            <Route
              path="change-password"
              element={<ChangePasswordPage />}
            />
            <Route
              path="settings"
              element={(
                <ProtectedPage page="settings">
                  <SettingsPage />
                </ProtectedPage>
              )}
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </MutationProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicReservationForm />} />
          <Route path="/book" element={<Navigate to="/" replace />} />
          <Route path="/success" element={<PublicSuccessMessage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
