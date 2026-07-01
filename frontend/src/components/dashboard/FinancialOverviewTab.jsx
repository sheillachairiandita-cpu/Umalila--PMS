import React from 'react';
import {
  DollarSign,
  Clock,
  Wallet,
  PiggyBank,
} from 'lucide-react';
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';
import ChartCard from '../ui/ChartCard';
import HorizontalStackedBar from '../ui/charts/HorizontalStackedBar';
import RevenueExpenseTrendChart from '../ui/charts/RevenueExpenseTrendChart';
import PropertyProfitabilityTable from './PropertyProfitabilityTable';
import { formatRp } from '../../utils/formatCurrency';
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

  const trendSubtitle = data.trendGranularity === 'weekly'
    ? 'Weekly revenue, expenses, and net profit'
    : 'Daily revenue, expenses, and net profit';

  return (
    <div className="dash-tab-content">
      <KpiCardGrid className="kpi-card-grid--profit">
        {FINANCIAL_KPIS.map(({ key, label, icon, mono, tooltip }) => {
          const isPendingDeposit = key === 'pendingDeposit';
          const showAlert = isPendingDeposit && data.pendingDepositAlert;

          return (
            <KpiCard
              key={key}
              icon={icon}
              label={label}
              value={formatRp(data[key])}
              mono={mono}
              tooltip={tooltip}
              delta={data.kpiDeltas?.[key]}
              variant={showAlert ? 'warning' : 'default'}
              sub={showAlert ? 'Exceeds collected amount' : undefined}
              subWarning={showAlert}
            />
          );
        })}
      </KpiCardGrid>

      <div className="dash-chart-grid dash-chart-grid--breakdown-trend">
        <div className="dash-chart-stack">
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
          subtitle={trendSubtitle}
          tooltip="Gross revenue compared with expenses and resulting net profit, grouped by day or week within the selected range."
          className="dash-chart-trend"
        >
          <RevenueExpenseTrendChart data={data.revenueExpenseTrend} />
        </ChartCard>
      </div>

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
