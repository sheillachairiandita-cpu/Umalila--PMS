import React from 'react';
import { getStatusConfig } from '../../utils/statusConfigs';

/**
 * Badge Component
 * Displays colored status/phase indicators.
 *
 * @example
 * <Badge type="status" value="confirmed" />
 * <Badge type="phase" value="arrival" icon="→" />
 */
function Badge({ type = 'status', value, label, icon, className = '', customColor, customBg }) {
  const config = getStatusConfig(value, type);

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    background: customBg || config.bg,
    color: customColor || config.color,
  };

  return (
    <span style={style} className={`badge badge-${type}-${value} ${className}`}>
      {icon && <span>{icon}</span>}
      <span>{label || config.label}</span>
    </span>
  );
}

export default Badge;
