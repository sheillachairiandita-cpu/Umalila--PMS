import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRpCompact } from '../../dashboard/dashboardUtils';

const COLORS = {
  revenue: '#1e3a8a',
  expenses: '#dc2626',
  netProfit: '#059669',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="recharts-dash-tooltip">
      <div className="recharts-dash-tooltip__label">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="recharts-dash-tooltip__row">
          <span
            className="recharts-dash-tooltip__dot"
            style={{ background: entry.color }}
          />
          <span>{entry.name}</span>
          <span className="recharts-dash-tooltip__value">
            {formatRpCompact(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueExpenseTrendChart({ data }) {
  if (!data?.length) {
    return <div className="recharts-dash-chart recharts-dash-chart--empty">No trend data in range</div>;
  }

  return (
    <div className="recharts-dash-chart">
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-light)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-light)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatRpCompact(v).replace('Rp ', '')}
            width={52}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: '0.65rem', paddingTop: 8 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={COLORS.revenue}
            fill={COLORS.revenue}
            fillOpacity={0.15}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke={COLORS.expenses}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="netProfit"
            name="Net Profit"
            stroke={COLORS.netProfit}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
