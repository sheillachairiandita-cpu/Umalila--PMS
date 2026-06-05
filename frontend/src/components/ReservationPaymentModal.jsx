import React, { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { Modal, Button, Input, Alert, FileUpload, Badge } from './ui';
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';
function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString()}`;
}

function SummaryRow({ label, value, bold = false }) {
  return (
    <>
      <div style={{ color: COLORS.textSecondary, fontWeight: bold ? 600 : 400 }}>{label}</div>
      <div
        style={{
          fontWeight: bold ? 700 : 600,
          color: COLORS.textPrimary,
          textAlign: 'right',
        }}
      >
        {value}
      </div>
    </>
  );
}

function ReservationPaymentModal({ isOpen, booking, onClose, onPaymentRecorded }) {
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [partialAmount, setPartialAmount] = useState('');
  const [partialProof, setPartialProof] = useState(null);
  const [partialSubmitting, setPartialSubmitting] = useState(false);

  const [finalAmount, setFinalAmount] = useState('');
  const [finalProof, setFinalProof] = useState(null);
  const [finalSubmitting, setFinalSubmitting] = useState(false);

  const fetchFinancialSummary = async () => {
    if (!booking) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/financial-summary`);
      if (!response.ok) throw new Error('Failed to load financial summary');
      setFinancialData(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && booking) {
      fetchFinancialSummary();
      setPartialAmount('');
      setPartialProof(null);
      setFinalAmount('');
      setFinalProof(null);
      setError(null);
    } else {
      setFinancialData(null);
    }
  }, [isOpen, booking?.id]);

  const submitPayment = async (paymentType, amount, proof, setSubmitting) => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }
    if (!proof) {
      setError('Proof of payment is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentType,
          paymentMethod: 'transfer',
          proofFileName: proof.name,
          proofData: proof.dataUrl,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record payment');
      }
      await fetchFinancialSummary();
      onPaymentRecorded?.();
      if (paymentType === 'partial') {
        setPartialAmount('');
        setPartialProof(null);
      } else {
        setFinalAmount('');
        setFinalProof(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !booking) return null;

  const isComplete = financialData?.paymentStatus === 'complete';
  const hasPartial = financialData?.hasPartialPayment;
  const canRecordPartial = !isComplete && financialData?.paymentStatus === 'pending';
  const canRecordFinal = !isComplete && hasPartial;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <Modal.Header
        title="Payment Management"
        icon={DollarSign}
        subtitle={booking.guest_full_name || booking.guests?.full_name}
        onClose={onClose}
      />

      <Modal.Body>
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {loading && (
          <div style={{ textAlign: 'center', padding: SPACING.xxl, color: COLORS.textTertiary }}>
            Loading financial details…
          </div>
        )}

        {!loading && financialData && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: SPACING.xl,
              alignItems: 'start',
            }}
          >
            {/* Left Panel — Summary */}
            <div
              style={{
                background: COLORS.slate50,
                borderRadius: 8,
                padding: SPACING.lg,
                border: `1px solid ${COLORS.slate200}`,
              }}
            >
              <h3
                style={{
                  margin: `0 0 ${SPACING.lg}`,
                  fontSize: TYPOGRAPHY.caption.fontSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: COLORS.textTertiary,
                }}
              >
                Invoice Summary
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: SPACING.sm,
                  fontSize: '0.9rem',
                  marginBottom: SPACING.md,
                }}
              >
                <SummaryRow label="Accommodation" value={formatRp(financialData.accommodation)} />
                <SummaryRow label="Extra Beds" value={formatRp(financialData.extraBeds)} />
                <SummaryRow label="Extra Breakfast" value={formatRp(financialData.extraBreakfast)} />

                {(financialData.menuItems || []).length > 0 && (
                  <div style={{ gridColumn: '1 / -1', marginTop: SPACING.sm }}>
                    <p
                      style={{
                        margin: `0 0 ${SPACING.sm}`,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: COLORS.textTertiary,
                        textTransform: 'uppercase',
                      }}
                    >
                      Menu Items
                    </p>
                    {(financialData.menuItems || []).map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.82rem',
                          color: COLORS.textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>{formatRp(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(financialData.menuItems || []).length === 0 && (
                  <SummaryRow label="Menu Items" value={formatRp(financialData.menuTotal)} />
                )}
              </div>

              <div style={{ height: 1, background: COLORS.slate200, margin: `${SPACING.md} 0` }} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: SPACING.sm,
                  fontSize: '0.95rem',
                }}
              >
                <SummaryRow label="Total" value={formatRp(financialData.total)} bold />
                <SummaryRow label="Amount Paid" value={formatRp(financialData.amountPaid)} />
                <SummaryRow
                  label="Balance Due"
                  value={formatRp(financialData.balanceDue)}
                  bold
                />
              </div>

              <div style={{ marginTop: SPACING.lg }}>
                <span style={{ fontSize: '0.8rem', color: COLORS.textTertiary, marginRight: SPACING.sm }}>
                  Payment Status
                </span>
                <Badge type="payment" value={financialData.paymentStatus} />
              </div>
            </div>

            {/* Right Panel — Transaction Input */}
            <div>
              <h3
                style={{
                  margin: `0 0 ${SPACING.lg}`,
                  fontSize: TYPOGRAPHY.caption.fontSize,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: COLORS.textTertiary,
                }}
              >
                Record Transactions
              </h3>

              {isComplete ? (
                <Alert
                  type="success"
                  title="Payment Complete"
                  message="This reservation has been fully paid. No further payments are required."
                />
              ) : (
                <>
                  {/* Partial Payment */}
                  <div
                    style={{
                      padding: SPACING.lg,
                      border: `1px solid ${COLORS.slate200}`,
                      borderRadius: 8,
                      marginBottom: SPACING.lg,
                      opacity: canRecordPartial ? 1 : 0.55,
                    }}
                  >
                    <p
                      style={{
                        margin: `0 0 ${SPACING.md}`,
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: COLORS.textPrimary,
                      }}
                    >
                      Partial Payment (DP)
                    </p>

                    <Input
                      type="number"
                      label="Amount"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      disabled={!canRecordPartial || partialSubmitting}
                      style={{ marginBottom: SPACING.md }}
                    />

                    <FileUpload
                      label="Proof of Payment"
                      value={partialProof}
                      onChange={setPartialProof}
                      disabled={!canRecordPartial || partialSubmitting}
                      required
                      style={{ marginBottom: SPACING.md }}
                    />

                    <Button
                      variant="primary"
                      fullWidth
                      size="md"
                      loading={partialSubmitting}
                      disabled={!canRecordPartial}
                      onClick={() =>
                        submitPayment('partial', partialAmount, partialProof, setPartialSubmitting)
                      }
                    >
                      Save Partial Payment
                    </Button>

                    {!canRecordPartial && !isComplete && hasPartial && (
                      <p style={{ margin: `${SPACING.sm} 0 0`, fontSize: '0.75rem', color: COLORS.textTertiary }}>
                        Partial payment already recorded.
                      </p>
                    )}
                  </div>

                  {/* Final Payment */}
                  <div
                    style={{
                      padding: SPACING.lg,
                      border: `1px solid ${COLORS.slate200}`,
                      borderRadius: 8,
                      opacity: canRecordFinal ? 1 : 0.55,
                    }}
                  >
                    <p
                      style={{
                        margin: `0 0 ${SPACING.md}`,
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: COLORS.textPrimary,
                      }}
                    >
                      Final Payment
                    </p>

                    <Input
                      type="number"
                      label="Amount"
                      value={finalAmount}
                      onChange={(e) => setFinalAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      disabled={!canRecordFinal || finalSubmitting}
                      style={{ marginBottom: SPACING.md }}
                    />

                    <FileUpload
                      label="Proof of Payment"
                      value={finalProof}
                      onChange={setFinalProof}
                      disabled={!canRecordFinal || finalSubmitting}
                      required
                      style={{ marginBottom: SPACING.md }}
                    />

                    <Button
                      variant="success"
                      fullWidth
                      size="md"
                      loading={finalSubmitting}
                      disabled={!canRecordFinal}
                      onClick={() =>
                        submitPayment('final', finalAmount, finalProof, setFinalSubmitting)
                      }
                    >
                      Save Final Payment
                    </Button>

                    {!canRecordFinal && !isComplete && (
                      <p style={{ margin: `${SPACING.sm} 0 0`, fontSize: '0.75rem', color: COLORS.textTertiary }}>
                        Record a partial payment before submitting the final payment.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ReservationPaymentModal;
