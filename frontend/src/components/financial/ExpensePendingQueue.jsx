import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../ui';
import { PendingQueueCard, PendingQueueList } from '../ui/PendingQueueCard';
import { EXPENSE_CATEGORY_LABELS } from '../../utils/statusConfigs';

import { formatRp } from '../../utils/formatCurrency';

function ExpensePendingQueue({ expenses, loading, onApprove, onReject }) {
  const [actionId, setActionId] = useState(null);

  const pending = expenses.filter((e) => e.status === 'pending');

  const handleAction = async (id, action) => {
    setActionId(id);
    try {
      if (action === 'approve') await onApprove(id);
      else await onReject(id);
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading pending approvals…</div>;
  }

  if (pending.length === 0) {
    return (
      <PendingQueueList
        empty
        emptyMessage="No expenses awaiting approval."
      />
    );
  }

  return (
    <PendingQueueList>
      {pending.map((expense) => (
        <PendingQueueCard
          key={expense.id}
          id={expense.displayId || '—'}
          meta={(
            <>
              <span>{EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}</span>
              <span className="pending-queue-card__dot">·</span>
              <span>{expense.transactionDate}</span>
            </>
          )}
          description={expense.description || '—'}
          sideContent={(
            <span className="pending-queue-card__amount">{formatRp(expense.amount)}</span>
          )}
          actions={(
            <>
              <Button
                variant="success"
                size="sm"
                icon={Check}
                loading={actionId === expense.id}
                onClick={() => handleAction(expense.id, 'approve')}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={X}
                loading={actionId === expense.id}
                onClick={() => handleAction(expense.id, 'reject')}
              >
                Reject
              </Button>
            </>
          )}
        />
      ))}
    </PendingQueueList>
  );
}

export default ExpensePendingQueue;
