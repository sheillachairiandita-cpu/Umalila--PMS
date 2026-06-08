/**
 * Booking Confirmation PDF — pdfkit rewrite
 * Two-page layout:
 *   Page 1 — Confirmation letter (guest-facing)
 *   Page 2 — Invoice / financial summary
 *
 * Drop-in replacement for the previous pdfmake version.
 * External API is identical:
 *   generateBookingConfirmationPdf(summary) → Promise<Buffer>
 *   streamBookingConfirmationPdf(summary, res) → void
 */

import PDFDocument from 'pdfkit';

// ─── Brand colours ────────────────────────────────────────────────────────────

const C = {
  brandDark:   '#2E241C',
  brandMid:    '#5C4A3A',
  brandAccent: '#8B6F47',
  cream:       '#F7F3ED',
  border:      '#C9B8A4',
  text:        '#2E241C',
  textMuted:   '#6B5D52',
  white:       '#FFFFFF',
  tableHead:   '#3D3228',
  red:         '#C0392B',
};

// ─── Property constants ───────────────────────────────────────────────────────

const PROPERTY = {
  name:            'Villa Umalila',
  email:           'stayatumalila@gmail.com',
  instagram:       '@stayatumalila',
  phone:           '+62 822 6805 7800',
  addressLines: [
    'Jl. Batu Bagiriak, Alahan Panjang,',
    'Kec. Lembah Gumanti, Kabupaten',
    'Solok, Sumatera Barat 27371',
  ],
  bankName:        'Bank BNI',
  bankAccount:     '0174105357',
  bankAccountName: 'Chairiyanto',
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN  = 40;
const PW      = 595.28;          // A4 width  in points
const PH      = 841.89;          // A4 height in points
const CONTENT = PW - MARGIN * 2; // usable width

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function formatIdr(amount) {
  return Math.round(Number(amount) || 0).toLocaleString('de-DE');
}

function formatInvoiceDate(dateStr) {
  const d = new Date(dateStr || Date.now());
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

function formatStayDate(dateStr, suffix) {
  const d = new Date(dateStr);
  const formatted = d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return `${formatted} | ${suffix}`;
}

function stayDurationLabel(nights) {
  const days = nights + 1;
  return `${days} day${days !== 1 ? 's' : ''} ${nights} night${nights !== 1 ? 's' : ''}`;
}

function guestFirstName(fullName) {
  return (fullName || 'Guest').trim().split(/\s+/)[0];
}

function formatLineQty(item) {
  if (item.type === 'accommodation') {
    const n = item.quantity || 1;
    return `${n} Night${n !== 1 ? 's' : ''}`;
  }
  const name = (item.name || item.description || '').toLowerCase();
  const qty  = item.quantity || 1;
  if (name.includes('bed')) return `${qty} Bed${qty !== 1 ? 's' : ''}`;
  return String(qty);
}

// ─── Low-level drawing primitives ─────────────────────────────────────────────

/**
 * Draw a filled rectangle using an HTML hex colour string.
 */
function fillRect(doc, x, y, w, h, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.save().rect(x, y, w, h).fill([r, g, b]).restore();
}

/**
 * Draw a horizontal rule.
 */
function hRule(doc, x, y, w, hex = C.border, lineWidth = 0.5) {
  const [r, g, b] = hexToRgb(hex);
  doc.save()
     .moveTo(x, y).lineTo(x + w, y)
     .lineWidth(lineWidth).strokeColor([r, g, b]).stroke()
     .restore();
}

/**
 * Set fill colour from a hex string and return the doc for chaining.
 */
function setFill(doc, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.fillColor([r, g, b]);
  return doc;
}

// ─── Section title ────────────────────────────────────────────────────────────

function sectionTitle(doc, text, y) {
  setFill(doc, C.tableHead)
    .font('Helvetica-Bold').fontSize(12)
    .text(text, MARGIN, y);
  return doc.y + 6;
}

// ─── Key-value detail table (confirmation page) ───────────────────────────────

function detailTable(doc, rows, startY) {
  const col1 = MARGIN;
  const col2 = MARGIN + CONTENT * 0.42;
  let   y    = startY;
  const rowH = 24;

  rows.forEach((row, i) => {
    // Alternating subtle background
    if (i % 2 === 0) fillRect(doc, MARGIN, y, CONTENT, rowH, C.cream);

    setFill(doc, C.text).font('Helvetica-Bold').fontSize(10)
      .text(row[0], col1 + 8, y + 7, { width: col2 - col1 - 8, lineBreak: false });
    setFill(doc, C.text).font('Helvetica').fontSize(10)
      .text(row[1], col2 + 8, y + 7, { width: MARGIN + CONTENT - col2 - 8, lineBreak: false });

    hRule(doc, MARGIN, y + rowH, CONTENT);
    y += rowH;
  });

  return y + 4;
}

// ─── Invoice table ────────────────────────────────────────────────────────────

/**
 * Draws the line-item invoice table.
 * Columns: Description | Qty | Unit Price | Total Price
 * Returns the y position after the table.
 */
function invoiceTable(doc, lineItems, discountAmount, discountCode, total, startY) {
  const colWidths = [CONTENT * 0.46, CONTENT * 0.12, CONTENT * 0.21, CONTENT * 0.21];
  const colX = [
    MARGIN,
    MARGIN + colWidths[0],
    MARGIN + colWidths[0] + colWidths[1],
    MARGIN + colWidths[0] + colWidths[1] + colWidths[2],
  ];
  const rowH  = 26;
  const headH = 28;
  let   y     = startY;

  // Header
  fillRect(doc, MARGIN, y, CONTENT, headH, C.tableHead);
  const headers = ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL PRICE'];
  const aligns  = ['left', 'center', 'right', 'right'];

  headers.forEach((h, i) => {
    setFill(doc, C.white).font('Helvetica-Bold').fontSize(9)
      .text(h, colX[i] + 6, y + 9, { width: colWidths[i] - 12, align: aligns[i], lineBreak: false });
  });

  hRule(doc, MARGIN, y + headH, CONTENT, C.border, 1);
  y += headH;

  // Line items
  lineItems.forEach((item, idx) => {
    const bg = idx % 2 === 0 ? C.white : C.cream;
    fillRect(doc, MARGIN, y, CONTENT, rowH, bg);

    const cells = [
      item.description,
      formatLineQty(item),
      formatIdr(item.unitPrice),
      formatIdr(item.subtotal),
    ];
    cells.forEach((cell, i) => {
      setFill(doc, C.text).font('Helvetica').fontSize(10)
        .text(cell, colX[i] + 6, y + 8, { width: colWidths[i] - 12, align: aligns[i], lineBreak: false });
    });

    hRule(doc, MARGIN, y + rowH, CONTENT, C.border, 0.4);
    y += rowH;
  });

  // Discount row (optional)
  if (discountAmount > 0) {
    fillRect(doc, MARGIN, y, CONTENT, rowH, C.cream);
    const label = `Discount${discountCode ? ` (${discountCode})` : ''}`;
    setFill(doc, C.text).font('Helvetica-Bold').fontSize(10)
      .text(label, colX[0] + 6, y + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 12, align: 'right', lineBreak: false });
    setFill(doc, C.red).font('Helvetica-Bold').fontSize(10)
      .text(`- ${formatIdr(discountAmount)}`, colX[3] + 6, y + 8, { width: colWidths[3] - 12, align: 'right', lineBreak: false });
    hRule(doc, MARGIN, y + rowH, CONTENT, C.border, 0.4);
    y += rowH;
  }

  // Total row
  fillRect(doc, MARGIN, y, CONTENT, rowH + 2, C.cream);
  setFill(doc, C.text).font('Helvetica-Bold').fontSize(10)
    .text('TOTAL (IDR)', colX[0] + 6, y + 9, { width: colWidths[0] + colWidths[1] + colWidths[2] - 12, align: 'right', lineBreak: false });
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(formatIdr(total), colX[3] + 6, y + 9, { width: colWidths[3] - 12, align: 'right', lineBreak: false });
  hRule(doc, MARGIN, y + rowH + 2, CONTENT, C.border, 1);
  y += rowH + 2;

  return y + 6;
}

// ─── Page 1: Confirmation letter ──────────────────────────────────────────────

function drawConfirmationPage(doc, summary) {
  const booking    = summary.booking || summary;
  const guestName  = summary.guestName  || booking.guests?.full_name  || 'Guest';
  const guestCount = summary.totalGuests || booking.total_guests       || 1;
  const villaName  = summary.villaNames  || summary.villa_names        || '—';

  const checkIn  = summary.checkIn  || summary.checkInDate  || booking.check_in_date;
  const checkOut = summary.checkOut || summary.checkOutDate || booking.check_out_date;
  const nights   = summary.nights   || Math.max(
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)), 1
  );

  let y = MARGIN;

  // ── Brand title ──────────────────────────────────────────────────────────
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(28)
    .text('Umalila', MARGIN, y, { align: 'center', width: CONTENT });
  y = doc.y + 20;

  // ── Guest / stay summary grid (two columns) ───────────────────────────────
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT * 0.52;
  const colW  = CONTENT * 0.48;

  // Left column
  setFill(doc, C.textMuted).font('Helvetica-Bold').fontSize(9)
    .text('Guest Name', col1X, y, { width: colW });
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(guestName, col1X, doc.y + 2, { width: colW });
  const leftY1 = doc.y + 10;

  setFill(doc, C.textMuted).font('Helvetica-Bold').fontSize(9)
    .text('Villa Type', col1X, leftY1, { width: colW });
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(villaName, col1X, doc.y + 2, { width: colW });
  const leftY2 = doc.y + 10;

  setFill(doc, C.textMuted).font('Helvetica-Bold').fontSize(9)
    .text('No. of Guests', col1X, leftY2, { width: colW });
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(`${guestCount} Guest${guestCount !== 1 ? 's' : ''}`, col1X, doc.y + 2, { width: colW });

  // Right column (reset y to top of grid)
  setFill(doc, C.textMuted).font('Helvetica-Bold').fontSize(9)
    .text('Check-in Date', col2X, y, { width: colW });
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(formatStayDate(checkIn, 'After 2 PM'), col2X, doc.y + 2, { width: colW });
  const rightY1 = doc.y + 10;

  setFill(doc, C.textMuted).font('Helvetica-Bold').fontSize(9)
    .text('Check-out Date', col2X, rightY1, { width: colW });
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(formatStayDate(checkOut, 'Before 11 AM'), col2X, doc.y + 2, { width: colW });

  y = doc.y + 20;

  // ── Contact row ───────────────────────────────────────────────────────────
  const contactItems = [PROPERTY.email, PROPERTY.instagram, PROPERTY.phone];
  const contactW = CONTENT / contactItems.length;

  contactItems.forEach((item, i) => {
    setFill(doc, C.textMuted).font('Helvetica').fontSize(9)
      .text(item, MARGIN + i * contactW, y, { width: contactW, align: 'center', lineBreak: false });
  });
  y += 24;

  // ── Headline ──────────────────────────────────────────────────────────────
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(16)
    .text('Your reservation is confirmed!', MARGIN, y, { width: CONTENT });
  y = doc.y + 12;

  // ── Greeting body ─────────────────────────────────────────────────────────
  setFill(doc, C.text).font('Helvetica').fontSize(10);
  doc.text('Dear ', MARGIN, y, { continued: true, lineGap: 2 });
  doc.font('Helvetica-Bold').text(`${guestFirstName(guestName)},`, { continued: false });
  doc.moveDown(0.5);
  doc.font('Helvetica').text(
    `Thank you for choosing to stay at Villa Umalila. We're pleased to confirm your reservation for `,
    { continued: true }
  );
  doc.font('Helvetica-Bold').text(stayDurationLabel(nights), { continued: false });
  y = doc.y + 16;

  // ── Reservation Details table ─────────────────────────────────────────────
  y = sectionTitle(doc, 'Reservation Details', y) + 4;
  y = detailTable(doc, [
    ['Guest Name',    guestName],
    ['Villa Type',    villaName],
    ['No. of Guests', `${guestCount} Guest${guestCount !== 1 ? 's' : ''}`],
    ['Check-in Date',  formatStayDate(checkIn,  'After 2 PM')],
    ['Check-out Date', formatStayDate(checkOut, 'Before 11 AM')],
  ], y);
  y += 14;

  // ── Closing line ──────────────────────────────────────────────────────────
  setFill(doc, C.text).font('Helvetica').fontSize(10)
    .text('We look forward to welcoming you to Villa Umalila.', MARGIN, y, { width: CONTENT });
  y = doc.y + 18;

  // ── Important Notice ──────────────────────────────────────────────────────
  y = sectionTitle(doc, 'Important Notice', y) + 6;

  const notices = [
    'Please present your KTP and booking details during check-in.',
    'Villa Umalila does not accommodate unmarried couples.',
  ];
  notices.forEach((notice) => {
    setFill(doc, C.text).font('Helvetica').fontSize(10)
      .text(`•  ${notice}`, MARGIN + 12, y, { width: CONTENT - 12 });
    y = doc.y + 4;
  });
  y += 16;

  // ── Footer ────────────────────────────────────────────────────────────────
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(12)
    .text(PROPERTY.name, MARGIN, y);
  y = doc.y + 2;
  PROPERTY.addressLines.forEach((line) => {
    setFill(doc, C.text).font('Helvetica').fontSize(9).text(line, MARGIN, y);
    y = doc.y + 1;
  });
}

