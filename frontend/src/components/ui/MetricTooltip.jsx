import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Lightweight inline '?' tooltip for KPI and chart titles.
 */
export default function MetricTooltip({ text, className = '' }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  if (!text) return null;

  return (
    <span
      className={`metric-tooltip ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="metric-tooltip__trigger"
        aria-describedby={open ? tipId : undefined}
        aria-label="Metric explanation"
        tabIndex={0}
      >
        <HelpCircle size={11} strokeWidth={1.5} />
      </button>
      {open && (
        <span id={tipId} role="tooltip" className="metric-tooltip__bubble">
          {text}
        </span>
      )}
    </span>
  );
}
