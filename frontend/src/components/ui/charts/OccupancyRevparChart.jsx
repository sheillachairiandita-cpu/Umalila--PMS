import React from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRpCompact } from '../../dashboard/dashboardUtils';

const OCCUPANCY_COLOR = '#1e3a8a';
const REVPAR_COLOR = '#0d9488';

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
            {entry.dataKey === 'occupancy'
              ? `${(Number(entry.value) || 0).toFixed(1)}%`
              : formatRpCompact(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OccupancyRevparChart({ data, occupancyTarget = 60 }) {
  if (!data?.length) {
    return <div className="recharts-dash-chart recharts-dash-chart--empty">No trend data in range</div>;
  }

  return (
    <div className="recharts-dash-chart occupancy-revpar-chart">
      <span className="occupancy-revpar-chart__axis-title occupancy-revpar-chart__axis-title--left">
        Occupancy Rate
      </span>
      <div className="occupancy-revpar-chart__plot">
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--text-light)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              width={42}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--text-light)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatRpCompact(v).replace('Rp ', '')}
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              yAxisId="left"
              y={occupancyTarget}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{
                value: 'Target',
                position: 'right',
                fill: '#9ca3af',
                fontSize: 11,
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="occupancy"
              name="Occupancy %"
              stroke={OCCUPANCY_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revpar"
              name="RevPAR"
              stroke={REVPAR_COLOR}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <span className="occupancy-revpar-chart__axis-title occupancy-revpar-chart__axis-title--right">
        RevPAR
      </span>
      <div className="recharts-dash-legend recharts-dash-legend--centered occupancy-revpar-chart__legend">
        <span className="recharts-dash-legend__item">
          <span className="recharts-dash-legend__line recharts-dash-legend__line--occupancy" />
          Occupancy %
        </span>
        <span className="recharts-dash-legend__item">
          <span className="recharts-dash-legend__line recharts-dash-legend__line--revpar" />
          RevPAR
        </span>
      </div>
    </div>
  );
}
