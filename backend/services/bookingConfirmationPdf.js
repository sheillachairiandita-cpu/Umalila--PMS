/**
 * Booking Confirmation PDF – Layout matched to the Umalila reference template.
 * Built in memory via pdfmake; never persisted to disk or Supabase Storage.
 */

import printer from '../lib/pdfmakeSetup.js';

const COLORS = {
  brandDark: '#0F172A',     
  brandMid: '#4F46E5',      
  brandAccent: '#16A34A',   
  cream: '#F8FAFC',         
  border: '#E2E8F0',        
  text: '#1E293B',          
  textMuted: '#64748B',     
  white: '#FFFFFF',
  tableHead: '#F1F5F9',     
  alertBg: '#FFFBFA',       
  alertBorder: '#FEE2E2',   
  alertText: '#7F1D1D',     
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
};

function formatIdr(amount) {
  return Math.round(Number(amount) || 0).toLocaleString('de-DE');
}

function buildConfirmationContent(summary) {
  const guestName = summary.guestName || 'Valued Guest';
  const villaNames = summary.villaNames || 'Villa Unit';
  const checkIn = summary.checkInDate || '-';
  const checkOut = summary.checkOutDate || '-';
  const totalGuests = summary.totalGuests ? `${summary.totalGuests} Guests` : '6 Guests';
  
  let nightCountText = '1 Night';
  if (summary.checkInDate && summary.checkOutDate) {
    try {
      const diffTime = Math.abs(new Date(summary.checkOutDate) - new Date(summary.checkInDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        nightCountText = `${diffDays} ${diffDays === 1 ? 'Night' : 'Nights'}`;
      }
    } catch (e) {
      nightCountText = '1 Night';
    }
  }

  // 1. Header Layout Block
  const headerTable = {
    style: 'headerTable',
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            columns: [
              {
                canvas: [
                  { type: 'rect', x: 0, y: 0, w: 36, h: 36, r: 8, color: COLORS.brandMid }
                ],
                width: 42,
              },
              {
                text: PROPERTY.name,
                fontSize: 22,
                bold: true,
                color: COLORS.brandDark,
                margin: [0, 4, 0, 0],
              }
            ]
          },
          {
            stack: [
              { text: 'BOOKING CONFIRMATION', fontSize: 16, bold: true, color: COLORS.brandMid, alignment: 'right' },
              { text: `Invoice No: ${summary.displayId || summary.id || 'INV00107'}`, fontSize: 10, font: 'Courier', color: COLORS.textMuted, alignment: 'right', margin: [0, 4, 0, 0] }
            ],
            alignment: 'right'
          }
        ]
      ]
    },
    layout: 'noBorders'
  };

  // 2. Welcome Message
  const salutationBlock = {
    stack: [
      { text: 'Your reservation is confirmed!', fontSize: 16, bold: true, color: COLORS.brandDark, margin: [0, 0, 0, 4] },
      {
        text: [
          'Dear ',
          { text: guestName, bold: true },
          `, thank you for choosing to stay at Villa Umalila. We're pleased to confirm your reservation parameters outlined below:`
        ],
        fontSize: 11,
        color: COLORS.text,
        lineHeight: 1.4
      }
    ],
    margin: [0, 15, 0, 15]
  };

  // 3. Structured Reservation Table Layout
  const parametersGrid = {
    style: 'paramCard',
    table: {
      widths: ['35%', '65%'],
      body: [
        [{ text: 'Guest Name', style: 'gridLabel' }, { text: guestName, style: 'gridValue' }],
        [{ text: 'Villa Type', style: 'gridLabel' }, { text: villaNames, style: 'gridValue' }],
        [{ text: 'No. of Guests', style: 'gridLabel' }, { text: totalGuests, style: 'gridValue' }],
        [{ text: 'Check-in Date', style: 'gridLabel' }, { text: `${checkIn} | After 2 PM`, style: 'gridValue' }],
        [{ text: 'Check-out Date', style: 'gridLabel' }, { text: `${checkOut} | Before 11 AM`, style: 'gridValue' }]
      ]
    },
    layout: {
      hLineWidth: (i) => (i === 0 || i === 5 ? 1 : 1),
      vLineWidth: () => 1,
      hLineColor: () => COLORS.border,
      vLineColor: () => COLORS.border,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    }
  };

  // 4. Financial Calculations Array 
  const invoiceRows = [];
  let calculatedSubtotal = 0;

  if (Array.isArray(summary.villas) && summary.villas.length > 0) {
    summary.villas.forEach(v => {
      const rate = Number(v.rate) || 0;
      const qty = Number(v.nights) || 1;
      const lineTotal = rate * qty;
      calculatedSubtotal += lineTotal;

      invoiceRows.push([
        { text: v.name || 'Villa Unit Allocation', style: 'tableCell' },
        { text: `${qty} Night(s)`, style: 'tableCellCenter' },
        { text: `${formatIdr(rate)}`, style: 'tableCellRight', font: 'Courier' },
        { text: `${formatIdr(lineTotal)}`, style: 'tableCellRight', font: 'Courier', bold: true }
      ]);
    });
  }

  if (Array.isArray(summary.addons) && summary.addons.length > 0) {
    summary.addons.forEach(a => {
      const price = Number(a.unitPrice) || 0;
      const qty = Number(a.quantity) || 1;
      const lineTotal = price * qty;
      calculatedSubtotal += lineTotal;

      invoiceRows.push([
        { text: a.name || 'Extra Service Addon', style: 'tableCell' },
        { text: `${qty} Unit(s)`, style: 'tableCellCenter' },
        { text: `${formatIdr(price)}`, style: 'tableCellRight', font: 'Courier' },
        { text: `${formatIdr(lineTotal)}`, style: 'tableCellRight', font: 'Courier', bold: true }
      ]);
    });
  }

  if (invoiceRows.length === 0) {
    const rawTotal = Number(summary.totalPrice) || 0;
    invoiceRows.push([
      { text: villaNames, style: 'tableCell' },
      { text: nightCountText, style: 'tableCellCenter' },
      { text: `${formatIdr(rawTotal)}`, style: 'tableCellRight', font: 'Courier' },
      { text: `${formatIdr(rawTotal)}`, style: 'tableCellRight', font: 'Courier', bold: true }
    ]);
    calculatedSubtotal = rawTotal;
  }

  // 5. Invoice Breakdown Matrix
  const financialTable = {
    style: 'financialTable',
    table: {
      widths: ['*', '15%', '22%', '22%'],
      headerRows: 1,
      body: [
        [
          { text: 'DESCRIPTION', style: 'tableHeader' },
          { text: 'QTY', style: 'tableHeaderCenter' },
          { text: 'UNIT PRICE', style: 'tableHeaderRight' },
          { text: 'TOTAL PRICE', style: 'tableHeaderRight' }
        ],
        ...invoiceRows,
        [
          { text: '', colspan: 2, border: [false, false, false, false] },
          {},
          { text: 'SUB TOTAL (IDR)', style: 'summaryLabel', border: [false, true, false, false] },
          { text: `${formatIdr(calculatedSubtotal)}`, style: 'summaryValue', font: 'Courier', border: [false, true, false, false] }
        ]
      ]
    },
    layout: {
      hLineWidth: (i, node) => (i === 1 ? 1.5 : i > 1 && i <= node.table.body.length - 1 ? 1 : 0),
      vLineWidth: () => 0,
      hLineColor: (i) => (i === 1 ? COLORS.brandDark : COLORS.border),
      paddingTop: () => 8,
      paddingBottom: () => 8,
    }
  };

  // 6. Payment Instructions Setup Block
  const paymentBlock = {
    stack: [
      { text: 'Payment Instruction (IDR)', fontSize: 12, bold: true, color: COLORS.brandDark, margin: [0, 5, 0, 5] },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Bank Details', style: 'paymentLabel' }, { text: ': Bank BNI', style: 'paymentValue' }],
            [{ text: 'Bank Account', style: 'paymentLabel' }, { text: ': 0174105357', style: 'paymentValue', font: 'Courier' }],
            [{ text: 'Name', style: 'paymentLabel' }, { text: ': Chairiyanto', style: 'paymentValue' }]
          ]
        },
        layout: 'noBorders'
      },
      { text: 'Please send your payment details to complete your booking through our contact person.', fontSize: 9.5, color: COLORS.textMuted, margin: [0, 6, 0, 0] }
    ],
    margin: [0, 0, 0, 15]
  };

  // 7. Core Rules Notification
  const operationalTermsCard = {
    style: 'alertCard',
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: 'Important Notice', fontSize: 11, bold: true, color: COLORS.alertText, margin: [0, 0, 0, 4] },
              {
                ul: [
                  'Please present your KTP and booking details during check-in.',
                  'Villa Umalila does not accommodate unmarried couples.'
                ],
                fontSize: 9.5,
                color: COLORS.alertText,
                lineHeight: 1.4
              }
            ]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 1, vLineWidth: () => 1,
      hLineColor: () => COLORS.alertBorder, vLineColor: () => COLORS.alertBorder,
      fillColor: () => COLORS.alertBg,
    },
    margin: [0, 0, 0, 20]
  };

  // 8. Base Footer Elements 
  const locationFooter = {
    stack: [
      { text: PROPERTY.name, fontSize: 12, bold: true, color: COLORS.text, alignment: 'center', margin: [0, 0, 0, 2] },
      { text: PROPERTY.addressLines.join(' '), fontSize: 9, color: COLORS.textMuted, alignment: 'center', margin: [0, 0, 0, 4] },
      {
        text: `Email: ${PROPERTY.email}   |   Contact: ${PROPERTY.phone}   |   Instagram: ${PROPERTY.instagram}`,
        fontSize: 9, color: COLORS.textMuted, alignment: 'center', font: 'Courier'
      },
      { text: 'Thank you for staying with us!', fontSize: 11, bold: true, color: COLORS.brandMid, alignment: 'center', margin: [0, 8, 0, 0] }
    ],
    margin: [0, 10, 0, 0]
  };

  return [
    headerTable,
    salutationBlock,
    parametersGrid,
    financialTable,
    paymentBlock,
    operationalTermsCard,
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: COLORS.border }] },
    locationFooter
  ];
}

