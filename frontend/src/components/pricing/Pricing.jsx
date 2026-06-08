import React, { useState } from 'react';
import { Home, Package, UtensilsCrossed, Tag, ShieldAlert } from 'lucide-react';
import VillaPricing from './VillaPricing';
import AddonsPricing from './AddonsPricing';
import MenuPricing from './MenuPricing';
import Discount from './Discount';

// ─────────────────────────────────────────────────────────────────────────────
// TAB DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  {
    key: 'villas',
    label: 'Villas',
    icon: Home,
    component: VillaPricing,
    description: 'Property units and nightly rates',
  },
  {
    key: 'addons',
    label: 'Add-ons',
    icon: Package,
    component: AddonsPricing,
    description: 'Extra services and billing units',
  },
  {
    key: 'menu',
    label: 'Menu',
    icon: UtensilsCrossed,
    component: MenuPricing,
    description: 'F&B items and prices',
  },
  {
    key: 'discounts',
    label: 'Discounts',
    icon: Tag,
    component: Discount,
    description: 'Promo codes and promotional rules',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRICING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function Pricing() {
  const [activeTab, setActiveTab] = useState('villas');

  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.component || VillaPricing;

  return (
    <div className="pricing-page">
      <style>{PRICING_CSS}</style>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="pricing-page__header">
        <div>
          <h2 className="pricing-page__title">Pricing Management</h2>
          <p className="pricing-page__subtitle">
            Configure rates, services, and discounts across all property units.
          </p>
        </div>
        <div className="pricing-lock-banner">
          <ShieldAlert size={14} />
          <span>
            Rate changes apply to <strong>future reservations only</strong> — confirmed bookings are locked.
          </span>
        </div>
      </div>

      {/* ── Tab navigation ──────────────────────────────────────── */}
      <nav className="pricing-tab-nav">
        {TABS.map(({ key, label, icon: Icon, description }) => (
          <button
            key={key}
            type="button"
            className={`pricing-tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={15} />
            <span className="pricing-tab-label">{label}</span>
            <span className="pricing-tab-desc">{description}</span>
          </button>
        ))}
      </nav>

      {/* ── Active tab content ───────────────────────────────────── */}
      <div className="pricing-tab-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED CSS — scoped to .pricing-* namespace
// ─────────────────────────────────────────────────────────────────────────────
const PRICING_CSS = `
/* ── Page shell ─────────────────────────────────── */
.pricing-page {
  padding: var(--page-pad-y) var(--page-pad-x);
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100vh;
  background: var(--bg);
}

.pricing-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.pricing-page__title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--navy-dark);
  letter-spacing: -0.025em;
  margin: 0 0 3px;
}

.pricing-page__subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

/* Lock banner */
.pricing-lock-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  color: #78350f;
  max-width: 420px;
}

.pricing-lock-banner svg { flex-shrink: 0; color: #d97706; }

/* ── Tab navigation ─────────────────────────────── */
.pricing-tab-nav {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 8px;
}

.pricing-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-sans);
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  color: var(--text-mid);
}

.pricing-tab-btn svg {
  color: var(--text-light);
  margin-bottom: 2px;
  transition: color 0.15s;
}

.pricing-tab-btn:hover {
  background: var(--bg-subtle);
  border-color: var(--border);
}

.pricing-tab-btn.active {
  background: var(--bg-subtle);
  border-color: var(--navy);
  color: var(--navy-dark);
  box-shadow: inset 0 0 0 1px var(--navy);
}

.pricing-tab-btn.active svg { color: var(--navy); }

.pricing-tab-label {
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.2;
}

.pricing-tab-desc {
  font-size: 0.68rem;
  color: var(--text-light);
  font-weight: 400;
  line-height: 1.3;
}

.pricing-tab-btn.active .pricing-tab-desc { color: var(--text-muted); }

/* ── Tab content wrapper ────────────────────────── */
.pricing-tab-content {
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

/* ── Pane (inner each tab) ──────────────────────── */
.pricing-pane {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pricing-pane__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.pricing-pane__subtitle {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 3px;
}

.pricing-pane__desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0;
}

/* ── Buttons ───────────────────────────────────── */
.pricing-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-md);
  border: none;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.15s;
  white-space: nowrap;
}

.pricing-btn--primary {
  background: var(--navy-dark);
  color: #fff;
}
.pricing-btn--primary:hover:not(:disabled) { background: var(--navy-mid); }
.pricing-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

.pricing-btn--ghost {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.pricing-btn--ghost:hover:not(:disabled) { background: var(--bg-subtle); }

.pricing-btn--danger {
  background: var(--red);
  color: #fff;
}
.pricing-btn--danger:hover:not(:disabled) { background: #b91c1c; }
.pricing-btn--danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Filter pills ───────────────────────────────── */
.pricing-filter-pills {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.pricing-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.15s;
}

.pricing-filter-pill:hover { border-color: var(--navy); color: var(--navy); }
.pricing-filter-pill.active { background: var(--navy); color: #fff; border-color: var(--navy); }

.pricing-pill-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  border-radius: 10px;
  font-size: 0.6rem;
  font-weight: 700;
  background: rgba(255,255,255,0.25);
}

.pricing-filter-pill:not(.active) .pricing-pill-count {
  background: var(--bg-subtle);
  color: var(--text-muted);
}

/* ── Table ──────────────────────────────────────── */
.pricing-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-white);
}

.pricing-table {
  width: 100%;
  border-collapse: collapse;
}

.pricing-table th {
  padding: 8px 12px;
  background: var(--bg);
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.67rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  text-align: left;
}

.pricing-table th.text-center { text-align: center; }
.pricing-table th.text-right  { text-align: right;  }

.pricing-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 0.83rem;
  color: var(--text-mid);
  vertical-align: middle;
}

.pricing-table td.text-center { text-align: center; }
.pricing-table td.text-right  { text-align: right;  }

.pricing-table tbody tr:last-child td { border-bottom: none; }
.pricing-table tbody tr:hover { background: var(--bg-muted); }

.pricing-name-cell {
  font-weight: 600;
  color: var(--text);
}

.pricing-rate-cell {
  font-weight: 700;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.82rem;
}

.pricing-desc-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.pricing-subtext {
  display: block;
  font-size: 0.7rem;
  color: var(--text-light);
  font-weight: 400;
  margin-top: 1px;
}

.pricing-empty {
  text-align: center;
  color: var(--text-light);
  font-size: 0.83rem;
  padding: 28px 16px !important;
}

.pricing-loading {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.83rem;
  padding: 28px;
}

.pricing-error {
  background: var(--red-bg);
  border: 1px solid #fecaca;
  color: var(--red-text);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 0.83rem;
}

.pricing-text-muted {
  color: var(--text-light);
}

/* ── Badges ─────────────────────────────────────── */
.pricing-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.pricing-badge--green {
  background: var(--green-bg);
  color: var(--green-text);
}

.pricing-badge--blue {
  background: #eff6ff;
  color: #1e40af;
}

.pricing-badge--slate {
  background: var(--slate-bg);
  color: var(--slate-text);
}

/* ── ID and code pills ──────────────────────────── */
.pricing-id-pill {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--navy);
  background: #eff6ff;
  padding: 2px 7px;
  border-radius: 6px;
}

