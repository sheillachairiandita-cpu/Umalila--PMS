import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button } from '../ui';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';

import { formatRp } from '../../utils/formatCurrency';
import { computeIncomeTotals, pickIncomeAmounts } from '../../utils/financialUtils';
import { apiFetch } from '../../api/client';

function formatMetaValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function ChargeSection({ title, lines }) {
  if (!lines?.length) return null;

  return (
    <>
      <tr className="financial-summary-section-row">
        <td colSpan={4}>{title}</td>
      </tr>
      {lines.map((line, idx) => (
        <tr key={`${title}-${line.name || line.description}-${idx}`}>
          <td className="financial-summary-item">{line.description || line.name}</td>
          <td className="text-center">{line.quantity}</td>
          <td className="text-right">{formatRp(line.unitPrice ?? line.unit_price)}</td>
          <td className="text-right financial-summary-subtotal">{formatRp(line.subtotal)}</td>
        </tr>
      ))}
    </>
  );
}

function SummaryContent({ data }) {
  const bookingRef = data.displayId || data.invoiceNumber;

  const accommodationLines = data.accommodationLines?.length
    ? data.accommodationLines
    : (data.lineItems || []).filter((line) => line.type === 'accommodation');

  const addonLines = data.addonLines?.length
    ? data.addonLines
    : (data.lineItems || []).filter((line) => line.type === 'addon');

  const menuLines = data.menuLines?.length
    ? data.menuLines
    : (data.lineItems || []).filter((line) => line.type === 'menu');

  const chargeLines = [...accommodationLines, ...addonLines, ...menuLines].filter(
    (line) => (line.subtotal ?? 0) >= 0
  );

  const discountLines = data.discountLines?.length
    ? data.discountLines
    : (data.lineItems || []).filter((line) => line.type === 'discount' || (line.subtotal ?? 0) < 0);

  const discountAmount = Number(data.discountAmount) || discountLines.reduce(
    (sum, line) => sum + Math.abs(Number(line.subtotal) || 0),
    0
  );

  const chargeSubtotal = chargeLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
  const incomeTotals = computeIncomeTotals({
    ...pickIncomeAmounts(data),
    subtotalBeforeDiscount: Number(data.subtotalBeforeDiscount) || chargeSubtotal,
    discountAmount,
  });
  const subtotalBeforeDiscount = incomeTotals.subtotalBeforeDiscount;
  const summaryTotal = incomeTotals.total;
  const summaryBalanceDue = incomeTotals.balanceDue;

  const hasSections = accommodationLines.length > 0 || addonLines.length > 0 || menuLines.length > 0;

  return (
    <div className="financial-summary-container">
      <div className="financial-meta-header">
        <div className="financial-meta-row">
          <span className="financial-meta-label">Booking ID</span>
          <span className="financial-meta-value financial-meta-value--mono">{bookingRef}</span>
        </div>

        <div className="financial-meta-row">
          <span className="financial-meta-label">Properties</span>
          <span className="financial-meta-value">{data.propertyNames || '—'}</span>
        </div>

        <div className="financial-meta-row">
          <span className="financial-meta-label">Stay Period</span>
          <span className="financial-meta-value">
            {data.checkIn && data.checkOut ? `${data.checkIn} → ${data.checkOut}` : '—'}
          </span>
        </div>

        <div className="financial-meta-row">
          <span className="financial-meta-label">Number of Guest</span>
          <span className="financial-meta-value">{formatMetaValue(data.totalGuests)}</span>
        </div>

        {data.discountCode && (
          <div className="financial-meta-row">
            <span className="financial-meta-label">Discount</span>
            <span className="financial-meta-value financial-meta-value--mono">{data.discountCode}</span>
          </div>
        )}

        <div className="financial-meta-row financial-meta-row--divider">
          <span className="financial-meta-label">Payment Status</span>
          <Badge type="payment" value={data.paymentStatus || 'pending'} />
        </div>
      </div>

      <div className="financial-table-wrapper">
        <table className="financial-summary-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {chargeLines.length === 0 ? (
              <tr>
                <td colSpan={4} className="financial-summary-empty">
                  No lines attached to this booking.
                </td>
              </tr>
            ) : hasSections ? (
              <>
                <ChargeSection title="Accommodation" lines={accommodationLines} />
                <ChargeSection title="Add-ons" lines={addonLines} />
                <ChargeSection title="Menu & Orders" lines={menuLines} />
              </>
            ) : (
              chargeLines.map((line, idx) => (
                <tr key={`${line.name || line.description}-${idx}`}>
                  <td className="financial-summary-item">{line.description || line.name}</td>
                  <td className="text-center">{line.quantity}</td>
                  <td className="text-right">{formatRp(line.unitPrice || line.unit_price)}</td>
                  <td className="text-right financial-summary-subtotal">{formatRp(line.subtotal)}</td>
                </tr>
              ))
            )}

            {discountAmount > 0 && (
              <>
                <tr className="financial-summary-subtotal-row">
                  <td colSpan={3} className="text-right">Subtotal Before Discount</td>
                  <td className="text-right">{formatRp(subtotalBeforeDiscount)}</td>
                </tr>
                {(discountLines.length > 0 ? discountLines : [{ description: 'Discount applied', subtotal: -discountAmount }]).map((line, idx) => (
                  <tr key={`discount-${idx}`} className="financial-summary-discount-row">
                    <td className="financial-summary-item">{line.description || line.name || 'Discount'}</td>
                    <td className="text-center">{line.quantity || 1}</td>
                    <td className="text-right">{formatRp(line.unitPrice || line.unit_price || -discountAmount)}</td>
                    <td className="text-right financial-summary-discount">−{formatRp(Math.abs(line.subtotal || discountAmount))}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right">Total Charges</td>
              <td className="text-right">{formatRp(summaryTotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right">Total Paid</td>
              <td className="text-right financial-summary-paid">{formatRp(data.amountPaid)}</td>
            </tr>
            <tr className="financial-summary-balance-row">
              <td colSpan={3} className="text-right">Balance Due</td>
              <td className="text-right financial-summary-balance">{formatRp(summaryBalanceDue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SummaryModal({
  isOpen,
  bookingId,
  guestName,
  displayId,
  onClose,
  embedded = false,
  onDataLoaded,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const onDataLoadedRef = useRef(onDataLoaded);

  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  useEffect(() => {
    const shouldFetch = embedded ? (isOpen && !!bookingId) : (isOpen && !!bookingId);

    if (!shouldFetch) {
      return undefined;
    }

    let cancelled = false;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/bookings/${bookingId}/invoice`);
        if (!res.ok) throw new Error('Failed to load financial details');
        const summaryData = await res.json();
        if (cancelled) return;
        setData(summaryData);
        onDataLoadedRef.current?.(summaryData);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [bookingId, isOpen, embedded]);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  let body = null;
  if (loading) {
    body = <div className="financial-summary-loading">Loading summary ledger…</div>;
  } else if (error) {
    body = <Alert type="error" message={error} />;
  } else if (data) {
    body = <SummaryContent data={data} />;
  }

  if (embedded) {
    return body;
  }

  if (!isOpen) return null;

  const titleSuffix = guestName || 'Guest';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header title={`Booking Details — ${titleSuffix}`} />
      <Modal.Body>{body}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SummaryModal;
