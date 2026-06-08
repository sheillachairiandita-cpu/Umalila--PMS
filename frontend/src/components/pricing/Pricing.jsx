import React, { useState } from 'react';
import { Home, Package, UtensilsCrossed, Tag, ShieldAlert } from 'lucide-react';
import VillaPricing from './VillaPricing';
import AddonsPricing from './AddonsPricing';
import MenuPricing from './MenuPricing';
import Discount from './Discount';

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

function Pricing() {
  const [activeTab, setActiveTab] = useState('villas');

  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.component || VillaPricing;

  return (
    <div className="pricing-page">
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

      <nav className="pricing-tab-nav" aria-label="Pricing sections">
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

      <div className="pricing-tab-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default Pricing;
