import React from 'react';
import { getStatusConfig } from '../../utils/statusConfigs';

/**
 * Badge Component
 * Displays colored status/phase indicators.
 * Sizing comes from App.css (.badge)
 */
function Badge({ type = 'status', value, label, icon, className = '', customColor, customBg }) {
  const config = getStatusConfig(value, type);

  const style = {
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
