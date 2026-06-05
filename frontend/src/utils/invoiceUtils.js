function formatRp(amount) {
  return `Rp ${(Number(amount) || 0).toLocaleString('id-ID')}`;
}

function buildInvoiceHtml(invoice) {
  const menuRows = (invoice.menuItems || [])
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${formatRp(item.subtotal)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 40px; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    th { text-align: left; background: #f8fafc; font-size: 0.8rem; text-transform: uppercase; color: #64748b; }
    .totals td { font-weight: 600; }
    .total-row td { font-size: 1.1rem; font-weight: 700; border-top: 2px solid #0f172a; }
  </style>
</head>
<body>
  <h1>Umalila — Reservation Invoice</h1>
  <div class="meta">
    <div>Invoice #: ${invoice.invoiceNumber}</div>
    <div>Guest: ${invoice.guestName}</div>
    <div>Stay: ${invoice.checkIn} → ${invoice.checkOut}</div>
    <div>Villas: ${invoice.villaNames}</div>
    <div>Generated: ${invoice.generatedAt}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Accommodation</td><td style="text-align:center">1</td><td style="text-align:right">${formatRp(invoice.accommodation)}</td></tr>
      <tr><td>Extra Beds</td><td style="text-align:center">—</td><td style="text-align:right">${formatRp(invoice.extraBeds)}</td></tr>
      <tr><td>Extra Breakfast</td><td style="text-align:center">—</td><td style="text-align:right">${formatRp(invoice.extraBreakfast)}</td></tr>
      ${menuRows}
    </tbody>
    <tfoot>
      <tr class="totals"><td colspan="2">Total</td><td style="text-align:right">${formatRp(invoice.total)}</td></tr>
      <tr class="totals"><td colspan="2">Amount Paid</td><td style="text-align:right">${formatRp(invoice.amountPaid)}</td></tr>
      <tr class="total-row"><td colspan="2">Balance Due</td><td style="text-align:right">${formatRp(invoice.balanceDue)}</td></tr>
    </tfoot>
  </table>
</body>
</html>`;
}

export async function downloadReservationInvoice(bookingId) {
  const response = await fetch(`/api/bookings/${bookingId}/invoice`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to generate invoice');
  }

  const invoice = await response.json();
  const html = buildInvoiceHtml(invoice);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${invoice.invoiceNumber}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
