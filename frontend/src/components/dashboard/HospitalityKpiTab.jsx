import React from 'react';
import { BedDouble, DollarSign, BarChart2, Moon } from 'lucide-react';
import { KpiCard, KpiCardGrid } from '../ui/KpiCard';
import ChartCard from '../ui/ChartCard';
import DonutChart from '../ui/charts/DonutChart';
import DualAxisLineChart from '../ui/charts/DualAxisLineChart';
import HistogramChart from '../ui/charts/HistogramChart';
import { formatRpCompact, formatPct, formatNum } from './dashboardUtils';

const HOSPITALITY_KPIS = [
  {
    key: 'occupancyRate',
    label: 'Occupancy Rate',
    icon: BedDouble,
    format: formatPct,
    tooltip: 'The percentage of available rooms occupied by staying guests over the selected period.',
  },
  {
    key: 'adr',
    label: 'ADR (Average Daily Rate)',
    icon: DollarSign,
    format: formatRpCompact,
    mono: true,
    tooltip: 'Average room revenue per sold room-night, based on tiered weekday, weekend (Fri–Sun), and holiday property rates.',
  },
  {
    key: 'revpar',
    label: 'RevPAR (Revenue Per Available Room)',
    icon: BarChart2,
    format: formatRpCompact,
    mono: true,
    tooltip: 'Room revenue divided by available room-nights. Reflects tiered pricing yield across all inventory.',
  },
  {
    key: 'roomNightsSold',
    label: 'Total Room Nights Sold',
    icon: Moon,
    format: formatNum,
    tooltip: 'Total property-nights sold (each property counts separately per night).',
  },
];

export default function HospitalityKpiTab({ data, loading }) {
  if (loading) return <div className="dash-loading">Loading hospitality data…</div>;
  if (!data) return null;

  const sourceTotal = data.bookingSource.reduce((s, seg) => s + seg.value, 0) || 1;

  return (
    <div className="dash-tab-content">
      <KpiCardGrid className="kpi-card-grid--four">
        {HOSPITALITY_KPIS.map(({ key, label, icon, format, mono, tooltip }) => (
          <KpiCard
            key={key}
            icon={icon}
            label={label}
            value={format(data[key])}
            mono={mono}
            tooltip={tooltip}
          />
        ))}
      </KpiCardGrid>

      <ChartCard
        title="Occupancy & RevPAR Trend"
        subtitle="Daily / weekly yield efficiency"
        tooltip="Tracks occupancy percentage against RevPAR over time. RevPAR uses tiered weekday, weekend, and holiday room rates."
        wide
      >
        <DualAxisLineChart
          data={data.trendData}
          formatRight={(v) => formatRpCompact(v).replace('Rp ', '')}
        />
      </ChartCard>

      <div className="dash-chart-grid dash-chart-grid--pair">
        <ChartCard
          title="Booking Source"
          tooltip="Share of reservations attributed to each acquisition channel. Currently all bookings are recorded via WhatsApp (WA)."
        >
          <div className="donut-chart-row">
            <DonutChart
              segments={data.bookingSource}
              size={88}
              strokeWidth={8}
            />
            <div className="donut-chart-row__legend">
              {data.bookingSource.map((s) => (
                <div key={s.label} className="donut-chart-row__item">
                  <span className="donut-chart-row__dot" style={{ background: s.color }} />
                  <span className="donut-chart-row__label">{s.label}</span>
                  <span className="donut-chart-row__pct">
                    {((s.value / sourceTotal) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Booking Lead Time Windows"
          subtitle="Days between reservation and check-in"
          tooltip="How far in advance guests book, grouped into lead-time buckets. Shorter windows suggest last-minute demand; longer windows indicate planned travel."
        >
          <HistogramChart buckets={data.leadTimeBuckets} />
        </ChartCard>
      </div>
    </div>
  );
}