function buildBookingConfirmationDocDefinition(summary) {
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto' },
    styles: {
      headerTable: { margin: [0, 0, 0, 10] },
      gridLabel: { fontSize: 10, bold: true, color: COLORS.text, fillColor: COLORS.tableHead },
      gridValue: { fontSize: 10, color: COLORS.text },
      financialTable: { margin: [0, 10, 0, 15] },
      tableHeader: { fontSize: 10, bold: true, color: COLORS.text, fillColor: COLORS.tableHead },
      tableHeaderCenter: { fontSize: 10, bold: true, color: COLORS.text, alignment: 'center', fillColor: COLORS.tableHead },
      tableHeaderRight: { fontSize: 10, bold: true, color: COLORS.text, alignment: 'right', fillColor: COLORS.tableHead },
      tableCell: { fontSize: 10, color: COLORS.text },
      tableCellCenter: { fontSize: 10, color: COLORS.textMuted, alignment: 'center' },
      tableCellRight: { fontSize: 10, color: COLORS.text, alignment: 'right' },
      summaryLabel: { fontSize: 10, bold: true, color: COLORS.text, alignment: 'right' },
      summaryValue: { fontSize: 10, bold: true, color: COLORS.brandDark, alignment: 'right' },
      paymentLabel: { fontSize: 10, color: COLORS.textMuted },
      paymentValue: { fontSize: 10, bold: true, color: COLORS.text }
    },
    content: buildConfirmationContent(summary),
    info: {
      title: `Booking Confirmation - ${summary.displayId || 'Umalila'}`,
      author: 'Villa Umalila'
    },
    compress: true,
  };
}

// Stream exporter hook initialized beautifully at the absolute bottom
export async function streamBookingConfirmationPdf(summary, writableStream) {
  return new Promise((resolve, reject) => {
    try {
      const docDefinition = buildBookingConfirmationDocDefinition(summary);
      const pdfDocStream = printer.createPdfKitDocument(docDefinition);

      pdfDocStream.pipe(writableStream);

      pdfDocStream.on('end', () => resolve());
      pdfDocStream.on('error', (err) => {
        console.error('PDF Engine Stream Error:', err);
        reject(err);
      });

      pdfDocStream.end();
    } catch (error) {
      console.error('Layout Generation Crash Intercepted:', error);
      writableStream.end(); 
      reject(error);
    }
  });
}