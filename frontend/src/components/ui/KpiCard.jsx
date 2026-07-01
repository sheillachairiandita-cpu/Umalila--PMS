import React from 'react';
import MetricTooltip from './MetricTooltip';

/**
 * Editorial KPI card — shared across financial, reservations, and dashboard views.
 *
 * @param {object} [delta] - `{ percent, compareLabel }` or `{ isNew: true }` from buildKpiDelta
 * @param {number} [trend] - legacy percent-only delta (deprecated; use delta instead)
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  loading = false,
  sub,
  subWarning = false,
  delta,
  trend,
  mono = false,
  tooltip,
  variant = 'default',
}) {
  const resolvedDelta = delta ?? (
    trend !== undefined && trend !== null
      ? { percent: trend }
      : null
  );

  const showDelta = resolvedDelta && (resolvedDelta.isNew || resolvedDelta.percent !== undefined);
  const up = resolvedDelta?.percent > 0;

  return (
    <div className={`kpi-card${variant === 'warning' ? ' kpi-card--warning' : ''}`}>
      {Icon && (
        <div className={`kpi-card__icon${variant === 'warning' ? ' kpi-card__icon--warning' : ''}`}>
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
      {(sub || showDelta) && (
        <div className="kpi-card__sub">
          {showDelta && (
            <div className="kpi-card__delta">
              {resolvedDelta.isNew ? (
                <span className="kpi-card__trend kpi-card__trend--new">New</span>
              ) : (
                <>
                  <span className={`kpi-card__trend ${up ? 'kpi-card__trend--up' : 'kpi-card__trend--down'}`}>
                    {up ? '▲' : '▼'}
                    {Math.abs(resolvedDelta.percent).toFixed(1)}%
                  </span>
                  {resolvedDelta.compareLabel && (
                    <span className="kpi-card__compare-label">{resolvedDelta.compareLabel}</span>
                  )}
                </>
              )}
            </div>
          )}
          {sub && (
            <span className={subWarning ? 'kpi-card__sub-warn' : undefined}>{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function KpiCardGrid({ children, className = '' }) {
  return <div className={`kpi-card-grid kpi-card-grid--equal ${className}`.trim()}>{children}</div>;
}

export default KpiCard;
