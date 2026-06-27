import React, { useState } from 'react';
import { Home, Package, UtensilsCrossed, Tag, ShieldAlert } from 'lucide-react';
import PageTabs from '../ui/PageTabs';
import PropertyPricing from './PropertyPricing';
import AddonsPricing from './AddonsPricing';
import MenuPricing from './MenuPricing';
import Discount from './Discount';

const TABS = [
  { key: 'properties', label: 'Properties', icon: Home, component: PropertyPricing },
  { key: 'addons', label: 'Add-ons', icon: Package, component: AddonsPricing },
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed, component: MenuPricing },
  { key: 'discounts', label: 'Discounts', icon: Tag, component: Discount },
];

function Pricing() {
  const [activeTab, setActiveTab] = useState('properties');

  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.component || PropertyPricing;

  return (
    <div className="pricing-page">
     
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
