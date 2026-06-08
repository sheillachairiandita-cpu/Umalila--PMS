// backend/services/bookingConfirmationPdf.js
import { PDFDocument, fontFiles } from '../lib/pdfkitSetup.js';

const COLORS = {
  brandDark: '#0F172A',     
  brandMid: '#4F46E5',      
  brandAccent: '#16A34A',   
  textMuted: '#64748B',     
  text: '#1E293B',
};

const PROPERTY = {
  name: 'Villa Umalila',
  email: 'stayatumalila@gmail.com',
  instagram: '@stayatumalila',
  phone: '+62 822 6805 7800',
  address: 'Jl. Batu Bagiriak, Alahan Panjang, Kec. Lembah Gumanti, Kabupaten Solok, Sumatera Barat 27371',
};

function formatIdr(amount) {
  return Math.round(Number(amount) || 0).toLocaleString('id-ID');
}

export function generateBookingConfirmationPdf(summary) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });

      // Register fonts
      doc.registerFont('Roboto', fontFiles['Roboto-Regular.ttf']);
      doc.registerFont('RobotoBold', fontFiles['Roboto-Bold.ttf']);
      doc.registerFont('RobotoItalic', fontFiles['Roboto-Italic.ttf']);
      doc.registerFont('Courier', fontFiles['CourierPrime-Regular.ttf']);
      doc.registerFont('CourierBold', fontFiles['CourierPrime-Bold.ttf']);

      const guestName = summary.guestName || 'Valued Guest';
      const villaNames = summary.villaNames || 'Villa Unit';
      const checkIn = summary.checkInDate || '-';
      const checkOut = summary.checkOutDate || '-';
      const totalGuests = summary.totalGuests ? `${summary.totalGuests} Guests` : '6 Guests';

      // Calculate nights
      let nightCount = 1;
      if (summary.checkInDate && summary.checkOutDate) {
        const diffTime = Math.abs(new Date(summary.checkOutDate) - new Date(summary.checkInDate));
        nightCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // ========== HEADER ==========
      doc
        .font('RobotoBold')
        .fontSize(24)
        .fillColor(COLORS.brandDark)
        .text(PROPERTY.name, 50, 40);

      doc
        .font('RobotoBold')
        .fontSize(16)
        .fillColor(COLORS.brandMid)
        .text('BOOKING CONFIRMATION', 50, 70);

      doc
        .font('Courier')
        .fontSize(10)
        .fillColor(COLORS.textMuted)
        .text(`Invoice No: ${summary.displayId || summary.id || 'INV00107'}`, 50, 95);

      // ========== SALUTATION ==========
      doc
        .moveTo(50, 125)
        .lineTo(555, 125)
        .stroke(COLORS.borderLight);

      doc
        .font('RobotoBold')
        .fontSize(16)
        .fillColor(COLORS.brandDark)
        .text('Your reservation is confirmed!', 50, 145);

      doc
        .font('Roboto')
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(
          `Dear ${guestName}, thank you for choosing to stay at Villa Umalila. We're pleased to confirm your reservation parameters outlined below:`,
          50,
          170,
          { width: 505, align: 'left' }
        );

      // ========== RESERVATION DETAILS TABLE ==========
      let yPos = doc.y + 20;

      const details = [
        ['Guest Name', guestName],
        ['Villa Type', villaNames],
        ['No. of Guests', totalGuests],
        ['Check-in Date', `${checkIn} | After 2 PM`],
        ['Check-out Date', `${checkOut} | Before 11 AM`],
      ];

      doc
        .font('Roboto')
        .fontSize(10);

      details.forEach(([label, value]) => {
        doc.fillColor(COLORS.textMuted).text(label, 50, yPos, { width: 150 });
        doc.fillColor(COLORS.text).font('RobotoBold').text(value, 210, yPos - 15, { width: 345 });
        yPos += 25;
      });

      // ========== FINANCIAL BREAKDOWN ==========
      yPos += 10;
      doc
        .moveTo(50, yPos)
        .lineTo(555, yPos)
        .stroke(COLORS.borderLight);

      yPos += 15;
      doc
        .font('RobotoBold')
        .fontSize(12)
        .fillColor(COLORS.brandDark)
        .text('Financial Summary', 50, yPos);

      yPos += 25;

      // Table header
      const colX = { desc: 50, qty: 300, unit: 400, total: 480 };
      doc
        .font('RobotoBold')
        .fontSize(10)
        .fillColor(COLORS.brandDark);

      doc.text('Description', colX.desc, yPos);
      doc.text('Qty', colX.qty, yPos);
      doc.text('Unit Price', colX.unit, yPos);
      doc.text('Total', colX.total, yPos);

      yPos += 20;
      doc
        .moveTo(50, yPos - 5)
        .lineTo(555, yPos - 5)
        .stroke(COLORS.borderLight);

      // Calculate subtotal
      let subtotal = 0;

      if (Array.isArray(summary.villas) && summary.villas.length > 0) {
        summary.villas.forEach(v => {
          const rate = Number(v.rate) || 0;
          const qty = Number(v.nights) || nightCount;
          const lineTotal = rate * qty;
          subtotal += lineTotal;

          doc
            .font('Roboto')
            .fontSize(10)
            .fillColor(COLORS.text)
            .text(v.name || 'Villa Unit', colX.desc, yPos);

          doc.text(`${qty} night(s)`, colX.qty, yPos);
          doc.font('Courier').text(`${formatIdr(rate)}`, colX.unit, yPos);
          doc.font('CourierBold').text(`${formatIdr(lineTotal)}`, colX.total, yPos);

          yPos += 20;
        });
      }

      if (Array.isArray(summary.addons) && summary.addons.length > 0) {
        summary.addons.forEach(a => {
          const price = Number(a.unitPrice) || 0;
          const qty = Number(a.quantity) || 1;
          const lineTotal = price * qty;
          subtotal += lineTotal;

          doc
            .font('Roboto')
            .fontSize(10)
            .fillColor(COLORS.text)
            .text(a.name || 'Extra Service', colX.desc, yPos);

          doc.text(`${qty} unit(s)`, colX.qty, yPos);
          doc.font('Courier').text(`${formatIdr(price)}`, colX.unit, yPos);
          doc.font('CourierBold').text(`${formatIdr(lineTotal)}`, colX.total, yPos);

          yPos += 20;
        });
      }

      if (subtotal === 0) {
        const rawTotal = Number(summary.totalPrice) || 0;
        doc
          .font('Roboto')
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(villaNames, colX.desc, yPos);

        doc.text(`${nightCount} night(s)`, colX.qty, yPos);
        doc.font('Courier').text(`${formatIdr(rawTotal)}`, colX.unit, yPos);
        doc.font('CourierBold').text(`${formatIdr(rawTotal)}`, colX.total, yPos);

        subtotal = rawTotal;
      }

      yPos += 25;
      doc
        .moveTo(50, yPos - 5)
        .lineTo(555, yPos - 5)
        .stroke(COLORS.brandDark);

      doc
        .font('RobotoBold')
        .fontSize(11)
        .fillColor(COLORS.brandDark)
        .text('SUBTOTAL (IDR)', colX.desc, yPos);

      doc.text(`${formatIdr(subtotal)}`, colX.total, yPos);

      // ========== PAYMENT INSTRUCTIONS ==========
      yPos += 40;
      doc
        .font('RobotoBold')
        .fontSize(12)
        .fillColor(COLORS.brandDark)
        .text('Payment Instruction (IDR)', 50, yPos);

      yPos += 25;
      const paymentDetails = [
        ['Bank Details', ': Bank BNI'],
        ['Bank Account', ': 0174105357'],
        ['Name', ': Chairiyanto'],
      ];

      paymentDetails.forEach(([label, value]) => {
        doc
          .font('RobotoBold')
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(label, 50, yPos);

        doc
          .font('Courier')
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(value, 180, yPos - 15);

        yPos += 20;
      });

      yPos += 10;
      doc
        .font('Roboto')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(
          'Please send your payment details to complete your booking through our contact person.',
          50,
          yPos,
          { width: 505 }
        );

      // ========== IMPORTANT NOTICE ==========
      yPos += 40;
      doc
        .moveTo(50, yPos)
        .lineTo(555, yPos)
        .stroke(COLORS.borderLight);

      yPos += 15;
      doc
        .font('RobotoBold')
        .fontSize(11)
        .fillColor('#7F1D1D')
        .text('⚠️ Important Notice', 50, yPos);

      yPos += 20;
      doc
        .font('Roboto')
        .fontSize(9.5)
        .fillColor('#7F1D1D')
        .list(
          [
            'Please present your KTP and booking details during check-in.',
            'Villa Umalila does not accommodate unmarried couples.'
          ],
          50,
          yPos,
          { bulletRadius: 3 }
        );

      // ========== FOOTER ==========
      yPos = doc.page.height - 100;
      doc
        .font('RobotoBold')
        .fontSize(12)
        .fillColor(COLORS.text)
        .text(PROPERTY.name, 50, yPos, { align: 'center', width: 505 });

      yPos += 20;
      doc
        .font('Roboto')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(PROPERTY.address, 50, yPos, { align: 'center', width: 505 });

      yPos += 20;
      doc
        .font('Courier')
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(
          `Email: ${PROPERTY.email} | Contact: ${PROPERTY.phone} | Instagram: ${PROPERTY.instagram}`,
          50,
          yPos,
          { align: 'center', width: 505 }
        );

      yPos += 20;
      doc
        .font('RobotoBold')
        .fontSize(11)
        .fillColor(COLORS.brandMid)
        .text('Thank you for staying with us!', 50, yPos, { align: 'center', width: 505 });

      // Convert to Buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}