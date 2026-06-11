import React from 'react';
import { FileText } from 'lucide-react';
import { Modal, Button } from '../ui';
import { FinancialSummaryTable } from './FinancialSummaryTable'; // Import shared component

function FinancialDetailsModal({ isOpen, bookingId, guestName, displayId, onClose }) {
  if (!isOpen) return null;

  const titleSuffix = displayId
    ? `${guestName || 'Guest'} (${displayId})`
    : (guestName || 'Guest');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header title={`Financial Details — ${titleSuffix}`} icon={FileText} />
      <Modal.Body>
        {/* Render the extracted shared item layout */}
        <FinancialSummaryTable bookingId={bookingId} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default FinancialDetailsModal;