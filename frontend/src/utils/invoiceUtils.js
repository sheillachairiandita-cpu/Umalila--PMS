/**
 * Streams a server-generated booking confirmation PDF.
 * Compute → stream → forget: no client-side HTML assembly, no Supabase Storage writes.
 */

import { apiFetch } from '../api/client.js';

function parseFilenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i) || header.match(/filename=([^;]+)/i);
  return match ? match[1].trim() : fallback;
}

export async function downloadReservationInvoice(bookingId, displayId) {
  const response = await apiFetch(`/api/bookings/${bookingId}/invoice/pdf`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to download booking confirmation PDF');
  }

  const fallbackName = `Booking Confirmation - ${displayId || bookingId}.pdf`;
  const filename = parseFilenameFromDisposition(
    response.headers.get('Content-Disposition'),
    fallbackName
  );

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
