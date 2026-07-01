/** Supabase Storage bucket for booking payment receipt uploads. */
export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';

/**
 * Object key inside payment-proofs:
 * {tenant_id}/bookings/{booking_id}/{payment_type}-{timestamp}.{ext}
 */
export function buildPaymentProofStoragePath({
  tenantId,
  bookingId,
  paymentType,
  fileName,
}) {
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx !== -1 ? fileName.slice(dotIdx) : '';
  const type = paymentType === 'final' ? 'final' : 'partial';
  const timestamp = Date.now();
  return `${tenantId}/bookings/${bookingId}/${type}-${timestamp}${ext}`;
}
