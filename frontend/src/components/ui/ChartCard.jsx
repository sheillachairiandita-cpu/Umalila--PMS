import React from 'react';
import MetricTooltip from './MetricTooltip';

/**
 * Shared chart container — editorial card layout for dashboard analytics.
 */
export default function ChartCard({ title, subtitle, tooltip, children, wide = false, className = '' }) {
  return (
    <div className={`chart-card ${wide ? 'chart-card--wide' : ''} ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="chart-card__header">
          <div className="chart-card__heading">
            {title && (
              <span className="chart-card__title">
                {title}
                {tooltip && <MetricTooltip text={tooltip} />}
              </span>
            )}
            {subtitle && <span className="chart-card__sub">{subtitle}</span>}
          </div>
        </div>
      )}
      <div className="chart-card__body">{children}</div>
    </div>
  );
}