.pricing-code-pill {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #7c3aed;
  background: #f5f3ff;
  padding: 3px 9px;
  border-radius: 6px;
  text-transform: uppercase;
}

/* ── Status toggle ──────────────────────────────── */
.pricing-status-toggle {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--border-mid);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-sans);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: all 0.15s;
}

.pricing-status-toggle.active {
  background: var(--green-bg);
  border-color: #6ee7b7;
  color: var(--green-text);
}

.pricing-status-toggle:hover { opacity: 0.8; }

/* ── Action buttons ─────────────────────────────── */
.pricing-action-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.pricing-action-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-white);
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
  font-family: var(--font-sans);
}

.pricing-action-btn--edit:hover {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}

.pricing-action-btn--delete:hover {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
}

/* ── Info banner ────────────────────────────────── */
.pricing-info-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  color: #0c4a6e;
  line-height: 1.5;
}

.pricing-info-banner svg { flex-shrink: 0; margin-top: 1px; color: #0284c7; }
.pricing-info-banner code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  background: rgba(2, 132, 199, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ── Modal system ───────────────────────────────── */
.pricing-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 24px;
}

.pricing-modal {
  background: var(--bg-white);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.pricing-modal--sm {
  max-width: 400px;
}

.pricing-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.pricing-modal__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pricing-modal__title-group h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.pricing-modal__icon { color: var(--navy); }

.pricing-modal__close {
  background: none;
  border: none;
  color: var(--text-light);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  font-family: var(--font-sans);
  transition: color 0.15s;
}
.pricing-modal__close:hover { color: var(--text); }

/* Lock notice inside modal */
.pricing-lock-notice {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 20px;
  background: #fefce8;
  border-bottom: 1px solid #fde68a;
  font-size: 0.75rem;
  color: #78350f;
  flex-shrink: 0;
}

.pricing-lock-notice svg { flex-shrink: 0; color: #d97706; }

/* Form layout inside modal */
.pricing-modal__form {
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.pricing-form-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.pricing-form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pricing-form-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-mid);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pricing-form-group input[type="text"],
.pricing-form-group input[type="number"],
.pricing-form-group select,
.pricing-form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg-white);
  transition: border-color 0.15s, box-shadow 0.15s;
  -webkit-appearance: none;
}

.pricing-form-group input:focus,
.pricing-form-group select:focus,
.pricing-form-group textarea:focus {
  outline: none;
  border-color: var(--navy);
  box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.08);
}

.pricing-form-group textarea { resize: vertical; min-height: 72px; }

.pricing-form-error {
  grid-column: 1 / -1;
  padding: 9px 12px;
  background: var(--red-bg);
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  color: var(--red-text);
}

.pricing-form-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 2px 0 0;
  line-height: 1.4;
}

/* Billing unit toggle */
.pricing-toggle-row {
  display: flex;
  gap: 8px;
}

.pricing-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-mid);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.15s;
}

.pricing-toggle-btn.active {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}

.pricing-toggle-btn:not(.active):hover {
  border-color: var(--navy);
  color: var(--navy);
}

/* Checkbox label */
.pricing-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.83rem;
  color: var(--text-mid);
  cursor: pointer;
  font-weight: 500;
}

.pricing-checkbox-label input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--navy);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  border: none;
}

/* Modal footer */
.pricing-modal__footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

/* ── Responsive ─────────────────────────────────── */
@media (max-width: 900px) {
  .pricing-tab-nav {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .pricing-tab-nav {
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 5px;
  }

  .pricing-tab-desc { display: none; }

  .pricing-modal__form {
    grid-template-columns: 1fr;
  }

  .pricing-form-row {
    grid-template-columns: 1fr;
  }

  .pricing-page__header {
    flex-direction: column;
  }

  .pricing-lock-banner {
    max-width: 100%;
  }
}
`;

export default Pricing;
