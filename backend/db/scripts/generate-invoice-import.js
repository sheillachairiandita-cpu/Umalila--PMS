/**
 * Generate SQL from Invoice sheet in the Umalila finance workbook.
 *
 * Usage:
 *   node backend/db/scripts/generate-invoice-import.js "path/to/workbook.xlsx"
 *
 * Output: backend/db/seeds/invoice-bookings-import.sql
 */

import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = 'C:/Users/ella/Downloads/Copy of [Finance] Umalila Alahan Panjang 2026.xlsx';
const TENANT_SLUG = 'umalila-dev';
const TODAY = '2026-06-27';
const PROPERTY_NAMES = ['Dahlia', 'Daffodil', 'Hydrangea'];

function uuidFromKey(key) {
  const hash = createHash('sha256').update(`umalila-invoice:${key}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function sqlStr(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function excelDate(serial) {
  if (!serial) return null;
  return new Date((serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
}

function num(value) {
  if (value === null || value === undefined || value === '#N/A') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nights(checkInSerial, checkOutSerial) {
  return Math.max(Math.round(checkOutSerial - checkInSerial), 1);
}

function bookingStatus(checkIn, checkOut, paymentStatus) {
  if (checkOut < TODAY) {
    return paymentStatus === 'complete' ? 'completed' : 'checked_out';
  }
  if (checkIn <= TODAY && checkOut >= TODAY) return 'checked_in';
  return 'confirmed';
}

function paymentStatus(dp, pelunasan, total) {
  const paid = dp + pelunasan;
  if (total > 0 && paid >= total) return 'complete';
  if (paid > 0) return 'partial';
  return 'pending';
}

function parseUnits(row) {
  return [row[7], row[8], row[9]]
    .filter((unit) => unit && unit !== '-' && unit !== 'Extra Bed' && PROPERTY_NAMES.includes(unit));
}

function buildNotes(platform, ket) {
  const parts = [];
  if (platform) parts.push(`Source: ${platform}`);
  if (ket !== null && ket !== undefined && ket !== '') parts.push(`KET: ${ket}`);
  return parts.length ? parts.join(' | ') : null;
}

function main() {
  const xlsxPath = resolve(process.argv[2] || DEFAULT_XLSX);
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets.Invoice;
  if (!ws) throw new Error('Invoice sheet not found');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const dataRows = rows
    .slice(2)
    .filter((row) => row[0] && String(row[0]).startsWith('INV') && row[1] && row[3] && row[4] && row[5]);

  const guests = [];
  const bookings = [];
  const bookingProperties = [];
  const bookingAddons = [];
  const finances = [];

  for (const row of dataRows) {
    const invoiceId = String(row[0]).trim();
    const guestId = uuidFromKey(`guest:${invoiceId}`);
    const bookingId = uuidFromKey(`booking:${invoiceId}`);
    const firstName = String(row[1] || '').trim();
    const lastName = String(row[2] || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const checkIn = excelDate(row[3]);
    const checkOut = excelDate(row[4]);
    const stayNights = nights(row[3], row[4]);
    const totalGuests = Math.max(Math.round(num(row[5])), 1);
    const platform = row[6] ? String(row[6]).trim() : null;
    const units = parseUnits(row);
    const villaPrice = num(row[12]);
    const extraBedQty = Math.round(num(row[10]));
    const breakfastQty = Math.round(num(row[11]));
    const extraBedPrice = num(row[13]);
    const breakfastPrice = num(row[14]);
    const discountAmount = num(row[17]);
    const totalPrice = num(row[18]);
    const dp = num(row[19]);
    const pelunasan = num(row[20]);
    const payStatus = paymentStatus(dp, pelunasan, totalPrice);
    const status = bookingStatus(checkIn, checkOut, payStatus);
    const amountPaid = dp + pelunasan;
    const notes = buildNotes(platform, row[23]);

    guests.push({
      id: guestId,
      full_name: fullName,
      phone_number: '-',
      display_id: invoiceId,
    });

    bookings.push({
      id: bookingId,
      guest_id: guestId,
      display_id: invoiceId,
      check_in_date: checkIn,
      check_out_date: checkOut,
      total_guests: totalGuests,
      total_price: totalPrice,
      discount_amount: discountAmount,
      amount_paid: amountPaid,
      payment_status: payStatus,
      status,
      notes,
    });

    if (units.length > 0 && villaPrice > 0) {
      const perPropertyTotal = villaPrice / units.length;
      const ratePerNight = perPropertyTotal / stayNights;
      for (const unit of units) {
        bookingProperties.push({
          id: uuidFromKey(`bp:${invoiceId}:${unit}`),
          booking_id: bookingId,
          property_name: unit,
          rate_per_night: Math.round(ratePerNight * 100) / 100,
          nights: stayNights,
        });
      }
    }

    if (extraBedQty > 0 && extraBedPrice > 0) {
      const unitPrice = extraBedPrice / (extraBedQty * stayNights);
      bookingAddons.push({
        id: uuidFromKey(`ba:extra:${invoiceId}`),
        booking_id: bookingId,
        addon_name: 'Extra Bed',
        quantity: extraBedQty,
        unit_price: Math.round(unitPrice * 100) / 100,
        subtotal: extraBedPrice,
      });
    }

    if (breakfastQty > 0 && breakfastPrice > 0) {
      const unitPrice = breakfastPrice / (breakfastQty * stayNights);
      bookingAddons.push({
        id: uuidFromKey(`ba:breakfast:${invoiceId}`),
        booking_id: bookingId,
        addon_name: 'Breakfast',
        quantity: breakfastQty,
        unit_price: Math.round(unitPrice * 100) / 100,
        subtotal: breakfastPrice,
      });
    }

    if (dp > 0) {
      finances.push({
        id: uuidFromKey(`fin:dp:${invoiceId}`),
        booking_id: bookingId,
        type: 'income',
        category: 'partial_payment',
        amount: dp,
        transaction_date: checkIn,
        description: `DP imported from ${invoiceId}`,
      });
    }

    if (pelunasan > 0) {
      finances.push({
        id: uuidFromKey(`fin:pel:${invoiceId}`),
        booking_id: bookingId,
        type: 'income',
        category: 'final_payment',
        amount: pelunasan,
        transaction_date: checkOut,
        description: `Pelunasan imported from ${invoiceId}`,
      });
    }
  }

  const lines = [];
  lines.push('-- Imported from Invoice sheet: Copy of [Finance] Umalila Alahan Panjang 2026.xlsx');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Valid bookings: ${bookings.length}`);
  lines.push(`-- Tenant slug: ${TENANT_SLUG}`);
  lines.push('-- Run in Supabase SQL Editor. Review before executing on production.');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('  tid uuid;');
  lines.push('BEGIN');
  lines.push(`  SELECT id INTO tid FROM public.tenants WHERE slug = ${sqlStr(TENANT_SLUG)} LIMIT 1;`);
  lines.push('  IF tid IS NULL THEN');
  lines.push(`    RAISE EXCEPTION 'Tenant % not found', ${sqlStr(TENANT_SLUG)};`);
  lines.push('  END IF;');
  lines.push('');
  lines.push('  -- Remove existing booking-related data for this tenant');
  lines.push('  DELETE FROM public.order_items');
  lines.push('  WHERE order_id IN (');
  lines.push('    SELECT o.id FROM public.orders o');
  lines.push('    JOIN public.bookings b ON b.id = o.booking_id');
  lines.push('    WHERE b.tenant_id = tid');
  lines.push('  );');
  lines.push('');
  lines.push('  DELETE FROM public.orders');
  lines.push('  WHERE booking_id IN (SELECT id FROM public.bookings WHERE tenant_id = tid);');
  lines.push('');
  lines.push('  DELETE FROM public.finances');
  lines.push('  WHERE booking_id IN (SELECT id FROM public.bookings WHERE tenant_id = tid);');
  lines.push('');
  lines.push('  DELETE FROM public.reservation_profitability');
  lines.push('  WHERE booking_id IN (SELECT id FROM public.bookings WHERE tenant_id = tid);');
  lines.push('');
  lines.push('  DELETE FROM public.booking_addons');
  lines.push('  WHERE booking_id IN (SELECT id FROM public.bookings WHERE tenant_id = tid);');
  lines.push('');
  lines.push('  DELETE FROM public.booking_properties');
  lines.push('  WHERE booking_id IN (SELECT id FROM public.bookings WHERE tenant_id = tid);');
  lines.push('');
  lines.push('  CREATE TEMP TABLE _invoice_import_guest_ids ON COMMIT DROP AS');
  lines.push('  SELECT DISTINCT guest_id FROM public.bookings WHERE tenant_id = tid AND guest_id IS NOT NULL;');
  lines.push('');
  lines.push('  DELETE FROM public.bookings WHERE tenant_id = tid;');
  lines.push('');
  lines.push('  DELETE FROM public.guests');
  lines.push('  WHERE tenant_id = tid AND id IN (SELECT guest_id FROM _invoice_import_guest_ids);');
  lines.push('END $$;');
  lines.push('');

  lines.push('-- Guests');
  for (const guest of guests) {
    lines.push(
      `INSERT INTO public.guests (id, full_name, phone_number, display_id, tenant_id) VALUES (${sqlStr(guest.id)}, ${sqlStr(guest.full_name)}, ${sqlStr(guest.phone_number)}, ${sqlStr(guest.display_id)}, (SELECT id FROM public.tenants WHERE slug = ${sqlStr(TENANT_SLUG)}));`,
    );
  }
  lines.push('');

  lines.push('-- Bookings (display_id = No. Invoice)');
  for (const booking of bookings) {
    lines.push(
      `INSERT INTO public.bookings (id, guest_id, display_id, check_in_date, check_out_date, total_guests, total_price, discount_amount, amount_paid, payment_status, status, notes, tenant_id) VALUES (${sqlStr(booking.id)}, ${sqlStr(booking.guest_id)}, ${sqlStr(booking.display_id)}, ${sqlStr(booking.check_in_date)}, ${sqlStr(booking.check_out_date)}, ${booking.total_guests}, ${booking.total_price}, ${booking.discount_amount}, ${booking.amount_paid}, ${sqlStr(booking.payment_status)}, ${sqlStr(booking.status)}, ${sqlStr(booking.notes)}, (SELECT id FROM public.tenants WHERE slug = ${sqlStr(TENANT_SLUG)}));`,
    );
  }
  lines.push('');

  lines.push('-- Booking properties');
  for (const bp of bookingProperties) {
    lines.push(
      `INSERT INTO public.booking_properties (id, booking_id, property_id, rate_per_night, nights) VALUES (${sqlStr(bp.id)}, ${sqlStr(bp.booking_id)}, (SELECT id FROM public.properties WHERE name = ${sqlStr(bp.property_name)} AND tenant_id = (SELECT id FROM public.tenants WHERE slug = ${sqlStr(TENANT_SLUG)}) LIMIT 1), ${bp.rate_per_night}, ${bp.nights});`,
    );
  }
  lines.push('');

  lines.push('-- Booking addons');
  for (const ba of bookingAddons) {
    lines.push(
      `INSERT INTO public.booking_addons (id, booking_id, addon_id, quantity, unit_price, subtotal) VALUES (${sqlStr(ba.id)}, ${sqlStr(ba.booking_id)}, (SELECT id FROM public.addons WHERE name = ${sqlStr(ba.addon_name)} AND tenant_id = (SELECT id FROM public.tenants WHERE slug = ${sqlStr(TENANT_SLUG)}) LIMIT 1), ${ba.quantity}, ${ba.unit_price}, ${ba.subtotal});`,
    );
  }
  lines.push('');

  lines.push('-- Payment finances (DP + Pelunasan)');
  for (const fin of finances) {
    lines.push(
      `INSERT INTO public.finances (id, booking_id, type, category, amount, transaction_date, description, status, tenant_id) VALUES (${sqlStr(fin.id)}, ${sqlStr(fin.booking_id)}, ${sqlStr(fin.type)}, ${sqlStr(fin.category)}, ${fin.amount}, ${sqlStr(fin.transaction_date)}, ${sqlStr(fin.description)}, 'approved', (SELECT id FROM public.tenants WHERE slug = ${sqlStr(TENANT_SLUG)}));`,
    );
  }

  lines.push('');
  lines.push('COMMIT;');

  const outPath = join(__dirname, '..', 'seeds', 'invoice-bookings-import.sql');
  writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`Guests: ${guests.length}`);
  console.log(`Bookings: ${bookings.length}`);
  console.log(`Booking properties: ${bookingProperties.length}`);
  console.log(`Booking addons: ${bookingAddons.length}`);
  console.log(`Finance rows: ${finances.length}`);
}

main();
