import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign } from 'lucide-react';
import { Modal, Button, Input, Alert, FileUpload } from '../ui';
import SummaryModal from '../financial/SummaryModal';
import { useMutation } from '../../context/MutationProvider';

async function uploadReceipt(bookingId, proof, paymentType) {
  if (!proof?.dataUrl) return null;

  const response = await fetch(`/api/bookings/${bookingId}/upload-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileData: proof.dataUrl,
      fileName: proof.name,
      fileType: proof.type,
      paymentType,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to upload receipt file.');
  }
  const resData = await response.json();
  return resData.publicUrl;
}

function ReservationPaymentModal({
  isOpen,
  booking,
  bookingId: bookingIdProp,
  guestName: guestNameProp,
  onClose,
  onPaymentRecorded,
  onPaymentSaved,
}) {
  const bookingId = booking?.id || bookingIdProp;
  const guestName = booking?.guest_full_name || guestNameProp;
  const displayId = booking?.display_id;
  const { runMutation } = useMutation();

  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const [partialAmount, setPartialAmount] = useState('');
  const [partialProof, setPartialProof] = useState(null);
  const [partialSubmitting, setPartialSubmitting] = useState(false);

  const [finalAmount, setFinalAmount] = useState('');
  const [finalProof, setFinalProof] = useState(null);
  const [finalSubmitting, setFinalSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSummary(null);
      setError(null);
      setPartialAmount('');
      setPartialProof(null);
      setFinalAmount('');
      setFinalProof(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (summary) {
      if (summary.paymentStatus === 'pending') {
        setPartialAmount(String(summary.total * 0.5));
        setFinalAmount('');
      } else {
        setPartialAmount('');
        setFinalAmount(String(summary.balanceDue));
      }
    }
  }, [summary]);

  const handleDataLoaded = useCallback((dataFromTable) => {
    setSummary(dataFromTable);
  }, []);

  const handlePaymentComplete = () => {
    const callback = onPaymentRecorded || onPaymentSaved;
    if (callback) callback();
  };

  const submitPayment = async (type, amount, proof, setLoader) => {
    if (!amount || Number(amount) <= 0) {
      setError('Please provide a valid numeric payment amount.');
      return;
    }
    if (!proof) {
      setError('Please upload a valid proof of payment receipt image.');
      return;
    }

    setLoader(true);
    setError(null);

    const result = await runMutation({
      mutation: async () => {
        const publicReceiptUrl = await uploadReceipt(bookingId, proof, type);

        const res = await fetch(`/api/bookings/${bookingId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentType: type,
            amount: Number(amount),
            receiptUrl: publicReceiptUrl,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to process financial record assignment.');
        }

        return res.json();
      },
      refresh: async () => {
        handlePaymentComplete();
      },
      successMessage: type === 'partial'
        ? 'Partial payment recorded successfully.'
        : 'Final payment recorded successfully.',
      overlayMessage: 'Processing payment…',
    });

    setLoader(false);

    if (result.ok) {
      if (type === 'partial') {
        setPartialAmount('');
        setPartialProof(null);
      } else {
        setFinalAmount('');
        setFinalProof(null);
      }
      onClose();
    } else {
      setError(result.error?.message || 'Failed to process payment.');
    }
  };

  if (!isOpen || !bookingId) return null;

  const isPending = summary?.paymentStatus === 'pending';
  const isComplete = summary?.paymentStatus === 'complete';
  const bookingRef = displayId || summary?.displayId || summary?.invoiceNumber;
  const titleSuffix = bookingRef ? `${guestName || 'Guest'}` : (guestName || 'Guest');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <Modal.Header title={`Payment — ${titleSuffix}`} icon={DollarSign} />

      <Modal.Body className="payment-modal-body">
        <div className="payment-modal-summary">
          <SummaryModal
            embedded
            isOpen={isOpen}
            bookingId={bookingId}
            onDataLoaded={handleDataLoaded}
          />
        </div>

        <div className="payment-modal-form">
          {error && <Alert type="error" message={error} />}

          {isComplete ? (
            <div className="payment-modal-settled">
              <div className="payment-modal-settled__icon">✓</div>
              <h4 className="payment-modal-settled__title">Folio Billed & Settled</h4>
              <p className="payment-modal-settled__text">
                This folio has been fully paid. No further payments are required.
              </p>
            </div>
          ) : (
            <div className="payment-modal-forms">
              <div className={`payment-form-section ${isPending ? '' : 'payment-form-section--disabled'}`}>
                <h5 className="payment-form-section__title">1. Down-Payment (Deposit)</h5>
                <Input
                  type="number"
                  label="Amount to Record"
                  value={partialAmount}
                  onChange={setPartialAmount}
                  disabled={!isPending || partialSubmitting}
                />
                <FileUpload
                  label="Proof of Deposit"
                  value={partialProof}
                  onChange={setPartialProof}
                  disabled={!isPending || partialSubmitting}
                />
                <Button
                  variant="primary"
                  fullWidth
                  loading={partialSubmitting}
                  disabled={!isPending}
                  onClick={() => submitPayment('partial', partialAmount, partialProof, setPartialSubmitting)}
                >
                  Save Down-Payment
                </Button>
              </div>

              <div className={`payment-form-section ${isPending ? 'payment-form-section--disabled' : ''}`}>
                <h5 className="payment-form-section__title">2. Final Settlement</h5>
                <Input
                  type="number"
                  label="Settlement Amount"
                  value={finalAmount}
                  onChange={setFinalAmount}
                  disabled={isComplete || isPending || finalSubmitting}
                />
                <FileUpload
                  label="Proof of Final Settlement"
                  value={finalProof}
                  onChange={setFinalProof}
                  disabled={isComplete || isPending || finalSubmitting}
                />
                <Button
                  variant="success"
                  fullWidth
                  loading={finalSubmitting}
                  disabled={isComplete || isPending}
                  onClick={() => submitPayment('final', finalAmount, finalProof, setFinalSubmitting)}
                >
                  Save Final Settlement
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ReservationPaymentModal;
