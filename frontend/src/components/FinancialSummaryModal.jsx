import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { Modal, Button, Input, Alert } from './ui';
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';

function FinancialSummaryModal({ isOpen, booking, onClose, onPaymentRecorded }) {
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && booking) {
      fetchFinancialSummary();
    } else {
      // Clear data when modal closes
      setFinancialData(null);
      setPaymentAmount('');
    }
  }, [isOpen, booking]);

  const fetchFinancialSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/financial-summary`);
      if (!response.ok) throw new Error('Failed to fetch financial summary');
      const data = await response.json();
      setFinancialData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paymentMethod,
          notes: ''
        })
      });

      if (!response.ok) throw new Error('Failed to record payment');

      setPaymentAmount('');
      await fetchFinancialSummary();
      if (onPaymentRecorded) onPaymentRecorded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title="Financial Summary"
        icon={DollarSign}
        onClose={onClose}
      />

      <Modal.Body>
        {/* Guest Info */}
        {booking && (
          <div style={{
            background: COLORS.slate50,
            padding: SPACING.md,
            borderRadius: 8,
            marginBottom: SPACING.lg
          }}>
            <p style={{ fontSize: '0.85rem', color: COLORS.textSecondary, margin: '0 0 4px 0' }}>Guest</p>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>
              {booking.guests?.full_name || 'Walk-in Guest'}
            </p>
            <p style={{ fontSize: '0.8rem', color: COLORS.textTertiary, margin: '4px 0 0 0' }}>
              {booking.check_in_date} to {booking.check_out_date}
            </p>
          </div>
        )}

        {/* Status Indicators */}
        {loading && (
          <div style={{ textAlign: 'center', padding: SPACING.xxl, color: COLORS.textTertiary }}>
            Loading financial details...
          </div>
        )}

        {error && (
          <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
        )}

        {/* Financial Breakdown - Only evaluated if financialData is present and not loading */}
        {!loading && financialData && (
          <>
            {/* Line Items */}
            <div style={{ marginBottom: SPACING.lg }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: SPACING.md,
                fontSize: '0.9rem',
                marginBottom: SPACING.md
              }}>
                <div style={{ color: COLORS.textSecondary }}>Accommodation</div>
                <div style={{ fontWeight: 600, color: COLORS.textPrimary, textAlign: 'right' }}>
                  Rp {(financialData.accommodation || 0).toLocaleString()}
                </div>

                <div style={{ color: COLORS.textSecondary }}>Food & Beverage</div>
                <div style={{ fontWeight: 600, color: COLORS.textPrimary, textAlign: 'right' }}>
                  Rp {(financialData.fb || 0).toLocaleString()}
                </div>

                <div style={{ color: COLORS.textSecondary }}>Add-ons</div>
                <div style={{ fontWeight: 600, color: COLORS.textPrimary, textAlign: 'right' }}>
                  Rp {(financialData.addons || 0).toLocaleString()}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: COLORS.slate200, margin: `${SPACING.md} 0` }} />

              {/* Total */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: SPACING.md,
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: SPACING.lg
              }}>
                <div style={{ color: COLORS.textPrimary }}>Total</div>
                <div style={{ color: COLORS.success }}>
                  Rp {(financialData.total || 0).toLocaleString()}
                </div>
              </div>

              {/* Payment Status */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: SPACING.md,
                fontSize: '0.9rem',
                marginBottom: SPACING.md
              }}>
                <div style={{ color: COLORS.textSecondary }}>Amount Paid</div>
                <div style={{ fontWeight: 600, color: COLORS.textPrimary, textAlign: 'right' }}>
                  Rp {(financialData.amountPaid || 0).toLocaleString()}
                </div>

                <div style={{ color: COLORS.textSecondary }}>Reminder (Outstanding)</div>
                <div style={{
                  fontWeight: 600,
                  color: (financialData.reminder || 0) > 0 ? COLORS.danger : COLORS.success,
                  textAlign: 'right'
                }}>
                  Rp {(financialData.reminder || 0).toLocaleString()}
                </div>
              </div>

              {/* Balance Status Banner */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: SPACING.md,
                fontSize: '0.95rem',
                fontWeight: 600,
                padding: SPACING.md,
                background: financialData.paymentStatus === 'complete' ? COLORS.successBg : COLORS.warningBg,
                borderRadius: 8,
                marginTop: SPACING.md
              }}>
                <div style={{ color: COLORS.textPrimary }}>Status</div>
                <div style={{
                  textAlign: 'right',
                  color: financialData.paymentStatus === 'complete' ? COLORS.successText : 
                         financialData.paymentStatus === 'partial' ? COLORS.warningText : COLORS.dangerText
                }}>
                  {financialData.paymentStatus === 'complete' && '✓ Complete'}
                  {financialData.paymentStatus === 'partial' && '◐ Partial'}
                  {financialData.paymentStatus === 'pending' && '✗ Pending'}
                </div>
              </div>
            </div>

            {/* Payment Recording Form */}
            {financialData.paymentStatus !== 'complete' && (
              <form onSubmit={handleRecordPayment} style={{
                marginTop: SPACING.xxl,
                paddingTop: SPACING.lg,
                borderTop: `1px solid ${COLORS.slate200}`
              }}>
                <p style={{
                  fontSize: TYPOGRAPHY.caption.fontSize,
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  marginBottom: SPACING.md,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Record Payment
                </p>

                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                  step="0.01"
                  min="0"
                  label="Amount"
                  fullWidth
                  size="md"
                  style={{ marginBottom: SPACING.md }}
                />

                <div style={{ marginBottom: SPACING.lg }}>
                  <label style={{
                    display: 'block',
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: TYPOGRAPHY.label.fontWeight,
                    color: COLORS.textSecondary,
                    marginBottom: SPACING.sm
                  }}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: `${SPACING.sm} ${SPACING.md}`,
                      border: `1px solid ${COLORS.slate200}`,
                      borderRadius: 6,
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      color: COLORS.textPrimary
                    }}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Bank Transfer</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="success"
                  disabled={submitting || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  loading={submitting}
                  fullWidth
                  size="md"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </Button>
              </form>
            )}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default FinancialSummaryModal;