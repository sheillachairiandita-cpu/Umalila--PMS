import React from 'react';
import { DollarSign, TrendingUp, Clock, TrendingDown } from 'lucide-react';
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString('id-ID')}`;
}

const KPI_CONFIG = [
  { key: 'totalRevenue', label: 'Total Revenue', icon: DollarSign },
  { key: 'upcomingRevenue', label: 'Upcoming Revenue', icon: TrendingUp },
  { key: 'pendingDeposits', label: 'Pending Deposits', icon: Clock },
  { key: 'totalExpenses', label: 'Total Expenses', icon: TrendingDown },
];

function FinancialKpiCards({ kpis, loading }) {
  return (
    <KpiCardGrid className="kpi-card-grid--four">
      {KPI_CONFIG.map(({ key, label, icon }) => (
        <KpiCard
          key={key}
          icon={icon}
          label={label}
          value={formatRp(kpis?.[key])}
          loading={loading}
        />
      ))}
    </KpiCardGrid>
  );
}

export default FinancialKpiCards;
