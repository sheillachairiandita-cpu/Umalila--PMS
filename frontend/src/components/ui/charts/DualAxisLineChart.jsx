import React from 'react';

/**
 * Dual-axis line chart — left axis %, right axis monetary.
 */
export default function DualAxisLineChart({
  data,
  leftKey = 'occupancy',
  rightKey = 'revpar',
  formatLeft = (v) => `${v.toFixed(0)}%`,
  formatRight = (v) => v.toLocaleString(),
}) {
  if (!data?.length) {
    return <div className="dual-line-chart dual-line-chart--empty">No trend data in range</div>;
  }

  const maxLeft = Math.max(...data.map((d) => d[leftKey] || 0), 100);
  const maxRight = Math.max(...data.map((d) => d[rightKey] || 0), 1);
  const step = 100 / Math.max(data.length - 1, 1);

  const leftPoints = data.map((d, i) => {
    const x = i * step;
    const y = 100 - ((d[leftKey] || 0) / maxLeft) * 88 - 6;
    return `${x},${y}`;
  }).join(' ');

  const rightPoints = data.map((d, i) => {
    const x = i * step;
    const y = 100 - ((d[rightKey] || 0) / maxRight) * 88 - 6;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="dual-line-chart">
      <div className="dual-line-chart__axis dual-line-chart__axis--left">
        <span>{formatLeft(maxLeft)}</span>
        <span>{formatLeft(maxLeft / 2)}</span>
        <span>0%</span>
      </div>
      <div className="dual-line-chart__plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="dual-line-chart__svg">
          <polyline
            points={leftPoints}
            fill="none"
            stroke="var(--navy)"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={rightPoints}
            fill="none"
            stroke="var(--green)"
            strokeWidth={1.2}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="dual-line-chart__labels">
          {data.map((d) => (
            <span key={d.label} className="dual-line-chart__label">{d.label}</span>
          ))}
        </div>
      </div>
      <div className="dual-line-chart__axis dual-line-chart__axis--right">
        <span>{formatRight(maxRight)}</span>
        <span>{formatRight(maxRight / 2)}</span>
        <span>0</span>
      </div>
      <div className="dual-line-chart__legend">
        <span className="dual-line-chart__legend-item">
          <span className="dual-line-chart__line dual-line-chart__line--left" />
          Occupancy %
        </span>
        <span className="dual-line-chart__legend-item">
          <span className="dual-line-chart__line dual-line-chart__line--right" />
          RevPAR
        </span>
      </div>
    </div>
  );
}
