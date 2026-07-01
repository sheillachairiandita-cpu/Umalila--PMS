import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRpCompact } from '../../dashboard/dashboardUtils';

const ADR_COLOR = '#7c3aed';

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

export default function AdrTrendChart({ data }) {
  if (!data?.length) {
    return <div className="recharts-dash-chart recharts-dash-chart--empty">No ADR data in range</div>;
  }

  return (
    <div className="recharts-dash-chart recharts-dash-chart--compact">
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
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
            wrapperStyle={{ fontSize: '0.65rem', paddingTop: 4 }}
          />
          <Line
            type="monotone"
            dataKey="adr"
            name="ADR"
            stroke={ADR_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
