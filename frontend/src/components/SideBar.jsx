import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { hasPermission } from '../auth/permissions';
import { getNavItemsForRole } from '../auth/navConfig';

const Sidebar = ({
  activePage,
  collapsed,
  tabletCompact = false,
  mobileOpen = false,
  onMobileClose,
  onToggle,
  onLogout,
  hideCollapseToggle = false,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  const navGroups = useMemo(
    () => getNavItemsForRole(user?.role, hasPermission),
    [user?.role],
  );

  useEffect(() => {
    if (!settingsOpen) return undefined;

    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const handleNavClick = (path) => {
    navigate(path);
    onMobileClose?.();
  };

  const handleProfileClick = () => {
    setSettingsOpen(false);
    navigate('/admin/profile');
    onMobileClose?.();
  };

  const handleSignOut = () => {
    setSettingsOpen(false);
    onLogout();
  };

  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    tabletCompact ? 'sidebar--tablet-compact' : '',
    mobileOpen ? 'sidebar--mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <h2 className="brand-title">Umalila</h2>
        </div>
        {!hideCollapseToggle && (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group, groupIdx) => (
          <React.Fragment key={group.group}>
            {groupIdx > 0 && <div className="sidebar-divider" />}
            <div className="nav-group-title">{group.group}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.page}
                  type="button"
                  className={`nav-item ${activePage === item.page ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.path)}
                  title={item.label}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-actions">
          <button
            type="button"
            className={`sidebar-footer-icon-btn ${activePage === 'profile' ? 'sidebar-footer-icon-btn--active' : ''}`}
            onClick={handleProfileClick}
            title="Profile"
            aria-label="Profile"
          >
            <User size={18} />
          </button>

          <div className="sidebar-footer-settings" ref={settingsRef}>
            <button
              type="button"
              className={`sidebar-footer-icon-btn ${settingsOpen ? 'sidebar-footer-icon-btn--active' : ''}`}
              onClick={() => setSettingsOpen((open) => !open)}
              title="Settings"
              aria-label="Settings"
              aria-expanded={settingsOpen}
            >
              <Settings size={18} />
            </button>

            {settingsOpen && (
              <div className="sidebar-settings-menu" role="menu">
                <button
                  type="button"
                  className="sidebar-settings-menu__item sidebar-settings-menu__item--danger"
                  role="menuitem"
                  onClick={handleSignOut}
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
