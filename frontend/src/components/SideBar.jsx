import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Users,
  Sliders,
  LogOut,
  Calendar,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Wallet,
  PieChart,
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage, collapsed, onToggle }) => {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <h2 className="brand-title">Umalila</h2>
          <span className="brand-subtitle">Alahan Panjang</span>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group-title">Operations</div>

        <button
          type="button"
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActivePage('dashboard')}
          title="Overview"
        >
          <LayoutDashboard size={15} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activePage === 'calendar' ? 'active' : ''}`}
          onClick={() => setActivePage('calendar')}
          title="Calendar"
        >
          <Calendar size={15} />
          <span>Calendar</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activePage === 'reservations' ? 'active' : ''}`}
          onClick={() => setActivePage('reservations')}
          title="Reservations"
        >
          <ClipboardList size={15} />
          <span>Reservations</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activePage === 'financial' ? 'active' : ''}`}
          onClick={() => setActivePage('financial')}
          title="Financial"
        >
          <Wallet size={15} />
          <span>Financial</span>
        </button>

        <div className="sidebar-divider" />
        <div className="nav-group-title">Analytics</div>

        <button
          type="button"
          className={`nav-item ${activePage === 'insights' ? 'active' : ''}`}
          onClick={() => setActivePage('insights')}
          title="Dashboard & Insights"
        >
          <PieChart size={15} />
          <span>Dashboard</span>
        </button>

        <div className="sidebar-divider" />
        <div className="nav-group-title">System</div>

        <button
          type="button"
          className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => setActivePage('settings')}
          title="Settings"
        >
          <Sliders size={15} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-item logout-btn"
          onClick={() => console.log('Logging out...')}
          title="Sign Out"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
