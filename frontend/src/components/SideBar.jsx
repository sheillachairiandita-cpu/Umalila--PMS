// Sidebar.jsx
import React from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  BedDouble, 
  Users, 
  Sliders, 
  LogOut,
  Calendar,
  ClipboardList
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="brand-title">Umalila</h2>
        <span className="brand-subtitle">Alahan Panjang</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group-title">Operations</div>
        
        <button 
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActivePage('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button 
          className={`nav-item ${activePage === 'calendar' ? 'active' : ''}`}  
          onClick={() => setActivePage('calendar')}                              
        >
          <Calendar size={18} />  
          <span>Calendar</span>    
        </button>

        <button 
          className={`nav-item ${activePage === 'reservations' ? 'active' : ''}`}
          onClick={() => setActivePage('reservations')}
        >
          <ClipboardList size={18} />
          <span>Reservations</span>
        </button>

        <button 
          className={`nav-item ${activePage === 'frontdesk' ? 'active' : ''}`}
          onClick={() => setActivePage('frontdesk')}
        >
          <CalendarDays size={18} />
          <span>Front Desk</span>
        </button>

        <button 
          className={`nav-item ${activePage === 'villas' ? 'active' : ''}`}
          onClick={() => setActivePage('villas')}
        >
          <BedDouble size={18} />
          <span>Villa Units</span>
        </button>

        <button 
          className={`nav-item ${activePage === 'guests' ? 'active' : ''}`}
          onClick={() => setActivePage('guests')}
        >
          <Users size={18} />
          <span>Guest Directory</span>
        </button>

        <div className="sidebar-divider" />
        <div className="nav-group-title">System</div>

        <button 
          className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => setActivePage('settings')}
        >
          <Sliders size={18} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item logout-btn" onClick={() => console.log('Logging out...')}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;