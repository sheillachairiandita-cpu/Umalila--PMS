import React from 'react';

export function PendingQueueCard({ id, meta, description, sideContent, actions }) {
  return (
    <div className="pending-queue-card">
      <div className="pending-queue-card__main">
        {id != null && <div className="pending-queue-card__id">{id}</div>}
        {meta && <div className="pending-queue-card__meta">{meta}</div>}
        {description && <p className="pending-queue-card__desc">{description}</p>}
      </div>
      <div className="pending-queue-card__side">
        {sideContent}
        {actions && <div className="pending-queue-card__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function PendingQueueList({ children, empty = false, emptyMessage = 'Nothing awaiting review.' }) {
  if (empty) {
    return (
      <div className="empty-state empty-state--dashed pending-queue-empty">
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>{emptyMessage}</p>
      </div>
    );
  }

  return <div className="pending-queue-list">{children}</div>;
}

export default PendingQueueCard;
