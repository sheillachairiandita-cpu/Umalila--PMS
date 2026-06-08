/**
 * Booking Confirmation PDF — layout matched to the Umalila reference template.
 * Built in memory via pdfmake; never persisted to disk or Supabase Storage.
 */

import pdfmake from '../lib/pdfmakeSetup.js';

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
  const totalGuests = summary.totalGuests ? `${summary.totalGuests} Guests` : '10 Guests';
  
  let nightCountText = '1 Night';
  if (summary.checkInDate && summary.checkOutDate) {
    try {
      const diffTime = Math.abs(new Date(summary.checkOutDate) - new Date(summary.checkInDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        nightCountText = `${diffDays + 1} Days / ${diffDays} ${diffDays === 1 ? 'Night' : 'Nights'}`;
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
                fontSize: 20,
                bold: true,
                color: COLORS.brandDark,
                margin: [0, 6, 0, 0],
              }
            ]
          },
          {
            stack: [
              { text: 'BOOKING CONFIRMATION', fontSize: 20, bold: true, color: COLORS.brandMid, alignment: 'right' },
              { text: `Document No: ${summary.displayId || summary.id || 'INV00108'}`, fontSize: 10, font: 'Courier', color: COLORS.textMuted, alignment: 'right', margin: [0, 4, 0, 0] }
            ],
            alignment: 'right'
          }
        ]
      ]
    },
    layout: 'noBorders'
  };

  // 2. Personal Message Salutation
  const salutationBlock = {
    stack: [
      { text: 'Reservation Confirmed!', fontSize: 16, bold: true, color: COLORS.brandDark, margin: [0, 0, 0, 4] },
      {
        text: [
          'Dear ',
          { text: guestName, bold: true },
          ', thank you for choosing to stay with us. We are pleased to confirm your upcoming booking parameters outlined below:'
        ],
        fontSize: 11,
        color: COLORS.text,
        lineHeight: 1.4
      }
    ],
    margin: [0, 0, 0, 20]
  };

  // 3. Staying Details Parameter Grid Container
  const parametersGrid = {
    style: 'paramCard',
    table: {
      widths: ['25%', '25%', '25%', '25%'],
      body: [
        [
          { text: 'Selected Property', style: 'gridLabel' },
          { text: villaNames, style: 'gridValue' },
          { text: 'Check-In Date', style: 'gridLabel' },
          { text: `${checkIn}\n(After 2 PM)`, style: 'gridValue' }
        ],
        [
          { text: 'Registered Party', style: 'gridLabel' },
          { text: totalGuests, style: 'gridValue' },
          { text: 'Check-Out Date', style: 'gridLabel' },
          { text: `${checkOut}\n(Before 11 AM)`, style: 'gridValue' }
        ],
        [
          { text: 'Total Duration', style: 'gridLabel' },
          { text: nightCountText, style: 'gridValue' },
          { text: 'Primary Contact', style: 'gridLabel' },
          { text: summary.guestPhone || '-', style: 'gridValue', font: 'Courier' }
        ]
      ]
    },
    layout: 'noBorders'
  };

  // 4. Financial Line Allocations Array Setup
  const invoiceRows = [];
  let calculatedSubtotal = 0;

  if (Array.isArray(summary.villas) && summary.villas.length > 0) {
    summary.villas.forEach(v => {
      const rate = Number(v.rate) || 0;
      const qty = Number(v.nights) || 1;
      const lineTotal = rate * qty;
      calculatedSubtotal += lineTotal;

      invoiceRows.push([
        { text: `${v.name || 'Villa Unit'} Allocation`, style: 'tableCell' },
        { text: `${qty} Night(s)`, style: 'tableCellCenter' },
        { text: `Rp ${formatIdr(rate)}`, style: 'tableCellRight', font: 'Courier' },
        { text: `Rp ${formatIdr(lineTotal)}`, style: 'tableCellRight', font: 'Courier', bold: true }
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
        { text: a.name || 'Addon Charge', style: 'tableCell' },
        { text: `${qty} Unit(s)`, style: 'tableCellCenter' },
        { text: `Rp ${formatIdr(price)}`, style: 'tableCellRight', font: 'Courier' },
        { text: `Rp ${formatIdr(lineTotal)}`, style: 'tableCellRight', font: 'Courier', bold: true }
      ]);
    });
  }

  if (invoiceRows.length === 0) {
    const rawTotal = Number(summary.totalPrice) || 0;
    invoiceRows.push([
      { text: `${villaNames || 'Villa Unit'} Booking Retention`, style: 'tableCell' },
      { text: '1 Unit', style: 'tableCellCenter' },
      { text: `Rp ${formatIdr(rawTotal)}`, style: 'tableCellRight', font: 'Courier' },
      { text: `Rp ${formatIdr(rawTotal)}`, style: 'tableCellRight', font: 'Courier', bold: true }
    ]);
    calculatedSubtotal = rawTotal;
  }

  const explicitDiscountAmount = Number(summary.discountAmount) || 0;
  const grandNetPayable = Math.max(calculatedSubtotal - explicitDiscountAmount, 0);

  // 5. Itemized Breakdown Pricing Layout
  const financialTable = {
    style: 'financialTable',
    table: {
      widths: ['*', '15%', '22%', '22%'],
      headerRows: 1,
      body: [
        [
          { text: 'Description Reference', style: 'tableHeader' },
          { text: 'Qty', style: 'tableHeaderCenter' },
          { text: 'Rate Unit', style: 'tableHeaderRight' },
          { text: 'Gross Total', style: 'tableHeaderRight' }
        ],
        ...invoiceRows,
        [
          { text: '', colspan: 2, border: [false, false, false, false] },
          {},
          { text: 'Subtotal Amount:', style: 'summaryLabel', border: [false, true, false, false] },
          { text: `Rp ${formatIdr(calculatedSubtotal)}`, style: 'summaryValue', font: 'Courier', border: [false, true, false, false] }
        ],
        [
          { text: '', colspan: 2, border: [false, false, false, false] },
          {},
          { text: 'Campaign Discount:', style: 'summaryLabel', border: [false, false, false, false] },
          { text: explicitDiscountAmount > 0 ? `-Rp ${formatIdr(explicitDiscountAmount)}` : 'Rp 0', style: 'discountValue', font: 'Courier', border: [false, false, false, false] }
        ],
        [
          { text: '', colspan: 2, border: [false, false, false, false] },
          {},
          { text: 'Net Total Paid:', style: 'grandTotalLabel', border: [false, false, false, true] },
          { text: `Rp ${formatIdr(grandNetPayable)}`, style: 'grandTotalValue', font: 'Courier', border: [false, false, false, true] }
        ]
      ]
    },
    layout: {
      hLineWidth: (i, node) => (i === 1 ? 2 : i > 1 && i <= node.table.body.length - 3 ? 1 : 0),
      vLineWidth: () => 0,
      hLineColor: (i, node) => (i === 1 ? COLORS.brandDark : COLORS.border),
      paddingTop: (i) => (i === 0 ? 6 : 8),
      paddingBottom: (i) => (i === 0 ? 6 : 8),
    }
  };

  // 6. Operational Guardrails Notice Card
  const operationalTermsCard = {
    style: 'alertCard',
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: 'IMPORTANT OPERATIONAL TERMS', fontSize: 10, bold: true, color: COLORS.alertText, margin: [0, 0, 0, 4] },
              {
                ul: [
                  'Please present valid national identification documents (KTP/Passport) for all checking-in members upon arrival.',
                  'To honor local operational policies, Villa Umalila explicitly accommodates family structures or married couples only.'
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

  // 7. Base Location Address Footer
  const locationFooter = {
    stack: [
      { text: PROPERTY.name, fontSize: 11, bold: true, color: COLORS.text, alignment: 'center', margin: [0, 0, 0, 2] },
      { text: PROPERTY.addressLines.join(' '), fontSize: 9, color: COLORS.textMuted, alignment: 'center', margin: [0, 0, 0, 4] },
      {
        text: `📧 ${PROPERTY.email}   |   📞 ${PROPERTY.phone}   |   📸 ${PROPERTY.instagram}`,
        fontSize: 9, color: COLORS.textMuted, alignment: 'center', font: 'Courier'
      }
    ],
    margin: [0, 10, 0, 0]
  };

  return [
    headerTable,
    { text: '', margin: [0, 10] },
    salutationBlock,
    parametersGrid,
    { text: '', margin: [0, 5] },
    financialTable,
    { text: '', margin: [0, 5] },
    operationalTermsCard,
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: COLORS.border }] },
    locationFooter
  ];
}

