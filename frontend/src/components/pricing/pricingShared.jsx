import React from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Button, Alert } from '../ui';
import Modal from '../ui/Modal';
import TableActionButton from '../TableActionButton';

export function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString('id-ID')}`;
}

export function PricingPaneToolbar({ title, description, actionLabel, onAction, actionIcon }) {
  return (
    <div className="pricing-pane__toolbar">
      <div>
        <h4 className="pricing-pane__subtitle">{title}</h4>
        <p className="pricing-pane__desc">{description}</p>
      </div>
      <Button variant="primary" size="sm" icon={actionIcon} onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function PricingLockNotice({ children }) {
  return (
    <div className="pricing-lock-notice">
      <AlertTriangle size={13} />
      <span>{children}</span>
    </div>
  );
}

export function PricingFormError({ message }) {
  if (!message) return null;
  return <div className="pricing-form-error">{message}</div>;
}

export function PricingFormFooter({ onCancel, submitLabel, submitting, cancelLabel = 'Cancel' }) {
  return (
    <div className="pricing-modal__footer">
      <Button variant="secondary" size="sm" type="button" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </Button>
      <Button variant="primary" size="sm" type="submit" loading={submitting} disabled={submitting}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function PricingDeleteModal({
  isOpen,
  title,
  itemName,
  message,
  onClose,
  onConfirm,
  deleting,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header title={title} icon={Trash2} onClose={onClose} />
      <Modal.Body>
        <p className="pms-text-muted" style={{ fontSize: '0.88rem', margin: 0 }}>
          {message || (
            <>
              Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.
            </>
          )}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} loading={deleting} disabled={deleting}>
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function PricingActionCell({ onEdit, onDelete, editTitle = 'Edit', deleteTitle = 'Delete' }) {
  return (
    <div className="table-action-group">
      <TableActionButton title={editTitle} variant="default" onClick={onEdit}>
        <Pencil size={12} />
      </TableActionButton>
      <TableActionButton title={deleteTitle} variant="danger" onClick={onDelete}>
        <Trash2 size={12} />
      </TableActionButton>
    </div>
  );
}

export function PricingLoadingState({ message = 'Loading…' }) {
  return <div className="pricing-loading">{message}</div>;
}

export function PricingErrorState({ message }) {
  return <Alert type="error" message={message} className="pricing-alert" />;
}
