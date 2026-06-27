import React from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Section title row — matches Overview.jsx section-header-row pattern.
 */
export default function SectionHeaderRow({
  icon: Icon,
  iconColor = 'var(--navy)',
  title,
  meta,
  hint,
  count,
  countVariant,
  actions,
  className = '',
}) {
  const hasActions = count != null || actions;

  return (
    <div className={`section-header-row${className ? ` ${className}` : ''}`}>
      <div className="section-header-row__title">
        {Icon && <Icon size={15} color={iconColor} />}
        <span>{title}</span>
        {meta != null && meta !== '' && (
          <span className="section-header-row__meta">{meta}</span>
        )}
        {hint && (
          <span className="pricing-pane__info-tip" title={hint}>
            <HelpCircle size={14} aria-label={hint} />
          </span>
        )}
      </div>
      {hasActions && (
        <div className="section-header-row__actions">
          {count != null && (
            <span
              className={`section-card__count${countVariant === 'accent' ? ' section-card__count--accent' : ''}`}
            >
              {count}
            </span>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