function buildBookingConfirmationDocDefinition(summary) {
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'Roboto' // Safe registration fallback verified via updated setup
    },
    styles: {
      headerTable: { margin: [0, 0, 0, 10] },
      paramCard: { margin: [0, 0, 0, 10], fillColor: COLORS.cream },
      gridLabel: { fontSize: 10.5, color: COLORS.textMuted, padding: [10, 6, 10, 6] },
      gridValue: { fontSize: 10.5, bold: true, color: COLORS.brandDark, padding: [10, 6, 10, 6] },
      financialTable: { margin: [0, 10, 0, 15] },
      tableHeader: { fontSize: 10.5, bold: true, color: COLORS.text, fillColor: COLORS.tableHead },
      tableHeaderCenter: { fontSize: 10.5, bold: true, color: COLORS.text, alignment: 'center', fillColor: COLORS.tableHead },
      tableHeaderRight: { fontSize: 10.5, bold: true, color: COLORS.text, alignment: 'right', fillColor: COLORS.tableHead },
      tableCell: { fontSize: 10.5, color: COLORS.text, margin: [0, 2, 0, 2] },
      tableCellCenter: { fontSize: 10.5, color: COLORS.textMuted, alignment: 'center', margin: [0, 2, 0, 2] },
      tableCellRight: { fontSize: 10.5, color: COLORS.text, alignment: 'right', margin: [0, 2, 0, 2] },
      summaryLabel: { fontSize: 10.5, bold: true, color: COLORS.textMuted, alignment: 'right', margin: [0, 4, 0, 2] },
      summaryValue: { fontSize: 10.5, bold: true, color: COLORS.brandDark, alignment: 'right', margin: [0, 4, 0, 2] },
      discountValue: { fontSize: 10.5, bold: true, color: COLORS.brandAccent, alignment: 'right', margin: [0, 2, 0, 2] },
      grandTotalLabel: { fontSize: 11.5, bold: true, color: COLORS.brandDark, alignment: 'right', margin: [0, 4, 0, 4] },
      grandTotalValue: { fontSize: 12.5, bold: true, color: COLORS.brandMid, alignment: 'right', margin: [0, 4, 0, 4] }
    },
    content: buildConfirmationContent(summary),
    info: {
      title: `Booking Confirmation - ${summary.displayId || 'Umalila'}`,
      author: 'Villa Umalila'
    },
    compress: true,
  };
}

export async function streamBookingConfirmationPdf(summary, writableStream) {
  try {
    const docDefinition = buildBookingConfirmationDocDefinition(summary);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const stream = await pdfDoc.getStream();

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => writableStream.write(chunk));
      stream.on('end', () => {
        writableStream.end();
        resolve();
      });
      stream.on('error', (err) => {
        writableStream.end();
        reject(err);
      });
    });
  } catch (error) {
    console.error('💥 Layout Generation Crash Intercepted:', error);
    writableStream.end(); // Forces the browser request to terminate cleanly rather than hanging
    throw error;
  }
}