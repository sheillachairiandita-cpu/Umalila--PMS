import React from 'react';
import { X } from 'lucide-react';
import { MODAL_BASE, COLORS, SPACING } from '../../styles/theme';

/**
 * Modal Component
 * Reusable modal wrapper with header and overlay
 * 
 * @component
 * @example
 * <Modal isOpen={isOpen} onClose={handleClose}>
 *   <Modal.Header title="Confirm Action" icon={AlertIcon} />
 *   <Modal.Body>
 *     <p>Are you sure?</p>
 *   </Modal.Body>
 *   <Modal.Footer>
 *     <Button variant="secondary" onClick={handleClose}>Cancel</Button>
 *     <Button variant="danger" onClick={handleConfirm}>Delete</Button>
 *   </Modal.Footer>
 * </Modal>
 */
function Modal({ isOpen, onClose, children, size = 'md', className = '' }) {
  if (!isOpen) return null;

  const sizeStyles = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '500px' },
    lg: { maxWidth: '700px' },
    xl: { maxWidth: '900px' },
    '2xl': { maxWidth: '1100px' },
  };

  return (
    <div
      style={MODAL_BASE.overlay}
      className={`modal-overlay ${className}`}
      onClick={onClose ? onClose : undefined}
    >
      <div
        style={{
          ...MODAL_BASE.content,
          ...sizeStyles[size],
        }}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Modal Header - for use within Modal component
 */
Modal.Header = function ModalHeader({ title, icon: Icon, onClose, subtitle }) {
  return (
    <div style={MODAL_BASE.header} className="modal-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
        {Icon && <Icon size={20} color={COLORS.success} />}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: '0.85rem', color: COLORS.textTertiary, margin: '4px 0 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="modal-header__close"
          aria-label="Close dialog"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textTertiary,
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
};

/**
 * Modal Body - for use within Modal component
 */
Modal.Body = function ModalBody({ children, className = '' }) {
  return (
    <div style={{ marginBottom: SPACING.xxl }} className={`modal-body ${className}`}>
      {children}
    </div>
  );
};

/**
 * Modal Footer - for use within Modal component
 */
Modal.Footer = function ModalFooter({ children, align = 'flex-end', className = '' }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: SPACING.md,
        justifyContent: align,
        paddingTop: SPACING.lg,
        borderTop: `1px solid ${COLORS.slate200}`,
      }}
      className={`modal-footer ${className}`}
    >
      {children}
    </div>
  );
};

export default Modal;
