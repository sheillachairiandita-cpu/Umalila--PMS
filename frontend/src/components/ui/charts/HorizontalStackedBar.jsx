import React from 'react';

/**
 * Single horizontal stacked bar with legend.
 */
export default function HorizontalStackedBar({ segments, formatValue, height = 14 }) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);

  if (!total) {
    return (
      <div className="hstack-bar hstack-bar--empty">
        <span>No data in selected period</span>
      </div>
    );
  }

  return (
    <div className="hstack-bar">
      <div className="hstack-bar__track" style={{ height }}>
        {segments.filter((s) => s.value > 0).map((seg, i) => (
          <div
            key={seg.key || i}
            className="hstack-bar__segment"
            style={{
              width: `${(seg.value / total) * 100}%`,
              background: seg.color,
            }}
            title={`${seg.label}: ${formatValue ? formatValue(seg.value) : seg.value}`}
          />
        ))}
      </div>
      <div className="hstack-bar__legend">
        {segments.filter((s) => s.value > 0).map((seg, i) => (
          <div key={seg.key || i} className="hstack-bar__legend-item">
            <span className="hstack-bar__dot" style={{ background: seg.color }} />
            <span className="hstack-bar__legend-label">{seg.label}</span>
            <span className="hstack-bar__legend-value">
              {formatValue ? formatValue(seg.value) : seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
