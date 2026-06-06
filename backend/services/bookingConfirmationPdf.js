/**
 * Booking Confirmation PDF — layout matched to the Umalila reference template.
 * Built in memory via pdfmake; never persisted to disk or Supabase Storage.
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

function brandHeader() {
  return {
    text: 'Umalila',
    style: 'brandTitle',
    alignment: 'center',
    margin: [0, 0, 0, 18],
  };
}

function labelValueTable(rows) {
  return {
    table: {
      widths: ['32%', '*'],
      body: rows.map(([label, value]) => [
        { text: label, style: 'infoLabel' },
        { text: value, style: 'infoValue' },
      ]),
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => COLORS.border,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 7,
      paddingBottom: () => 7,
      fillColor: (rowIndex) => (rowIndex % 2 === 0 ? COLORS.cream : COLORS.white),
    },
    margin: [0, 0, 0, 14],
  };
}

function buildConfirmationPage(summary) {
  const booking = summary.booking;
  const guestName = booking.guests?.full_name || 'Guest';
  const phone = booking.guests?.phone_number || '—';
  const nights = Math.max(
    Math.ceil(
      (new Date(booking.check_out_date) - new Date(booking.check_in_date)) /
        (1000 * 60 * 60 * 24)
    ),
    1
  );
  const guestCount = booking.total_guests || 1;

  return [
    brandHeader(),
    labelValueTable([
      ['Guest Name', guestName],
      ['Villa Type', summary.villaNames || '—'],
      ['No. of Guests', `${guestCount} Guest${guestCount !== 1 ? 's' : ''}`],
      ['Check-in Date', formatStayDate(booking.check_in_date, 'After 2 PM')],
      ['Check-out Date', formatStayDate(booking.check_out_date, 'Before 11 AM')],
    ]),
    {
      columns: [
        { text: PROPERTY.email, style: 'contactLine', alignment: 'center' },
        { text: PROPERTY.instagram, style: 'contactLine', alignment: 'center' },
        { text: PROPERTY.phone, style: 'contactLine', alignment: 'center' },
      ],
      margin: [0, 0, 0, 22],
    },
    {
      text: 'Your reservation is confirmed!',
      style: 'confirmHeadline',
      alignment: 'center',
      margin: [0, 0, 0, 14],
    },
    {
      text: [
        'Dear ',
        { text: guestFirstName(guestName), bold: true },
        ',\nThank you for choosing to stay at Villa Umalila. We\u2019re pleased to confirm your reservation for ',
        { text: stayDurationLabel(booking.check_in_date, booking.check_out_date, nights), bold: true },
        '.',
      ],
      style: 'bodyText',
      alignment: 'center',
      margin: [24, 0, 24, 18],
    },
    { text: 'Reservation Details', style: 'sectionTitle', margin: [0, 0, 0, 8] },
    {
      text: 'We look forward to welcoming you to Villa Umalila.',
      style: 'bodyText',
      margin: [0, 0, 0, 18],
    },
    {
      text: 'Important Notice',
      style: 'sectionTitle',
      margin: [0, 0, 0, 8],
    },
    {
      ul: [
        'Please present your KTP and booking details during check-in.',
        'Villa Umalila does not accomodate unmarried couples.',
      ],
      style: 'noticeList',
      margin: [8, 0, 0, 28],
    },
    {
      stack: [
        { text: PROPERTY.name, style: 'footerBrand' },
        ...PROPERTY.addressLines.map((line) => ({ text: line, style: 'footerAddress' })),
      ],
      margin: [0, 12, 0, 0],
    },
    { text: '', pageBreak: 'after' },
  ];
}

function buildInvoiceTableBody(lineItems, subtotal) {
  const body = [
    [
      { text: 'DESCRIPTION', style: 'invoiceTh', alignment: 'left' },
      { text: 'QTY', style: 'invoiceTh', alignment: 'center' },
      { text: 'UNIT PRICE', style: 'invoiceTh', alignment: 'right' },
      { text: 'TOTAL PRICE', style: 'invoiceTh', alignment: 'right' },
    ],
  ];

  lineItems.forEach((line) => {
    body.push([
      { text: line.description || line.name || 'Item', style: 'invoiceItemDesc' },
      { text: formatLineQty(line), style: 'invoiceItemQty', alignment: 'center' },
      { text: formatIdr(line.unitPrice), style: 'invoiceItemMoney', alignment: 'right' },
      { text: formatIdr(line.subtotal), style: 'invoiceItemMoney', alignment: 'right' },
    ]);
  });

  body.push([
    { text: 'SUB TOTAL (IDR)', style: 'subtotalLabel', colSpan: 3, alignment: 'right' },
    {},
    {},
    {
      text: formatIdr(subtotal),
      style: 'subtotalValue',
      alignment: 'right',
    },
  ]);

  return body;
}

function buildInvoicePage(summary) {
  const booking = summary.booking;
  const guestName = booking.guests?.full_name || 'Guest';
  const phone = booking.guests?.phone_number || '—';
  const displayId = summary.displayId;
  const invoiceDate = formatInvoiceDate(booking.created_at);
  const lineItems = summary.lineItems?.length
    ? summary.lineItems
    : [
        {
          type: 'accommodation',
          description: summary.villaNames || 'Accommodation',
          quantity: Math.max(
            Math.ceil(
              (new Date(booking.check_out_date) - new Date(booking.check_in_date)) /
                (1000 * 60 * 60 * 24)
            ),
            1
          ),
          unitPrice: summary.accommodation,
          subtotal: summary.accommodation,
        },
      ];

  const subtotal = summary.total;

  return [
    brandHeader(),
    {
      table: {
        headerRows: 1,
        widths: ['*', 70, 85, 85],
        body: buildInvoiceTableBody(lineItems, subtotal),
      },
      layout: {
        hLineWidth: (i, node) => {
          if (i === 0 || i === 1) return 0;
          if (i === node.table.body.length) return 1;
          return 0.5;
        },
        vLineWidth: () => 0,
        hLineColor: () => COLORS.border,
        fillColor: (rowIndex) => {
          if (rowIndex === 0) return COLORS.tableHead;
          if (rowIndex === lineItems.length + 1) return COLORS.cream;
          return rowIndex % 2 === 0 ? COLORS.white : COLORS.cream;
        },
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        {
          width: '48%',
          stack: [
            { text: 'Bill To', style: 'billSectionTitle', margin: [0, 0, 0, 8] },
            {
              table: {
                widths: [68, '*'],
                body: [
                  [
                    { text: 'Customer', style: 'billLabel' },
                    { text: `: ${guestName}`, style: 'billValue' },
                  ],
                  [
                    { text: 'Contact', style: 'billLabel' },
                    { text: `: ${phone}`, style: 'billValue' },
                  ],
                ],
              },
              layout: 'noBorders',
            },
            { text: PROPERTY.name, style: 'billAddressTitle', margin: [0, 12, 0, 4] },
            ...PROPERTY.addressLines.map((line) => ({
              text: line,
              style: 'billAddressLine',
            })),
            { text: `Contact: ${PROPERTY.phone}`, style: 'billAddressLine', margin: [0, 4, 0, 0] },
          ],
        },
        {
          width: '4%',
          text: '',
        },
        {
          width: '48%',
          stack: [
            {
              table: {
                widths: [72, '*'],
                body: [
                  [
                    { text: 'Invoice No', style: 'billLabel' },
                    { text: `: ${displayId}`, style: 'billValueBold' },
                  ],
                  [
                    { text: 'Date', style: 'billLabel' },
                    { text: `: ${invoiceDate}`, style: 'billValue' },
                  ],
                ],
              },
              layout: 'noBorders',
              margin: [0, 0, 0, 16],
            },
            { text: 'Payment Instruction (IDR)', style: 'billSectionTitle', margin: [0, 0, 0, 8] },
            { text: 'Bank Details', style: 'paymentSubtitle', margin: [0, 0, 0, 6] },
            {
              table: {
                widths: [88, '*'],
                body: [
                  [
                    { text: 'Bank Account', style: 'billLabel' },
                    { text: `: ${PROPERTY.bankName}`, style: 'billValue' },
                  ],
                  [
                    { text: '', style: 'billLabel' },
                    { text: `: ${PROPERTY.bankAccount}`, style: 'billValue' },
                  ],
                  [
                    { text: 'Name', style: 'billLabel' },
                    { text: `: ${PROPERTY.bankAccountName}`, style: 'billValue' },
                  ],
                ],
              },
              layout: 'noBorders',
            },
            {
              text:
                'Please send your payment details to complete your booking through our contact person.',
              style: 'paymentNote',
              margin: [0, 10, 0, 0],
            },
          ],
        },
      ],
      margin: [0, 0, 0, 24],
    },
    {
      text: 'Thank you for staying with us!',
      style: 'thankYou',
      alignment: 'center',
    },
  ];
}

export function buildBookingConfirmationDocDefinition(summary) {
  return {
    pageSize: 'A4',
    pageMargins: [48, 48, 48, 48],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 10,
      color: COLORS.text,
      lineHeight: 1.35,
    },
    styles: {
      brandTitle: {
        fontSize: 28,
        bold: true,
        color: COLORS.brandDark,
        characterSpacing: 1.5,
      },
      infoLabel: {
        fontSize: 9,
        color: COLORS.textMuted,
        bold: true,
      },
      infoValue: {
        fontSize: 10,
        color: COLORS.text,
        alignment: 'right',
      },
      contactLine: {
        fontSize: 8.5,
        color: COLORS.brandMid,
      },
      confirmHeadline: {
        fontSize: 14,
        bold: true,
        color: COLORS.brandDark,
      },
      bodyText: {
        fontSize: 10,
        color: COLORS.text,
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: COLORS.brandDark,
      },
      noticeList: {
        fontSize: 9.5,
        color: COLORS.textMuted,
      },
      footerBrand: {
        fontSize: 10,
        bold: true,
        color: COLORS.brandDark,
      },
      footerAddress: {
        fontSize: 9,
        color: COLORS.textMuted,
      },
      invoiceTh: {
        fontSize: 8,
        bold: true,
        color: COLORS.white,
        margin: [0, 2, 0, 2],
      },
      invoiceItemDesc: {
        fontSize: 9.5,
        color: COLORS.text,
      },
      invoiceItemQty: {
        fontSize: 9,
        color: COLORS.textMuted,
      },
      invoiceItemMoney: {
        fontSize: 9.5,
        color: COLORS.text,
      },
      subtotalLabel: {
        fontSize: 10,
        bold: true,
        color: COLORS.brandDark,
        margin: [0, 4, 8, 4],
      },
      subtotalValue: {
        fontSize: 11,
        bold: true,
        color: COLORS.brandDark,
        margin: [0, 4, 0, 4],
      },
      billSectionTitle: {
        fontSize: 10,
        bold: true,
        color: COLORS.brandDark,
      },
      billLabel: {
        fontSize: 9,
        color: COLORS.textMuted,
      },
      billValue: {
        fontSize: 9,
        color: COLORS.text,
      },
      billValueBold: {
        fontSize: 9,
        bold: true,
        color: COLORS.brandDark,
      },
      billAddressTitle: {
        fontSize: 9,
        bold: true,
        color: COLORS.text,
      },
      billAddressLine: {
        fontSize: 8.5,
        color: COLORS.textMuted,
      },
      paymentSubtitle: {
        fontSize: 9,
        bold: true,
        color: COLORS.brandMid,
      },
      paymentNote: {
        fontSize: 8.5,
        color: COLORS.textMuted,
        italics: true,
      },
      thankYou: {
        fontSize: 11,
        bold: true,
        color: COLORS.brandAccent,
      },
    },
    background: (currentPage) => {
      if (currentPage === 1) {
        return {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: 595.28,
              h: 841.89,
              color: COLORS.white,
            },
          ],
        };
      }
      return null;
    },
    content: [
      ...buildConfirmationPage(summary),
      ...buildInvoicePage(summary),
    ],
    info: {
      title: `Booking Confirmation - ${summary.displayId}`,
      author: 'Villa Umalila',
      subject: 'Booking Confirmation',
    },
    compress: true,
  };
}

export async function streamBookingConfirmationPdf(summary, writableStream) {
  const docDefinition = buildBookingConfirmationDocDefinition(summary);
  const pdfDoc = pdfmake.createPdf(docDefinition);
  const stream = await pdfDoc.getStream();

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    writableStream.on('error', reject);
    writableStream.on('finish', resolve);
    stream.pipe(writableStream);
    stream.end();
  });
}
