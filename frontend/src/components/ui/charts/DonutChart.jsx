import React from 'react';

export default function DonutChart({ segments, size = 80, strokeWidth = 10, centerLabel }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, sg) => s + sg.value, 0) || 1;

  let offset = 0;

  return (
    <div className="donut-chart" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((sg, i) => {
          const dash = (sg.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={sg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset * circ / total}
              style={{ transition: 'all 0.6s ease' }}
            />
          );
          offset += sg.value;
          return el;
        })}
      </svg>
      {centerLabel && (
        <div className="donut-chart__center">{centerLabel}</div>
      )}
    </div>
  );
}
