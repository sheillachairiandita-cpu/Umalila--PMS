import React from 'react';

/**
 * Minimal semi-circular gauge for GOPPAR and similar metrics.
 */
export default function GaugeChart({ value, max, label, formatValue }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const size = 120;
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const circ = Math.PI * r;
  const dash = pct * circ;
  const cx = size / 2;
  const cy = size / 2 + 8;

  const display = formatValue ? formatValue(value) : value;

  return (
    <div className="gauge-chart">
      <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
        <path
          d={`M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
          fill="none"
          stroke="var(--bg-subtle)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
          fill="none"
          stroke="var(--navy)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="gauge-chart__value">{display}</div>
      {label && <div className="gauge-chart__label">{label}</div>}
    </div>
  );
}
