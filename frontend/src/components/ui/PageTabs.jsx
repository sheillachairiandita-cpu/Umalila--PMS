import React from 'react';

/**
 * Page-level tab switcher — matches Dashboard.jsx tab UI (source of truth).
 */
function PageTabs({ tabs, activeTab, onChange, ariaLabel = 'Page sections' }) {
  return (
    <div className="page-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={activeTab === key}
          className={`page-tab-btn ${activeTab === key ? 'page-tab-btn--active' : ''}`}
          onClick={() => onChange(key)}
        >
          {Icon && <Icon size={13} />}
          {label}
          {badge != null && badge > 0 && (
            <span className="page-tab-badge">{badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default PageTabs;
