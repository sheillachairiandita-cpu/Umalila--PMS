import React, { lazy, Suspense } from 'react';
import { Menu, User } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import useBreakpoint from './hooks/useBreakpoint';
import Sidebar from './components/SideBar';
import PublicReservationForm from './components/reservations/PublicReservationForm';
import PublicSuccessMessage from './components/reservations/PublicSuccessMessage';
import LoginPage from './components/auth/LoginPage';
import ProtectedPage from './components/auth/ProtectedPage';
import { NotificationProvider } from './context/NotificationProvider';
import { MutationProvider } from './context/MutationProvider';
import { AuthProvider, RequireAuth, DefaultAdminRedirect, useAuth } from './context/AuthProvider';
import RequirePermission from './components/auth/RequirePermission';
import { PERMISSIONS } from './auth/permissions';
import { useBookings } from './hooks/api/useBookings';
import { config, HOST_MODES } from './config/index.js';
import { adminLoginPath, adminPath, parseAdminActivePage } from './auth/adminPaths.js';
import './App.css';

const Overview = lazy(() => import('./components/overview/Overview'));
const CalendarPage = lazy(() => import('./components/calendar/CalendarPage'));
const ReservationPage = lazy(() => import('./components/reservations/ReservationPage'));
const FinancialDashboardPage = lazy(() => import('./components/financial/FinancialDashboardPage'));
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const Pricing = lazy(() => import('./components/pricing/Pricing'));
const Users = lazy(() => import('./components/users/Users'));
const ChangePasswordPage = lazy(() => import('./components/auth/ChangePasswordPage'));
const Profile = lazy(() => import('./components/users/Profile'));

function PageLoader() {
  return <div className="empty-state">Loading…</div>;
}

function OverviewPage() {
  const { data: bookings = [], isLoading: loading, error, refetch } = useBookings();

  return (
    <div className="dashboard-container">
      <Overview
        bookings={bookings}
        loading={loading}
        error={error?.message || null}
        onRefresh={refetch}
      />
    </div>
  );
}

function CalendarRoute() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

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

function AdminMobileHeader({ onMenuOpen, onProfile }) {
  return (
    <header className="app-mobile-header" aria-label="Mobile navigation">
      <button
        type="button"
        className="app-mobile-header__menu-btn"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>
      <div className="app-mobile-header__brand">
        <span className="app-mobile-header__title">Umalila</span>
        <span className="app-mobile-header__subtitle">PMS</span>
      </div>
      <button
        type="button"
        className="app-mobile-header__user-btn"
        onClick={onProfile}
        aria-label="Profile"
      >
        <User size={20} />
      </button>
    </header>
  );
}

const SIDEBAR_STORAGE_KEY = 'umalila-sidebar-collapsed';
const TABLET_MIN = 768;
const LAPTOP_MIN = 1024;

function readSidebarCollapsed() {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch { /* ignore */ }
  const w = typeof window !== 'undefined' ? window.innerWidth : LAPTOP_MIN;
  return w >= TABLET_MIN && w < LAPTOP_MIN;
}

function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(readSidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const activePage = parseAdminActivePage(location.pathname);

  React.useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  React.useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate(adminLoginPath(), { replace: true });
  };

  const tabletCompact = isTablet && !sidebarCollapsed;

  return (
    <div className={`app-layout${isMobile ? ' app-layout--mobile' : ''}`}>
      {isMobile && mobileMenuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {isMobile && (
        <AdminMobileHeader
          onMenuOpen={() => setMobileMenuOpen(true)}
          onProfile={() => navigate(adminPath('profile'))}
        />
      )}

      <Sidebar
        activePage={activePage}
        collapsed={sidebarCollapsed && !isMobile}
        tabletCompact={tabletCompact}
        mobileOpen={isMobile && mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onLogout={handleLogout}
        hideCollapseToggle={isMobile}
      />

      <main className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
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
            <Route path="dashboard" element={<ProtectedPage page="dashboard"><OverviewPage /></ProtectedPage>} />
            <Route path="calendar" element={<ProtectedPage page="calendar"><CalendarRoute /></ProtectedPage>} />
            <Route path="reservations" element={<ProtectedPage page="reservations"><ReservationPage /></ProtectedPage>} />
            <Route path="financial" element={<ProtectedPage page="financial"><FinancialDashboardPage /></ProtectedPage>} />
            <Route path="insights" element={<ProtectedPage page="insights"><Dashboard /></ProtectedPage>} />
            <Route path="pricing" element={<ProtectedPage page="pricing"><Pricing /></ProtectedPage>} />
            <Route path="users" element={<ProtectedPage page="users"><Users /></ProtectedPage>} />
            <Route path="profile" element={<Profile />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
            <Route path="settings" element={<ProtectedPage page="settings"><SettingsPage /></ProtectedPage>} />
            <Route path="*" element={<Navigate to={adminPath()} replace />} />
          </Route>
        </Routes>
      </MutationProvider>
    </AuthProvider>
  );
}

function PublicApp() {
  return (
    <Routes>
      <Route path="/" element={<PublicReservationForm />} />
      <Route path="/book" element={<Navigate to="/" replace />} />
      <Route path="/success" element={<PublicSuccessMessage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const hostMode = config.app.hostMode;

  return (
    <NotificationProvider>
      <Router>
        {hostMode === HOST_MODES.ADMIN && (
          <Routes>
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/admin/*" element={<Navigate to={adminPath()} replace />} />
            <Route path="/*" element={<AdminApp />} />
          </Routes>
        )}
        {hostMode === HOST_MODES.BOOKING && <PublicApp />}
        {hostMode === HOST_MODES.ALL && (
          <Routes>
            <Route path="/" element={<PublicReservationForm />} />
            <Route path="/book" element={<Navigate to="/" replace />} />
            <Route path="/success" element={<PublicSuccessMessage />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Router>
    </NotificationProvider>
  );
}

export default App;
