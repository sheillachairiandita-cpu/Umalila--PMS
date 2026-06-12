import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import MetricTooltip from './MetricTooltip';

/**
 * Editorial KPI card — shared across financial, reservations, and dashboard views.
 */
export function KpiCard({ icon: Icon, label, value, loading = false, sub, trend, mono = false, tooltip }) {
  const up = trend > 0;

  return (
    <div className="kpi-card">
      {Icon && (
        <div className="kpi-card__icon">
          <Icon size={16} />
        </div>
      )}
      <span className="kpi-card__label">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </span>
      <span
        className={loading ? 'kpi-card__value kpi-card__value--loading' : 'kpi-card__value'}
        style={{ fontFamily: mono ? 'var(--font-mono)' : undefined }}
      >
        {loading ? '—' : value}
      </span>
      {(sub || trend !== undefined) && (
        <div className="kpi-card__sub">
          {trend !== undefined && (
            <span className={`kpi-card__trend ${up ? 'kpi-card__trend--up' : 'kpi-card__trend--down'}`}>
              {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function KpiCardGrid({ children, className = '' }) {
  return <div className={`kpi-card-grid ${className}`.trim()}>{children}</div>;
}

export default KpiCard;
