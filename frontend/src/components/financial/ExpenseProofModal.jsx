import React from 'react';
import { ImageIcon } from 'lucide-react';
import { Modal, Button } from '../ui';
import { EXPENSE_CATEGORY_LABELS } from '../../utils/statusConfigs';
import { formatRp } from '../../utils/formatCurrency';

function isPdfUrl(url) {
  return /\.pdf(\?|$)/i.test(url || '');
}

function ExpenseProofModal({ expense, onClose }) {
  if (!expense) return null;

  const title = expense.displayId
    ? `Proof of Payment — ${expense.displayId}`
    : 'Proof of Payment';

  return (
    <Modal isOpen={!!expense} onClose={onClose} size="lg">
      <Modal.Header title={title} icon={ImageIcon} />
      <Modal.Body>
        <div className="expense-proof-meta">
          <div className="expense-proof-meta__row">
            <span>Category</span>
            <span>{EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}</span>
          </div>
          <div className="expense-proof-meta__row">
            <span>Amount</span>
            <span>{formatRp(expense.amount)}</span>
          </div>
          <div className="expense-proof-meta__row">
            <span>Date</span>
            <span>{expense.transactionDate}</span>
          </div>
        </div>

        {expense.proof ? (
          <div className="expense-proof-viewer">
            {isPdfUrl(expense.proof) ? (
              <iframe
                title="Expense proof document"
                src={expense.proof}
                className="expense-proof-viewer__frame"
              />
            ) : (
              <img
                src={expense.proof}
                alt="Proof of payment"
                className="expense-proof-viewer__image"
              />
            )}
          </div>
        ) : (
          <div className="empty-state empty-state--dashed">
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>No proof document attached.</p>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ExpenseProofModal;
