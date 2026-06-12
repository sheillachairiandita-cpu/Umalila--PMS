import React from 'react';
import { DollarSign, TrendingUp, Clock, Receipt, Wallet, Tag } from 'lucide-react';
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';
import ChartCard from '../ui/ChartCard';
import GaugeChart from '../ui/charts/GaugeChart';
import HorizontalStackedBar from '../ui/charts/HorizontalStackedBar';
import ComboBarLineChart from '../ui/charts/ComboBarLineChart';
import { formatRp } from './dashboardUtils';

const FINANCIAL_KPIS = [
  {
    key: 'grossRevenue',
    label: 'Gross Revenue',
    icon: DollarSign,
    mono: true,
    tooltip: 'Accrual basis: room, add-on, and F&B revenue delivered in this period. Room revenue uses weekday, weekend (Fri–Sun), and holiday tier rates per stay night.',
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
    tooltip: 'Uncollected balance from active, confirmed reservations.',
  },
  {
    key: 'totalExpenses',
    label: 'Total Expenses',
    icon: Receipt,
    mono: true,
    tooltip: 'Approved operational cash outflows in this period.',
  },
];

export default function FinancialOverviewTab({ data, loading }) {
  if (loading) return <div className="dash-loading">Loading financial data…</div>;
  if (!data) return null;

  const netProfit = (Number(data.amountCollected) || 0) - (Number(data.totalExpenses) || 0);

  return (
    <div className="dash-tab-content">
      <KpiCardGrid className="kpi-card-grid--six">
        {FINANCIAL_KPIS.map(({ key, label, icon, mono, tooltip }) => (
          <KpiCard
            key={key}
            icon={icon}
            label={label}
            value={formatRp(data[key])}
            mono={mono}
            tooltip={tooltip}
          />
        ))}
      </KpiCardGrid>

      <KpiCardGrid className="kpi-card-grid--one">
        <KpiCard
          icon={Wallet}
          label="Net Profit"
          value={formatRp(netProfit)}
          mono
          tooltip="Amount collected minus approved expenses — realized cash profit."
        />
      </KpiCardGrid>

      <div className="dash-chart-grid">
        <ChartCard
          title="GOPPAR"
          subtitle="Gross Operating Profit Per Available Room"
          tooltip="Gross operating profit divided by total available room nights in the period. Room revenue reflects tiered weekday, weekend, and holiday rates."
        >
          <GaugeChart
            value={data.goppar}
            max={data.maxGoppar}
            label="Per available room"
            formatValue={formatRp}
          />
        </ChartCard>

        <ChartCard
          title="Expense Breakdown"
          subtitle="By category"
          tooltip="Distribution of approved operational cash outflows across expense categories for the selected date window."
        >
          <HorizontalStackedBar
            segments={data.expenseSegments}
            formatValue={formatRp}
          />
        </ChartCard>

        <ChartCard
          title="Revenue Breakdown"
          subtitle="Accrual by source (before discounts)"
          tooltip="Accrual-based income split by source. Room revenue is calculated from tiered villa rates (weekday Mon–Thu, weekend Fri–Sun, holiday dates)."
        >
          <HorizontalStackedBar
            segments={data.revenueSegments}
            formatValue={formatRp}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Revenue vs Expense Comparison"
        subtitle="Monthly net revenue vs approved expenses"
        tooltip="Monthly net booking revenue (after discounts) compared with approved cash expenses."
        wide
      >
        <ComboBarLineChart
          data={data.monthlyComparison}
          barKey="revenue"
          lineKey="expenses"
        />
      </ChartCard>
    </div>
  );
}
