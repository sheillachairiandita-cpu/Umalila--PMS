import React from 'react';
import { ArrowRight } from 'lucide-react';

const STEPS = [
  { key: 'revenue', label: 'Revenue', color: 'var(--navy)' },
  { key: 'cogs', label: 'COGS', color: 'var(--red)' },
  { key: 'grossProfit', label: 'Gross Profit', color: 'var(--green)' },
  { key: 'expenses', label: 'Expenses', color: '#d97706' },
  { key: 'netProfit', label: 'Net Profit', color: 'var(--navy)' },
];

export default function ProfitabilityFlow({ values, formatValue }) {
  const fmt = formatValue || ((v) => v);

  return (
    <div className="profit-flow">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="profit-flow__step">
            <span className="profit-flow__dot" style={{ background: step.color }} />
            <span className="profit-flow__label">{step.label}</span>
            <span className="profit-flow__value">{fmt(values?.[step.key] || 0)}</span>
          </div>
          {i < STEPS.length - 1 && (
            <ArrowRight size={16} className="profit-flow__arrow" aria-hidden />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