// ─── Page 2: Invoice ──────────────────────────────────────────────────────────

function drawInvoicePage(doc, summary) {
  const booking    = summary.booking || summary;
  const guestName  = summary.guestName  || booking.guests?.full_name  || 'Guest';
  const phone      = summary.phone      || booking.guests?.phone_number || '—';
  const displayId  = summary.displayId  || `INV${(booking.id || '000000').slice(0, 6).toUpperCase()}`;
  const invoiceDate = formatInvoiceDate(booking.created_at || new Date().toISOString());

  // ── Build line items ──────────────────────────────────────────────────────
  const lineItems = [];

  if (Array.isArray(summary.accommodationLines) && summary.accommodationLines.length) {
    summary.accommodationLines.forEach(line => {
      lineItems.push({
        description: line.name || line.description || 'Accommodation',
        name:        line.name || 'Accommodation',
        quantity:    line.quantity || 1,
        unitPrice:   line.unitPrice || 0,
        subtotal:    line.subtotal  || 0,
        type:        'accommodation',
      });
    });
  } else if (Array.isArray(summary.villas)) {
    summary.villas.forEach(villa => {
      lineItems.push({
        description: villa.name || 'Accommodation',
        name:        villa.name || 'Accommodation',
        quantity:    villa.nights || 1,
        unitPrice:   villa.rate   || 0,
        subtotal:    (villa.rate || 0) * (villa.nights || 1),
        type:        'accommodation',
      });
    });
  }

  if (Array.isArray(summary.addonLines) && summary.addonLines.length) {
    summary.addonLines.forEach(line => {
      lineItems.push({
        description: line.name || line.description || 'Add-on',
        name:        line.name || 'Add-on',
        quantity:    line.quantity || 1,
        unitPrice:   line.unitPrice || 0,
        subtotal:    line.subtotal  || 0,
        type:        'addon',
      });
    });
  } else if (Array.isArray(summary.addons)) {
    summary.addons.forEach(addon => {
      lineItems.push({
        description: addon.name || 'Add-on',
        name:        addon.name || 'Add-on',
        quantity:    addon.quantity  || 1,
        unitPrice:   addon.unitPrice || 0,
        subtotal:    (addon.unitPrice || 0) * (addon.quantity || 1),
        type:        'addon',
      });
    });
  }

  const subtotal       = summary.subtotalBeforeDiscount
    ?? lineItems.reduce((s, i) => s + (i.subtotal || 0), 0);
  const discountAmount = summary.discountAmount || 0;
  const total          = summary.total ?? Math.max(subtotal - discountAmount, 0);

  let y = MARGIN;

  // ── Brand title ───────────────────────────────────────────────────────────
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(28)
    .text('Umalila', MARGIN, y, { align: 'center', width: CONTENT });
  y = doc.y + 20;

  // ── Invoice meta (two columns) ────────────────────────────────────────────
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT * 0.5;
  const colW  = CONTENT * 0.5;

  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text('Invoice No', col1X, y, { width: colW });
  setFill(doc, C.text).font('Helvetica').fontSize(10)
    .text(`: ${displayId}`, col1X, doc.y + 2, { width: colW });
  const metaLeftY = doc.y + 6;

  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text('Date', col1X, metaLeftY, { width: colW });
  setFill(doc, C.text).font('Helvetica').fontSize(10)
    .text(`: ${invoiceDate}`, col1X, doc.y + 2, { width: colW });

  // Right column — Bill To
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text('Bill To', col2X, y, { width: colW });
  y = doc.y + 4;
  setFill(doc, C.text).font('Helvetica').fontSize(9)
    .text(`Customer : ${guestName}`, col2X, y, { width: colW });
  y = doc.y + 2;
  setFill(doc, C.text).font('Helvetica').fontSize(9)
    .text(`Contact   : ${phone}`, col2X, y, { width: colW });

  y = doc.y + 16;

  // ── Property address (left) ───────────────────────────────────────────────
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(PROPERTY.name, col1X, y - 16 - (16 * (PROPERTY.addressLines.length + 1)), { width: colW });

  // Re-draw address below meta block to avoid collision — position after y
  setFill(doc, C.brandDark).font('Helvetica-Bold').fontSize(11)
    .text(PROPERTY.name, col1X, y, { width: colW });
  y = doc.y + 2;
  PROPERTY.addressLines.forEach(line => {
    setFill(doc, C.text).font('Helvetica').fontSize(9)
      .text(line, col1X, y, { width: colW });
    y = doc.y + 1;
  });
  setFill(doc, C.text).font('Helvetica').fontSize(9)
    .text(`Contact: ${PROPERTY.phone}`, col1X, y, { width: colW });
  y = doc.y + 20;

  // ── Invoice table ─────────────────────────────────────────────────────────
  y = invoiceTable(doc, lineItems, discountAmount, summary.discountCode, total, y);
  y += 10;

  // ── Payment instructions ──────────────────────────────────────────────────
  y = sectionTitle(doc, 'Payment Instruction (IDR)', y) + 8;

  const paymentLines = [
    `Bank Details   : ${PROPERTY.bankName}`,
    `Bank Account : ${PROPERTY.bankAccount}`,
    `Name              : ${PROPERTY.bankAccountName}`,
  ];
  paymentLines.forEach(line => {
    setFill(doc, C.text).font('Helvetica').fontSize(10)
      .text(line, MARGIN, y, { width: CONTENT });
    y = doc.y + 3;
  });
  y += 10;

  setFill(doc, C.text).font('Helvetica').fontSize(10)
    .text(
      'Please send your payment details to complete your booking through our contact person.',
      MARGIN, y, { width: CONTENT }
    );
  y = doc.y + 24;

  // ── Thank you ─────────────────────────────────────────────────────────────
  setFill(doc, C.brandMid || C.brandAccent).font('Helvetica-Bold').fontSize(12)
    .text('Thank you for staying with us!', MARGIN, y, { align: 'center', width: CONTENT });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a booking confirmation PDF and return it as a Buffer.
 * @param {object} summary  — output of buildFinancialSummary() from pdfHelpers.js
 * @returns {Promise<Buffer>}
 */
export async function generateBookingConfirmationPdf(summary) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title:   'Booking Confirmation — Villa Umalila',
        Author:  'Villa Umalila PMS',
      },
    });

    const chunks = [];
    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', err   => reject(err));

    // Page 1 — confirmation letter
    drawConfirmationPage(doc, summary);

    // Page 2 — invoice
    doc.addPage();
    drawInvoicePage(doc, summary);

    doc.end();
  });
}

/**
 * Stream the PDF directly to an Express response.
 */
export async function streamBookingConfirmationPdf(summary, res) {
  try {
    const pdfBuffer = await generateBookingConfirmationPdf(summary);
    res.write(pdfBuffer);
    res.end();
  } catch (error) {
    console.error('Error streaming PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
    throw error;
  }
}