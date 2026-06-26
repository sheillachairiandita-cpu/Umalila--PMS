import React from 'react';

/**
 * Clean histogram for bucketed counts.
 */
export default function HistogramChart({ buckets, formatValue }) {
  const max = Math.max(...buckets.map((b) => b.value), 1);

  if (!buckets.some((b) => b.value > 0)) {
    return <div className="histogram-chart histogram-chart--empty">No bookings in range</div>;
  }

  return (
    <div className="histogram-chart">
      {buckets.map((b) => {
        const h = Math.max(4, (b.value / max) * 100);
        return (
          <div key={b.label} className="histogram-chart__col">
            <div className="histogram-chart__bar-wrap">
              <div
                className="histogram-chart__bar"
                style={{ height: `${h}%` }}
                title={`${b.label}: ${formatValue ? formatValue(b.value) : b.value}`}
              />
            </div>
            <span className="histogram-chart__value">
              {formatValue ? formatValue(b.value) : b.value}
            </span>
            <span className="histogram-chart__label">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}
