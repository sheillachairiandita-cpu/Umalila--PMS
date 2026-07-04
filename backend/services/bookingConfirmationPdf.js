
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PNG_CANDIDATES = [
  path.resolve(__dirname, '../assets/Umalila-w.png'),
  path.resolve(__dirname, '../../frontend/public/Umalila-w.png'),
];

function resolveLogoPngPath() {
  for (const candidate of LOGO_PNG_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return LOGO_PNG_CANDIDATES[0];
}
const FONT_DIR      = path.resolve(__dirname, '../lib/fonts');
const FONT_REGULAR  = path.join(FONT_DIR, 'Poppins-Regular.ttf');
const FONT_SEMIBOLD = path.join(FONT_DIR, 'Poppins-SemiBold.ttf');

const F = { regular: 'Poppins', semibold: 'Poppins-SemiBold' };

// ─── Brand colours ────────────────────────────────────────────────────────────

const C = {
  brandBlue: '#363481',
  text:      '#000000',
  white:     '#FFFFFF',
  border:    '#000000',
};

// ─── Property constants ───────────────────────────────────────────────────────

const PROPERTY = {
  name:            'Villa Umalila',
  email:           'stayatumalila@gmail.com',
  instagram:       '@stayatumalila',
  phone:           '+62 822 6805 7800',
  address:         'Jl. Batu Bagiriak, Alahan Panjang, Kec. Lembah Gumanti, Kabupaten Solok, Sumatera Barat 27371',
  bankName:        'Bank BNI',
  bankAccount:     '0174105357',
  bankAccountName: 'Chairiyanto',
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN   = 48;
const PW       = 595.28;
const PH       = 841.89;
const CONTENT  = PW - MARGIN * 2;
const HEADER_H = 96;
const HEADER_LOGO_PAD = 18;
// Display width for header logo; height is derived from PNG aspect ratio (auto).
const LOGO_TARGET_WIDTH = 148;
const LOGO_MAX_HEIGHT   = HEADER_H - HEADER_LOGO_PAD;
// ─── Logo ─────────────────────────────────────────────────────────────────────

/** @type {{ buffer: Buffer, width: number, height: number } | null} */
let logoCache = null;

function isLogoPixel(r, g, b) {
  return r > 70 || g > 70 || b > 70;
}

/**
 * Load backend/assets/Umalila-w.png (or frontend/public fallback), key out the black
 * the visible white wordmark so it sits transparently on the purple header.
 */
function processLogoPng(filePath) {
  const source = PNG.sync.read(fs.readFileSync(filePath));
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const idx = (source.width * y + x) << 2;
      const r = source.data[idx];
      const g = source.data[idx + 1];
      const b = source.data[idx + 2];

      if (r < 55 && g < 55 && b < 55) {
        source.data[idx + 3] = 0;
        continue;
      }

      source.data[idx + 3] = 255;
      if (isLogoPixel(r, g, b)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('Logo PNG has no visible artwork after background removal');
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = new PNG({ width: cropW, height: cropH });

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = ((minY + y) * source.width + (minX + x)) << 2;
      const dstIdx = (y * cropW + x) << 2;
      cropped.data[dstIdx]     = source.data[srcIdx];
      cropped.data[dstIdx + 1] = source.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = source.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = source.data[srcIdx + 3];
    }
  }

  return {
    buffer: PNG.sync.write(cropped),
    width:  cropW,
    height: cropH,
  };
}

function getLogoAsset() {
  if (logoCache) return logoCache;

  const logoPath = resolveLogoPngPath();
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo PNG not found. Checked: ${LOGO_PNG_CANDIDATES.join(', ')}`);
  }

  try {
    logoCache = processLogoPng(logoPath);
  } catch (error) {
    throw new Error(`Failed to process logo PNG: ${error.message}`);
  }

  return logoCache;
}

/**
 * Draw logo with fixed width and auto height (aspect ratio locked).
 * If auto height exceeds the header, scale down proportionally (object-fit: contain).
 */
function drawHeaderLogo(doc, asset) {
  const aspect = asset.width / asset.height;
  let drawW = LOGO_TARGET_WIDTH;
  let drawH = drawW / aspect;

  if (drawH > LOGO_MAX_HEIGHT) {
    drawH = LOGO_MAX_HEIGHT;
    drawW = drawH * aspect;
  }

  const x = PW - MARGIN - drawW;
  const y = (HEADER_H - drawH) / 2;

  // Width only — PDFKit derives height from the image's intrinsic aspect ratio.
  doc.image(asset.buffer, x, y, { width: drawW });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setFill(doc, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.fillColor([r, g, b]);
  return doc;
}

function setStroke(doc, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.strokeColor([r, g, b]);
  return doc;
}

function fillRect(doc, x, y, w, h, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.save().rect(x, y, w, h).fill([r, g, b]).restore();
}

function strokeRect(doc, x, y, w, h, hex = C.border, lineWidth = 0.75) {
  setStroke(doc, hex);
  doc.save().rect(x, y, w, h).lineWidth(lineWidth).stroke().restore();
}

function registerFonts(doc) {
  doc.registerFont(F.regular, FONT_REGULAR);
  doc.registerFont(F.semibold, FONT_SEMIBOLD);
}

function maxLabelWidth(doc, labels, size = 10, bold = true) {
  doc.font(bold ? F.semibold : F.regular).fontSize(size);
  return Math.max(...labels.map((label) => doc.widthOfString(label)));
}

function colonXForLabels(doc, labels, x, size = 10, gap = 4) {
  return x + maxLabelWidth(doc, labels, size) + gap;
}

function drawColonField(doc, label, value, x, y, colonX, { size = 10, valueBold = false, labelBold = true } = {}) {
  setFill(doc, C.text).font(labelBold ? F.semibold : F.regular).fontSize(size)
    .text(label, x, y, { lineBreak: false });
  setFill(doc, C.text).font(labelBold ? F.semibold : F.regular).fontSize(size)
    .text(' :', colonX, y, { lineBreak: false });
  setFill(doc, C.text).font(valueBold ? F.semibold : F.regular).fontSize(size)
    .text(` ${value}`, colonX + 10, y, { lineBreak: false });
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

// ─── Contact icons (vector paths) ─────────────────────────────────────────────

function drawCircleIcon(doc, cx, cy, radius = 8) {
  setStroke(doc, C.brandBlue);
  doc.save().circle(cx, cy, radius).lineWidth(0.75).stroke().restore();
}

function drawEnvelopeIcon(doc, cx, cy, size = 9) {
  const [r, g, b] = hexToRgb(C.brandBlue);
  const w = size * 1.15;
  const h = size * 0.72;
  const x = cx - w / 2;
  const y = cy - h / 2;
  doc.save().lineWidth(0.75).strokeColor([r, g, b])
    .rect(x, y, w, h).stroke()
    .moveTo(x, y).lineTo(cx, y + h * 0.55).lineTo(x + w, y).stroke()
    .restore();
}

function drawPhoneIcon(doc, cx, cy, size = 9) {
  const [r, g, b] = hexToRgb(C.brandBlue);
  const w = size * 0.52;
  const h = size * 1.05;
  const x = cx - w / 2;
  const y = cy - h / 2;
  doc.save().lineWidth(0.75).strokeColor([r, g, b])
    .roundedRect(x, y, w, h, 1.8).stroke()
    .circle(cx, cy + h * 0.3, 0.9).fill([r, g, b])
    .restore();
}

function drawInstagramIcon(doc, cx, cy, size = 9) {
  const [r, g, b] = hexToRgb(C.brandBlue);
  const w = size;
  const h = size;
  const x = cx - w / 2;
  const y = cy - h / 2;
  doc.save().lineWidth(0.75).strokeColor([r, g, b])
    .roundedRect(x, y, w, h, 2.2).stroke()
    .circle(cx, cy, w * 0.28).stroke()
    .circle(cx + w * 0.22, cy - h * 0.22, 0.75).fill([r, g, b])
    .restore();
}

function drawContactRow(doc, type, label, x, y) {
  const iconCx = x + 8;
  const iconCy = y + 6;
  drawCircleIcon(doc, iconCx, iconCy);
  if (type === 'email') drawEnvelopeIcon(doc, iconCx, iconCy);
  else if (type === 'phone') drawPhoneIcon(doc, iconCx, iconCy);
  else drawInstagramIcon(doc, iconCx, iconCy);
  setFill(doc, C.text).font(F.regular).fontSize(9)
    .text(label, x + 20, y, { width: CONTENT * 0.4, lineBreak: false });
}

function drawPageHeader(doc) {
  fillRect(doc, 0, 0, PW, HEADER_H, C.brandBlue);
  drawHeaderLogo(doc, getLogoAsset());
}

function drawSectionBar(doc, text, y) {
  const barH = 24;
  fillRect(doc, MARGIN, y, CONTENT, barH, C.brandBlue);
  setFill(doc, C.white).font(F.semibold).fontSize(11)
    .text(text, MARGIN + 10, y + 7, { width: CONTENT - 20, lineBreak: false });
  return y + barH;
}

// ─── Line items & discount placement ──────────────────────────────────────────

function buildInvoiceLineItems(summary) {
  const items = [];

  if (Array.isArray(summary.accommodationLines) && summary.accommodationLines.length) {
    summary.accommodationLines.forEach((line) => {
      items.push({
        description: line.name || line.description || 'Accommodation',
        name:        line.name || 'Accommodation',
        quantity:    line.quantity || 1,
        unitPrice:   line.unitPrice || 0,
        subtotal:    line.subtotal  || 0,
        type:        'accommodation',
      });
    });
  } else if (Array.isArray(summary.properties)) {
    summary.properties.forEach((property) => {
      const lineNights = property.nights || 1;
      const rate = property.rate || 0;
      items.push({
        description: property.name || 'Accommodation',
        name:        property.name || 'Accommodation',
        quantity:    lineNights,
        unitPrice:   rate,
        subtotal:    property.subtotal ?? rate * lineNights,
        type:        'accommodation',
      });
    });
  }

  if (Array.isArray(summary.addonLines) && summary.addonLines.length) {
    summary.addonLines.forEach((line) => {
      items.push({
        description: line.name || line.description || 'Add-on',
        name:        line.name || 'Add-on',
        quantity:    line.quantity || 1,
        unitPrice:   line.unitPrice || 0,
        subtotal:    line.subtotal  || 0,
        type:        'addon',
      });
    });
  } else if (Array.isArray(summary.addons)) {
    summary.addons.forEach((addon) => {
      items.push({
        description: addon.name || 'Add-on',
        name:        addon.name || 'Add-on',
        quantity:    addon.quantity || 1,
        unitPrice:   addon.unitPrice || 0,
        subtotal:    addon.subtotal ?? (addon.unitPrice || 0) * (addon.quantity || 1),
        type:        'addon',
      });
    });
  }

  if (Array.isArray(summary.menuLines) && summary.menuLines.length) {
    summary.menuLines.forEach((line) => {
      items.push({
        description: line.name || line.description || 'Menu Item',
        name:        line.name || 'Menu Item',
        quantity:    line.quantity || 1,
        unitPrice:   line.unitPrice || 0,
        subtotal:    line.subtotal  || 0,
        type:        'menu',
      });
    });
  }

  return items;
}

function getDiscountAnchorIndex(lineItems, summary) {
  if (!lineItems.length) return -1;

  const rule  = summary.applicationRule || summary.discount?.application_rule || 'all_items';
  const scope = summary.discount?.scope || 'global';

  const indicesByType = (type) =>
    lineItems.map((item, i) => (item.type === type ? i : -1)).filter((i) => i >= 0);

  const accommodationIndices = indicesByType('accommodation');
  const addonIndices         = indicesByType('addon');
  const menuIndices          = indicesByType('menu');

  const pickExtremeAccommodation = (compare) => {
    let chosen = accommodationIndices[0];
    lineItems.forEach((item, i) => {
      if (item.type !== 'accommodation') return;
      const current = lineItems[chosen];
      if (compare(item.subtotal || 0, current.subtotal || 0)) chosen = i;
    });
    return chosen;
  };

  if (rule === 'highest_priced_single' && accommodationIndices.length) {
    return pickExtremeAccommodation((a, b) => a > b);
  }
  if (rule === 'lowest_priced_single' && accommodationIndices.length) {
    return pickExtremeAccommodation((a, b) => a < b);
  }
  if (scope === 'properties' && accommodationIndices.length) {
    return accommodationIndices[accommodationIndices.length - 1];
  }
  if (scope === 'addons' && addonIndices.length) {
    return addonIndices[addonIndices.length - 1];
  }
  if (scope === 'menu' && menuIndices.length) {
    return menuIndices[menuIndices.length - 1];
  }
  if (accommodationIndices.length) return accommodationIndices[accommodationIndices.length - 1];
  if (addonIndices.length) return addonIndices[addonIndices.length - 1];
  if (menuIndices.length) return menuIndices[menuIndices.length - 1];
  return lineItems.length - 1;
}

function buildInvoiceTableRows(lineItems, summary) {
  const discountAmount = summary.discountAmount || 0;
  const rows = lineItems.map((item) => ({ kind: 'item', item }));

  if (discountAmount <= 0) return rows;

  const anchorIndex = getDiscountAnchorIndex(lineItems, summary);
  const discountLine = summary.discountLines?.[0];
  const discountCode = summary.discountCode;
  const label = discountLine?.description
    || discountLine?.name
    || `Discount${discountCode ? ` (${discountCode})` : ''}`;

  const discountRow = {
    kind:   'discount',
    label,
    amount: discountAmount,
  };

  if (anchorIndex < 0) {
    rows.push(discountRow);
    return rows;
  }

  rows.splice(anchorIndex + 1, 0, discountRow);
  return rows;
}

// ─── Invoice table ────────────────────────────────────────────────────────────

function invoiceTable(doc, tableRows, total, startY) {
  const colWidths = [CONTENT * 0.44, CONTENT * 0.14, CONTENT * 0.21, CONTENT * 0.21];
  const colX = [
    MARGIN,
    MARGIN + colWidths[0],
    MARGIN + colWidths[0] + colWidths[1],
    MARGIN + colWidths[0] + colWidths[1] + colWidths[2],
  ];
  const moneyPad = 10;
  const rowH  = 28;
  const headH = 28;
  let y = startY;

  fillRect(doc, MARGIN, y, CONTENT, headH, C.brandBlue);
  const headers = ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL PRICE'];
  const headAligns = ['left', 'center', 'right', 'right'];
  headers.forEach((h, i) => {
    setFill(doc, C.white).font(F.semibold).fontSize(9)
      .text(h, colX[i] + 8, y + 9, { width: colWidths[i] - 16, align: headAligns[i], lineBreak: false });
  });
  strokeRect(doc, MARGIN, y, CONTENT, headH);
  for (let i = 1; i < 4; i++) {
    doc.save().moveTo(colX[i], y).lineTo(colX[i], y + headH).lineWidth(0.75).stroke().restore();
  }
  y += headH;

  const drawRow = (cells, aligns, { bold = false } = {}) => {
    fillRect(doc, MARGIN, y, CONTENT, rowH, C.white);
    cells.forEach((cell, i) => {
      setFill(doc, C.text).font(bold ? F.semibold : F.regular).fontSize(10)
        .text(cell, colX[i] + (i >= 2 ? moneyPad : 8), y + 9, {
          width: colWidths[i] - (i >= 2 ? moneyPad * 2 : 16),
          align: aligns[i],
          lineBreak: false,
        });
    });
    strokeRect(doc, MARGIN, y, CONTENT, rowH);
    for (let i = 1; i < 4; i++) {
      doc.save().moveTo(colX[i], y).lineTo(colX[i], y + rowH).lineWidth(0.75).stroke().restore();
    }
    y += rowH;
  };

  tableRows.forEach((row) => {
    if (row.kind === 'item') {
      const item = row.item;
      drawRow(
        [item.description, formatLineQty(item), formatIdr(item.unitPrice), formatIdr(item.subtotal)],
        ['left', 'center', 'right', 'right']
      );
      return;
    }

    const mergedW = colWidths[0] + colWidths[1] + colWidths[2];
    fillRect(doc, MARGIN, y, CONTENT, rowH, C.white);
    setFill(doc, C.text).font(F.regular).fontSize(10)
      .text(row.label, MARGIN + 8, y + 9, { width: mergedW - 16, align: 'left', lineBreak: false });
    setFill(doc, C.text).font(F.regular).fontSize(10)
      .text(`- ${formatIdr(row.amount)}`, colX[3] + moneyPad, y + 9, {
        width: colWidths[3] - moneyPad * 2,
        align: 'right',
        lineBreak: false,
      });
    strokeRect(doc, MARGIN, y, CONTENT, rowH);
    doc.save().moveTo(colX[3], y).lineTo(colX[3], y + rowH).lineWidth(0.75).stroke().restore();
    y += rowH;
  });

  const mergedW = colWidths[0] + colWidths[1] + colWidths[2];
  fillRect(doc, MARGIN, y, CONTENT, rowH, C.white);
  setFill(doc, C.text).font(F.semibold).fontSize(10)
    .text('SUB TOTAL (IDR)', MARGIN + 8, y + 9, { width: mergedW - 16, align: 'right', lineBreak: false });
  setFill(doc, C.text).font(F.semibold).fontSize(10)
    .text(formatIdr(total), colX[3] + moneyPad, y + 9, {
      width: colWidths[3] - moneyPad * 2,
      align: 'right',
      lineBreak: false,
    });
  strokeRect(doc, MARGIN, y, CONTENT, rowH);
  doc.save().moveTo(colX[3], y).lineTo(colX[3], y + rowH).lineWidth(0.75).stroke().restore();
  y += rowH;

  return y + 8;
}

// ─── Confirmation detail table ────────────────────────────────────────────────

function confirmationDetailTable(doc, rows, startY) {
  const col1W = CONTENT * 0.38;
  const col2W = CONTENT - col1W;
  const rowH  = 28;
  let y = startY;

  rows.forEach((row) => {
    fillRect(doc, MARGIN, y, CONTENT, rowH, C.white);

    setFill(doc, C.text).font(F.semibold).fontSize(10)
      .text(row[0], MARGIN + 6, y + 9, { width: col1W - 12, align: 'center', lineBreak: false });
    setFill(doc, C.text).font(F.regular).fontSize(10)
      .text(row[1], MARGIN + col1W + 10, y + 9, { width: col2W - 20, align: 'left', lineBreak: false });

    strokeRect(doc, MARGIN, y, CONTENT, rowH);
    doc.save()
      .moveTo(MARGIN + col1W, y).lineTo(MARGIN + col1W, y + rowH)
      .lineWidth(0.75).stroke().restore();

    y += rowH;
  });

  return y + 4;
}

// ─── Invoice page ─────────────────────────────────────────────────────────────

function drawInvoicePage(doc, summary) {
  const booking     = summary.booking || summary;
  const guestName   = summary.guestName  || booking.guests?.full_name  || 'Guest';
  const phone       = summary.phone      || booking.guests?.phone_number || '—';
  const displayId   = summary.displayId  || booking.display_id || `INV${String(booking.id || '000000').slice(0, 5).toUpperCase()}`;
  const invoiceDate = formatInvoiceDate(booking.created_at || new Date().toISOString());

  const lineItems = buildInvoiceLineItems(summary);
  const subtotal  = summary.subtotalBeforeDiscount
    ?? lineItems.reduce((s, i) => s + (i.subtotal || 0), 0);
  const discountAmount = summary.discountAmount || 0;
  const total = summary.total ?? Math.max(subtotal - discountAmount, 0);
  const tableRows = buildInvoiceTableRows(lineItems, summary);

  drawPageHeader(doc);

  let y = HEADER_H + 28;

  const metaColonX = colonXForLabels(doc, ['Invoice No', 'Date'], MARGIN);
  drawColonField(doc, 'Invoice No', displayId, MARGIN, y, metaColonX);
  y += 16;
  drawColonField(doc, 'Date', invoiceDate, MARGIN, y, metaColonX);
  y += 28;

  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT * 0.52;
  const colW  = CONTENT * 0.48;
  const blockTop = y;

  setFill(doc, C.text).font(F.semibold).fontSize(11)
    .text(PROPERTY.name, col1X, blockTop, { width: colW });
  let leftY = doc.y + 4;
  setFill(doc, C.text).font(F.regular).fontSize(10)
    .text(PROPERTY.address, col1X, leftY, { width: colW });
  leftY = doc.y + 4;
  const contactColonX = colonXForLabels(doc, ['Contact'], col1X, 10);
  drawColonField(doc, 'Contact', PROPERTY.phone, col1X, leftY, contactColonX, { size: 10 });

  setFill(doc, C.text).font(F.semibold).fontSize(11)
    .text('Bill To', col2X, blockTop, { width: colW });
  const billColonX = colonXForLabels(doc, ['Customer', 'Contact'], col2X, 10);
  let rightY = doc.y + 6;
  drawColonField(doc, 'Customer', guestName, col2X, rightY, billColonX, { size: 10 });
  rightY += 14;
  drawColonField(doc, 'Contact', phone, col2X, rightY, billColonX, { size: 10 });

  y = Math.max(leftY, rightY) + 26;

  y = invoiceTable(doc, tableRows, total, y);
  y += 12;

  setFill(doc, C.text).font(F.semibold).fontSize(11)
    .text('Payment Instruction (IDR)', MARGIN, y);
  y = doc.y + 10;

  const paymentLabels = ['Bank Details', 'Bank Account', 'Name'];
  const paymentColonX = colonXForLabels(doc, paymentLabels, MARGIN);
  const paymentRows = [
    ['Bank Details', PROPERTY.bankName],
    ['Bank Account', PROPERTY.bankAccount],
    ['Name', PROPERTY.bankAccountName],
  ];
  paymentRows.forEach(([label, value]) => {
    drawColonField(doc, label, value, MARGIN, y, paymentColonX);
    y += 14;
  });
  y += 6;

  setFill(doc, C.text).font(F.regular).fontSize(10)
    .text(
      'Please send your payment details to complete your booking through our contact person.',
      MARGIN, y, { width: CONTENT }
    );

  setFill(doc, C.text).font(F.semibold).fontSize(12)
    .text('Thank you for staying with us!', MARGIN, PH - MARGIN - 20, { width: CONTENT });
}

// ─── Confirmation letter page ─────────────────────────────────────────────────

function drawConfirmationPage(doc, summary) {
  const booking    = summary.booking || summary;
  const guestName  = summary.guestName  || booking.guests?.full_name  || 'Guest';
  const guestCount = summary.totalGuests || booking.total_guests       || 1;
  const propertyName  = summary.propertyNames  || summary.property_names        || '—';

  const checkIn  = summary.checkIn  || summary.checkInDate  || booking.check_in_date;
  const checkOut = summary.checkOut || summary.checkOutDate || booking.check_out_date;
  const nights   = summary.nights   || Math.max(
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)), 1
  );

  drawPageHeader(doc);

  let y = HEADER_H + 28;

  setFill(doc, C.text).font(F.semibold).fontSize(14)
    .text('Your reservation is confirmed!', MARGIN, y, { width: CONTENT });
  y = doc.y + 16;

  setFill(doc, C.text).font(F.regular).fontSize(10);
  doc.text(`Dear ${guestFirstName(guestName)},`, MARGIN, y, { lineGap: 2 });
  doc.moveDown(0.6);
  doc.text(
    `Thank you for choosing to stay at Villa Umalila. We're pleased to confirm your reservation for ${stayDurationLabel(nights)}.`,
    MARGIN, doc.y, { width: CONTENT, lineGap: 2 }
  );
  y = doc.y + 18;

  y = drawSectionBar(doc, 'Reservation Details', y);
  y = confirmationDetailTable(doc, [
    ['Guest Name',     guestName],
    ['Property Type',     propertyName],
    ['No. of Guests',  `${guestCount} Guest${guestCount !== 1 ? 's' : ''}`],
    ['Check-in Date',  formatStayDate(checkIn,  'After 2 PM')],
    ['Check-out Date', formatStayDate(checkOut, 'Before 11 AM')],
  ], y);
  y += 14;

  setFill(doc, C.text).font(F.regular).fontSize(10)
    .text('We look forward to welcoming you to Villa Umalila.', MARGIN, y, { width: CONTENT });
  y = doc.y + 20;

  const noticePad   = 12;
  const noticeItems = [
    'Please present your KTP and booking details during check-in.',
    'Villa Umalila does not accomodate unmarried couples.',
  ];
  const noticeTitleH = 18;
  const noticeItemH  = 16;
  const noticeBoxH   = noticePad + noticeTitleH + noticeItems.length * noticeItemH + noticePad;

  strokeRect(doc, MARGIN, y, CONTENT, noticeBoxH, C.brandBlue, 1);

  setFill(doc, C.text).font(F.semibold).fontSize(11)
    .text('Important Notice', MARGIN + noticePad, y + noticePad, { width: CONTENT - noticePad * 2 });

  let noticeY = y + noticePad + noticeTitleH;
  noticeItems.forEach((notice) => {
    setFill(doc, C.text).font(F.regular).fontSize(10)
      .text(`•  ${notice}`, MARGIN + noticePad, noticeY, { width: CONTENT - noticePad * 2 });
    noticeY += noticeItemH;
  });

  const footerY = PH - MARGIN - 72;
  const footerLeftW  = CONTENT * 0.55;
  const footerRightX = MARGIN + CONTENT * 0.58;

  setFill(doc, C.text).font(F.semibold).fontSize(11)
    .text(PROPERTY.name, MARGIN, footerY, { width: footerLeftW });
  setFill(doc, C.text).font(F.regular).fontSize(9)
    .text(PROPERTY.address, MARGIN, doc.y + 4, { width: footerLeftW });

  const contacts = [
    { type: 'email',     label: PROPERTY.email },
    { type: 'phone',     label: PROPERTY.phone },
    { type: 'instagram', label: PROPERTY.instagram },
  ];
  let contactY = footerY + 2;
  contacts.forEach(({ type, label }) => {
    drawContactRow(doc, type, label, footerRightX, contactY);
    contactY += 18;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a booking confirmation PDF and return it as a Buffer.
 * Page 1 — confirmation letter, Page 2 — invoice.
 * @param {object} summary — output of buildFinancialSummary()
 * @returns {Promise<Buffer>}
 */
export async function generateBookingConfirmationPdf(summary) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    'A4',
      margins: { top: 0, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title:   'Booking Confirmation — Villa Umalila',
        Author:  'Villa Umalila PMS',
      },
    });

    registerFonts(doc);

    const chunks = [];
    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    drawConfirmationPage(doc, summary);

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
