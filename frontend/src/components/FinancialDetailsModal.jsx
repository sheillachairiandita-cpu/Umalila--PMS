import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Modal, Badge, Alert, Button } from './ui';

function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString()}`;
}

function lineTypeLabel(type) {
  if (type === 'accommodation') return 'Accommodation';
  if (type === 'addon') return 'Add-on';
  if (type === 'menu') return 'Menu';
  return type;
}

function FinancialDetailsModal({ isOpen, bookingId, guestName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setData(null);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/bookings/${bookingId}/financial-summary`);
        if (!res.ok) throw new Error('Failed to load financial details');
        setData(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header
        title="Financial Details"
        icon={FileText}
        subtitle={guestName || data?.guestName}
        onClose={onClose}
      />

      <Modal.Body>
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {loading && (
          <div className="empty-state">Loading itemized breakdown…</div>
        )}

        {!loading && data && (
          <>
            <div className="financial-details-meta">
              <div>
                <span className="financial-details-meta__label">Invoice ID</span>
                <span className="financial-details-meta__value">{data.invoiceId}</span>
              </div>
              <div>
                <span className="financial-details-meta__label">Stay</span>
                <span className="financial-details-meta__value">
                  {data.checkIn} → {data.checkOut}
                </span>
              </div>
              <div>
                <span className="financial-details-meta__label">Villas</span>
                <span className="financial-details-meta__value">{data.villaNames}</span>
              </div>
              <div>
                <span className="financial-details-meta__label">Payment Status</span>
                <Badge type="payment" value={data.paymentStatus} />
              </div>
            </div>

            <div className="table-scroll-wrap financial-details-table-wrap">
              <table className="pms-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.lineItems || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">No line items</td>
                    </tr>
                  ) : (
                    (data.lineItems || []).map((line, idx) => (
                      <tr key={`${line.type}-${line.name}-${idx}`}>
                        <td>{lineTypeLabel(line.type)}</td>
                        <td className="cell-guest">{line.description || line.name}</td>
                        <td className="text-center">{line.quantity}</td>
                        <td className="text-right">{formatRp(line.unitPrice)}</td>
                        <td className="text-right cell-amount">{formatRp(line.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="financial-details-total-row">
                    <td colSpan={4} className="text-right">Total</td>
                    <td className="text-right cell-amount">{formatRp(data.total)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right">Amount Paid</td>
                    <td className="text-right">{formatRp(data.amountPaid)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right">Balance Due</td>
                    <td className="text-right cell-amount">{formatRp(data.balanceDue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default FinancialDetailsModal;
