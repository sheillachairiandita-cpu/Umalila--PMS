import React, { useState } from 'react';
import { Home, Package, UtensilsCrossed, Tag, ShieldAlert } from 'lucide-react';
import PageTabs from '../ui/PageTabs';
import VillaPricing from './VillaPricing';
import AddonsPricing from './AddonsPricing';
import MenuPricing from './MenuPricing';
import Discount from './Discount';

const TABS = [
  { key: 'villas', label: 'Villas', icon: Home, component: VillaPricing },
  { key: 'addons', label: 'Add-ons', icon: Package, component: AddonsPricing },
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed, component: MenuPricing },
  { key: 'discounts', label: 'Discounts', icon: Tag, component: Discount },
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

      <PageTabs
        ariaLabel="Pricing sections"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={TABS}
      />

      <div className="pricing-tab-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default Pricing;
