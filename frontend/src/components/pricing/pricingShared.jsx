import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Button, Alert, SectionHeaderRow } from '../ui';
import Modal from '../ui/Modal';
import TableActionButton from '../TableActionButton';
import TablePagination from '../ui/TablePagination';
import { useMutation } from '../../context/MutationProvider';

export const PRICING_PAGE_SIZE = 10;

export function usePaginatedRows(rows, pageSize = PRICING_PAGE_SIZE) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedRows = rows.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return {
    paginatedRows,
    currentPage,
    totalPages,
    setCurrentPage,
    startIdx,
    pageSize,
  };
}

export function PricingTablePagination({ rows, pagination }) {
  const { currentPage, totalPages, setCurrentPage, startIdx, pageSize } = pagination;

  return (
    <>
      {rows.length > 0 && (
        <div className="pricing-table-result-count">
          {`Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, rows.length)} of ${rows.length} record${rows.length !== 1 ? 's' : ''}`}
        </div>
      )}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </>
  );
}

export function usePricingMutation() {
  const { runMutation, isMutating } = useMutation();

  const saveItem = useCallback(async ({
    isEdit,
    entityName,
    execute,
    refresh,
    onClose,
    setError,
    successMessage,
    overlayMessage,
  }) => {
    setError?.(null);
    const result = await runMutation({
      mutation: execute,
      refresh,
      successMessage: successMessage || (isEdit
        ? `${entityName} updated successfully.`
        : `${entityName} created successfully.`),
      overlayMessage: overlayMessage || (isEdit ? 'Saving changes…' : 'Creating…'),
    });
    if (result.ok) {
      onClose?.();
    } else {
      setError?.(result.error?.message || `Failed to save ${entityName.toLowerCase()}.`);
    }
    return result;
  }, [runMutation]);

  const deleteItem = useCallback(async ({
    entityName,
    execute,
    refresh,
    onDone,
    successMessage,
    overlayMessage,
  }) => {
    const result = await runMutation({
      mutation: execute,
      refresh,
      successMessage: successMessage || `${entityName} deleted successfully.`,
      overlayMessage: overlayMessage || `Deleting ${entityName.toLowerCase()}…`,
    });
    if (result.ok) onDone?.();
    return result;
  }, [runMutation]);

  return { saveItem, deleteItem, isMutating, runMutation };
}

export { formatRp } from '../../utils/formatCurrency';

export function PricingPaneToolbar({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  actionVariant = 'primary',
}) {
  return (
    <SectionHeaderRow
      className="pricing-pane__toolbar"
      title={title}
      hint={description}
      actions={(
        <Button variant={actionVariant} size="sm" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    />
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
      {onDelete && (
        <TableActionButton title={deleteTitle} variant="danger" onClick={onDelete}>
          <Trash2 size={12} />
        </TableActionButton>
      )}
    </div>
  );
}

export function PricingLoadingState({ message = 'Loading…' }) {
  return <div className="pricing-loading">{message}</div>;
}

export function PricingErrorState({ message }) {
  return <Alert type="error" message={message} className="pricing-alert" />;
}
