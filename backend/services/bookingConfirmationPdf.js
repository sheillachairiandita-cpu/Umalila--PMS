/**
 * Booking Confirmation PDF — Updated layout matching INV00108 design
 * Uses pdfmake with custom styling
 */

import pdfmake from '../lib/pdfmakeSetup.js';

const COLORS = {
  brandDark: '#2E241C',
  brandMid: '#5C4A3A',
  brandAccent: '#8B6F47',
  cream: '#F7F3ED',
  border: '#C9B8A4',
  text: '#2E241C',
  textMuted: '#6B5D52',
  white: '#FFFFFF',
  tableHead: '#3D3228',
};

const PROPERTY = {
  name: 'Villa Umalila',
  email: 'stayatumalila@gmail.com',
  instagram: '@stayatumalila',
  phone: '+62 822 6805 7800',
  addressLines: [
    'Jl. Batu Bagiriak, Alahan Panjang,',
    'Kec. Lembah Gumanti, Kabupaten',
    'Solok, Sumatera Barat 27371',
  ],
  bankName: 'Bank BNI',
  bankAccount: '0174105357',
  bankAccountName: 'Chairiyanto',
};

function formatIdr(amount) {
  return Math.round(Number(amount) || 0).toLocaleString('de-DE');
}

function formatInvoiceDate(dateStr) {
  const d = new Date(dateStr || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatStayDate(dateStr, suffix) {
  const d = new Date(dateStr);
  const formatted = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${formatted} | ${suffix}`;
}

function stayDurationLabel(checkIn, checkOut, nights) {
  const days = nights + 1;
  return `${days} day${days !== 1 ? 's' : ''} ${nights} night${nights !== 1 ? 's' : ''}`;
}

function guestFirstName(fullName) {
  return (fullName || 'Guest').trim().split(/\s+/)[0];
}

function formatLineQty(line) {
  if (line.type === 'accommodation') {
    const n = line.quantity || 1;
    return `${n} Night${n !== 1 ? 's' : ''}`;
  }
  if (line.type === 'addon') {
    const name = (line.name || line.description || '').toLowerCase();
    const qty = line.quantity || 1;
    if (name.includes('bed')) return `${qty} Bed${qty !== 1 ? 's' : ''}`;
    return String(qty);
  }
  return String(line.quantity || 1);
}

/**
 * Page 1: Confirmation Letter
 */
function buildConfirmationPage(summary) {
  const booking = summary.booking || summary;
  const guestName = booking.guestName || booking.guests?.full_name || 'Guest';
  const phone = booking.phone || booking.guests?.phone_number || '—';
  const nights = booking.nights || Math.max(
    Math.ceil(
      (new Date(booking.checkOutDate || booking.check_out_date) - new Date(booking.checkInDate || booking.check_in_date)) /
        (1000 * 60 * 60 * 24)
    ),
    1
  );
  const guestCount = booking.totalGuests || booking.total_guests || 1;
  const villaName = booking.villaNames || summary.villa_names || '—';

  return [
    // Header with Umalila branding
    {
      text: 'Umalila',
      style: 'confirmHeaderTitle',
      alignment: 'center',
      margin: [0, 0, 0, 28],
    },

    // Guest details grid
    {
      columns: [
        {
          width: '48%',
          stack: [
            { text: 'Guest Name', style: 'gridLabel' },
            { text: guestName, style: 'gridValue', margin: [0, 0, 0, 12] },
            { text: 'Villa Type', style: 'gridLabel' },
            { text: villaName, style: 'gridValue', margin: [0, 0, 0, 12] },
            { text: 'No. of Guests', style: 'gridLabel' },
            { text: `${guestCount} Guest${guestCount !== 1 ? 's' : ''}`, style: 'gridValue' },
          ],
        },
        {
          width: '4%',
          text: '',
        },
        {
          width: '48%',
          stack: [
            { text: 'Check-in Date', style: 'gridLabel' },
            { text: formatStayDate(booking.checkInDate || booking.check_in_date, 'After 2 PM'), style: 'gridValue', margin: [0, 0, 0, 12] },
            { text: 'Check-out Date', style: 'gridLabel' },
            { text: formatStayDate(booking.checkOutDate || booking.check_out_date, 'Before 11 AM'), style: 'gridValue' },
          ],
        },
      ],
      margin: [0, 0, 0, 22],
    },

    // Contact info row
    {
      columns: [
        { text: PROPERTY.email, style: 'contactLine', alignment: 'center' },
        { text: PROPERTY.instagram, style: 'contactLine', alignment: 'center' },
        { text: PROPERTY.phone, style: 'contactLine', alignment: 'center' },
      ],
      margin: [0, 0, 0, 28],
    },

    // Main headline
    {
      text: 'Your reservation is confirmed!',
      style: 'confirmHeadline',
      alignment: 'left',
      margin: [0, 0, 0, 14],
    },

    // Greeting
    {
      text: [
        'Dear ',
        { text: guestFirstName(guestName), bold: true },
        ',\n\nThank you for choosing to stay at Villa Umalila. We\'re pleased to confirm your reservation for ',
        { text: stayDurationLabel(booking.checkInDate || booking.check_in_date, booking.checkOutDate || booking.check_out_date, nights), bold: true },
        '.',
      ],
      style: 'bodyText',
      alignment: 'left',
      margin: [0, 0, 0, 18],
    },

    // Reservation Details section
    {
      text: 'Reservation Details',
      style: 'sectionTitle',
      margin: [0, 0, 0, 12],
    },

    // Detail table - matching your PDF
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: 'Guest Name', style: 'detailLabel', border: [false, false, true, false] },
            { text: guestName, style: 'detailValue', border: [false, false, false, false] },
          ],
          [
            { text: 'Villa Type', style: 'detailLabel', border: [false, false, true, false] },
            { text: villaName, style: 'detailValue', border: [false, false, false, false] },
          ],
          [
            { text: 'No. of Guests', style: 'detailLabel', border: [false, false, true, false] },
            { text: `${guestCount} Guest${guestCount !== 1 ? 's' : ''}`, style: 'detailValue', border: [false, false, false, false] },
          ],
          [
            { text: 'Check-in Date', style: 'detailLabel', border: [false, false, true, false] },
            { text: formatStayDate(booking.checkInDate || booking.check_in_date, 'After 2 PM'), style: 'detailValue', border: [false, false, false, false] },
          ],
          [
            { text: 'Check-out Date', style: 'detailLabel', border: [false, false, true, false] },
            { text: formatStayDate(booking.checkOutDate || booking.check_out_date, 'Before 11 AM'), style: 'detailValue', border: [false, false, false, false] },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 0,
        hLineColor: () => COLORS.border,
        paddingLeft: () => 12,
        paddingRight: () => 12,
        paddingTop: () => 8,
        paddingBottom: () => 8,
        fillColor: (rowIndex) => (rowIndex % 2 === 0 ? COLORS.white : COLORS.cream),
      },
      margin: [0, 0, 0, 18],
    },

    // Forward text
    {
      text: 'We look forward to welcoming you to Villa Umalila.',
      style: 'bodyText',
      alignment: 'left',
      margin: [0, 0, 0, 22],
    },

    // Important Notice section
    {
      text: 'Important Notice',
      style: 'sectionTitle',
      margin: [0, 0, 0, 10],
    },

    {
      ul: [
        'Please present your KTP and booking details during check-in.',
        'Villa Umalila does not accommodate unmarried couples.',
      ],
      style: 'noticeList',
      margin: [12, 0, 0, 28],
    },

    // Footer
    {
      stack: [
        { text: PROPERTY.name, style: 'footerBrand' },
        ...PROPERTY.addressLines.map((line) => ({ text: line, style: 'footerAddress' })),
      ],
      margin: [0, 20, 0, 0],
    },

    { text: '', pageBreak: 'after' },
  ];
}

/**
 * Page 2: Invoice Details
 */
function buildInvoicePage(summary) {
  const booking = summary.booking || summary;
  const guestName = booking.guestName || booking.guests?.full_name || 'Guest';
  const phone = booking.phone || booking.guests?.phone_number || '—';
  const displayId = summary.displayId || `INV${(booking.id || '000000').slice(0, 6).toUpperCase()}`;
  const invoiceDate = formatInvoiceDate(booking.created_at || new Date().toISOString());
  
  // Build line items from villas and addons
  const lineItems = [];
  
  if (summary.villas && Array.isArray(summary.villas)) {
    summary.villas.forEach(villa => {
      lineItems.push({
        description: villa.name || 'Accommodation',
        quantity: villa.nights || 1,
        unitPrice: villa.rate || 0,
        subtotal: (villa.rate || 0) * (villa.nights || 1),
        type: 'accommodation',
      });
    });
  }

  if (summary.addons && Array.isArray(summary.addons)) {
    summary.addons.forEach(addon => {
      lineItems.push({
        description: addon.name || 'Add-on',
        quantity: addon.quantity || 1,
        unitPrice: addon.unitPrice || 0,
        subtotal: (addon.unitPrice || 0) * (addon.quantity || 1),
        type: 'addon',
      });
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);

  return [
    // Header
    {
      text: 'Umalila',
      style: 'confirmHeaderTitle',
      alignment: 'center',
      margin: [0, 0, 0, 28],
    },

    // Invoice header info
    {
      columns: [
        {
          width: '50%',
          stack: [
            { text: 'Invoice No', style: 'invoiceHeaderLabel' },
            { text: `: ${displayId}`, style: 'invoiceHeaderValue', margin: [0, 0, 0, 10] },
            { text: 'Date', style: 'invoiceHeaderLabel' },
            { text: `: ${invoiceDate}`, style: 'invoiceHeaderValue' },
          ],
        },
        {
          width: '50%',
          text: '',
        },
      ],
      margin: [0, 0, 0, 20],
    },

    // Bill To section
    {
      columns: [
        {
          width: '50%',
          stack: [
            { text: PROPERTY.name, style: 'billAddressTitle', margin: [0, 0, 0, 6] },
            ...PROPERTY.addressLines.map((line) => ({ text: line, style: 'billAddressLine' })),
            { text: `Contact: ${PROPERTY.phone}`, style: 'billAddressLine', margin: [0, 4, 0, 0] },
          ],
        },
        {
          width: '50%',
          stack: [
            { text: 'Bill To', style: 'billSectionTitle', margin: [0, 0, 0, 8] },
            { text: `Customer : ${guestName}`, style: 'billInfo', margin: [0, 0, 0, 4] },
            { text: `Contact   : ${phone}`, style: 'billInfo' },
          ],
        },
      ],
      margin: [0, 0, 0, 20],
    },

    // Invoice table
    {
      table: {
        headerRows: 1,
        widths: ['*', '12%', '18%', '18%'],
        body: [
          // Header row
          [
            { text: 'DESCRIPTION', style: 'invoiceTh', alignment: 'left' },
            { text: 'QTY', style: 'invoiceTh', alignment: 'center' },
            { text: 'UNIT PRICE', style: 'invoiceTh', alignment: 'right' },
            { text: 'TOTAL PRICE', style: 'invoiceTh', alignment: 'right' },
          ],
          // Line items
          ...lineItems.map(item => [
            { text: item.description, style: 'invoiceItemDesc', alignment: 'left' },
            { text: formatLineQty(item), style: 'invoiceItemQty', alignment: 'center' },
            { text: formatIdr(item.unitPrice), style: 'invoiceItemMoney', alignment: 'right' },
            { text: formatIdr(item.subtotal), style: 'invoiceItemMoney', alignment: 'right' },
          ]),
          // Subtotal row
          [
            { text: 'SUB TOTAL (IDR)', style: 'subtotalLabel', colSpan: 3, alignment: 'right' },
            {},
            {},
            { text: formatIdr(subtotal), style: 'subtotalValue', alignment: 'right' },
          ],
        ],
      },
      layout: {
        hLineWidth: (i, node) => {
          if (i === 0 || i === 1) return 1;
          if (i === node.table.body.length) return 1;
          return 0.5;
        },
        vLineWidth: () => 0,
        hLineColor: () => COLORS.border,
        fillColor: (rowIndex, node) => {
          if (rowIndex === 0) return COLORS.tableHead;
          if (rowIndex === node.table.body.length - 1) return COLORS.cream;
          return COLORS.white;
        },
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 20],
    },

    // Payment Instructions
    {
      text: 'Payment Instruction (IDR)',
      style: 'sectionTitle',
      margin: [0, 0, 0, 10],
    },

    {
      stack: [
        { text: `Bank Details   : ${PROPERTY.bankName}`, style: 'paymentInfo' },
        { text: `Bank Account : ${PROPERTY.bankAccount}`, style: 'paymentInfo', margin: [0, 4, 0, 0] },
        { text: `Name              : ${PROPERTY.bankAccountName}`, style: 'paymentInfo', margin: [0, 4, 0, 0] },
      ],
      margin: [0, 0, 0, 12],
    },

    {
      text: 'Please send your payment details to complete your booking through our contact person.',
      style: 'bodyText',
      margin: [0, 0, 0, 28],
    },

    // Thank you
    {
      text: 'Thank you for staying with us!',
      style: 'thankYouText',
      alignment: 'center',
      margin: [0, 20, 0, 0],
    },
  ];
}

/**
 * Build complete PDF document definition
 */
export function buildBookingConfirmationDocDefinition(summary) {
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: 'normal',
    styles: {
  normal: {
    font: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: COLORS.text,
  },

  confirmHeaderTitle: {
    font: 'Helvetica',
    bold: true,
    fontSize: 28,
    color: COLORS.brandDark,
  },

  confirmHeadline: {
    font: 'Helvetica',
    bold: true,
    fontSize: 16,
    color: COLORS.brandDark,
  },

  gridLabel: {
    font: 'Helvetica',
    bold: true,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  gridValue: {
    font: 'Helvetica',
    bold: true,
    fontSize: 11,
    color: COLORS.brandDark,
  },

  contactLine: {
    font: 'Helvetica',
    fontSize: 9,
    color: COLORS.textMuted,
  },

  bodyText: {
    font: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.text,
  },

  sectionTitle: {
    font: 'Helvetica',
    bold: true,
    fontSize: 12,
    color: COLORS.tableHead,
  },

  detailLabel: {
    font: 'Helvetica',
    bold: true,
    fontSize: 10,
    color: COLORS.text,
  },

  detailValue: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  noticeList: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  footerBrand: {
    font: 'Helvetica',
    bold: true,
    fontSize: 12,
    color: COLORS.brandDark,
  },

  footerAddress: {
    font: 'Helvetica',
    fontSize: 9,
    color: COLORS.text,
  },

  invoiceHeaderLabel: {
    font: 'Helvetica',
    bold: true,
    fontSize: 11,
    color: COLORS.brandDark,
  },

  invoiceHeaderValue: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  billSectionTitle: {
    font: 'Helvetica',
    bold: true,
    fontSize: 11,
    color: COLORS.brandDark,
  },

  billAddressTitle: {
    font: 'Helvetica',
    bold: true,
    fontSize: 11,
    color: COLORS.brandDark,
  },

  billAddressLine: {
    font: 'Helvetica',
    fontSize: 9,
    color: COLORS.text,
  },

  billInfo: {
    font: 'Helvetica',
    fontSize: 9,
    color: COLORS.text,
  },

  invoiceTh: {
    font: 'Helvetica',
    bold: true,
    fontSize: 9,
    color: COLORS.white,
  },

  invoiceItemDesc: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  invoiceItemQty: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  invoiceItemMoney: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  subtotalLabel: {
    font: 'Helvetica',
    bold: true,
    fontSize: 10,
    color: COLORS.text,
  },

  subtotalValue: {
    font: 'Helvetica',
    bold: true,
    fontSize: 11,
    color: COLORS.brandDark,
  },

  paymentInfo: {
    font: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
  },

  thankYouText: {
    font: 'Helvetica',
    bold: true,
    fontSize: 12,
    color: COLORS.brandMid,
  },
},
  };
}

export async function generateBookingConfirmationPdf(summary) {
  try {
    console.log('pdfmake:', pdfmake);
    console.log('pdfmake keys:', Object.keys(pdfmake));

    const docDefinition = buildBookingConfirmationDocDefinition(summary);

    const pdf = pdfmake.createPdf(docDefinition);

    const buffer = await pdf.getBuffer();

    return Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Stream PDF directly to response
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
