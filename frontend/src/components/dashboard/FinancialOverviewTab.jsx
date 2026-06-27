import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  Receipt,
  Wallet,
  Calculator,
  PiggyBank,
} from 'lucide-react';
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';
import ChartCard from '../ui/ChartCard';
import HorizontalStackedBar from '../ui/charts/HorizontalStackedBar';
import ComboBarLineChart from '../ui/charts/ComboBarLineChart';
import PropertyProfitabilityTable from './PropertyProfitabilityTable';
import { formatRpCompact } from './dashboardUtils';

const FINANCIAL_KPIS = [
  {
    key: 'grossRevenue',
    label: 'Gross Revenue',
    icon: DollarSign,
    mono: true,
    tooltip: 'Total revenue from room stays, add-ons, and F&B for reservations overlapping this period.',
  },
  {
    key: 'amountCollected',
    label: 'Amount Collected',
    icon: Wallet,
    mono: true,
    tooltip: 'Cash basis: actual payments received during this period.',
  },
  {
    key: 'pendingDeposit',
    label: 'Pending Deposit',
    icon: Clock,
    mono: true,
    tooltip: 'Outstanding balances not yet paid on active reservations.',
  },
  {
    key: 'netProfit',
    label: 'Net Profit',
    icon: PiggyBank,
    mono: true,
    tooltip: 'Gross Profit minus Total Expenses.',
  },
];

export default function FinancialOverviewTab({ data, loading }) {
  if (loading) return <div className="dash-loading">Loading financial data…</div>;
  if (!data) return null;

  return (
    <div className="dash-tab-content">
      <KpiCardGrid className="kpi-card-grid--profit">
        {FINANCIAL_KPIS.map(({ key, label, icon, mono, tooltip }) => (
          <KpiCard
            key={key}
            icon={icon}
            label={label}
            value={formatRpCompact(data[key])}
            mono={mono}
            tooltip={tooltip}
          />
        ))}
      </KpiCardGrid>

      <div className="dash-chart-grid">
        <ChartCard
          title="Revenue Breakdown"
          subtitle="Room, add-on, and F&B"
          tooltip="Accrual-based revenue split by source for the selected period."
        >
          <HorizontalStackedBar
            segments={data.revenueSegments}
            formatValue={formatRpCompact}
          />
        </ChartCard>

        <ChartCard
          title="Expense Breakdown"
          subtitle="By category"
          tooltip="Distribution of approved operational expenses across categories."
        >
          <HorizontalStackedBar
            segments={data.expenseSegments}
            formatValue={formatRpCompact}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Revenue vs Expense Trend"
        subtitle="Monthly revenue, expenses, and net profit"
        tooltip="Monthly gross revenue compared with expenses and resulting net profit."
        wide
      >
        <ComboBarLineChart
          data={data.monthlyComparison}
          barKey="revenue"
          lineKey="expenses"
          lineKey2="netProfit"
        />
      </ChartCard>

      <ChartCard
        title="Property Profitability Ranking"
        subtitle="Sorted by net profit"
        tooltip="Per-property revenue, COGS, and profit. Expenses allocated proportionally by revenue share."
        wide
      >
        <PropertyProfitabilityTable rows={data.propertyProfitability} loading={loading} />
      </ChartCard>
    </div>
  );
}
