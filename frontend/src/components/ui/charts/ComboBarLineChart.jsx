import React from 'react';

/**
 * Combo chart — bar columns for revenue, line overlays for expenses and net profit.
 */
export default function ComboBarLineChart({
  data,
  formatValue,
  barKey = 'revenue',
  lineKey = 'expenses',
  lineKey2 = null,
}) {
  if (!data?.length) {
    return <div className="combo-chart combo-chart--empty">No monthly data in range</div>;
  }

  const keys = [barKey, lineKey, ...(lineKey2 ? [lineKey2] : [])];
  const maxVal = Math.max(...data.flatMap((d) => keys.map((k) => Math.abs(d[k] || 0))), 1);
  const w = 100 / data.length;
  const pad = Math.min(w * 0.25, 4);

  const linePoints = data.map((d, i) => {
    const x = i * w + w / 2;
    const y = 100 - ((d[lineKey] || 0) / maxVal) * 88 - 6;
    return `${x},${y}`;
  }).join(' ');

  const line2Points = lineKey2
    ? data.map((d, i) => {
      const x = i * w + w / 2;
      const val = Math.max(d[lineKey2] || 0, 0);
      const y = 100 - (val / maxVal) * 88 - 6;
      return `${x},${y}`;
    }).join(' ')
    : null;

  return (
    <div className="combo-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="combo-chart__svg">
        {data.map((d, i) => {
          const barH = ((d[barKey] || 0) / maxVal) * 88;
          const x = i * w + pad;
          const barW = w - pad * 2;
          return (
            <rect
              key={d.label}
              x={x}
              y={100 - barH - 6}
              width={barW}
              height={barH}
              fill="var(--navy)"
              opacity={0.75}
              rx={0.8}
            />
          );
        })}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--red)"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => {
          const x = i * w + w / 2;
          const y = 100 - ((d[lineKey] || 0) / maxVal) * 88 - 6;
          return (
            <circle
              key={`dot-${d.label}`}
              cx={x}
              cy={y}
              r={1.2}
              fill="var(--red)"
            />
          );
        })}
        {lineKey2 && line2Points && (
          <>
            <polyline
              points={line2Points}
              fill="none"
              stroke="var(--green)"
              strokeWidth={1.2}
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
            {data.map((d, i) => {
              const x = i * w + w / 2;
              const val = Math.max(d[lineKey2] || 0, 0);
              const y = 100 - (val / maxVal) * 88 - 6;
              return (
                <circle
                  key={`dot2-${d.label}`}
                  cx={x}
                  cy={y}
                  r={1.2}
                  fill="var(--green)"
                />
              );
            })}
          </>
        )}
      </svg>
      <div className="combo-chart__labels">
        {data.map((d) => (
          <span key={d.label} className="combo-chart__label">{d.label}</span>
        ))}
      </div>
      <div className="combo-chart__legend">
        <span className="combo-chart__legend-item">
          <span className="combo-chart__swatch combo-chart__swatch--bar" />
          Revenue
        </span>
        <span className="combo-chart__legend-item">
          <span className="combo-chart__swatch combo-chart__swatch--line" />
          Expenses
        </span>
        {lineKey2 && (
          <span className="combo-chart__legend-item">
            <span className="combo-chart__swatch combo-chart__swatch--line2" />
            Net Profit
          </span>
        )}
      </div>
    </div>
  );
}
