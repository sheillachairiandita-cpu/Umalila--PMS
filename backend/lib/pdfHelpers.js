// backend/lib/pdfHelpers.js

import { generateBookingConfirmationPdf } from '../services/bookingConfirmationPdf.js';

function addonUnitPrice(addon) {
  return Number(addon?.price) || 0;
}

function stayNights(checkIn, checkOut) {
  return Math.max(
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
    1
  );
}

function buildInvoiceId(booking) {
  if (booking?.display_id) return booking.display_id;
  return `UM-${String(booking?.id || '').slice(0, 8).toUpperCase()}`;
}

/**
 * Build financial summary from booking data for PDF generation.
 */
export async function buildFinancialSummary(bookingId, supabase) {
  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        display_id,
        check_in_date,
        check_out_date,
        total_guests,
        total_price,
        notes,
        payment_status,
        amount_paid,
        discount_amount,
        created_at,
        guests (full_name, email, phone_number),
        booking_villas (
          rate_per_night,
          nights,
          villas (id, name, base_rate_per_night, base_breakfast)
        ),
        booking_addons (
          quantity,
          unit_price,
          subtotal,
          addons (id, name, price, is_per_night, base_breakfast)
        ),
        discounts (id, code, name, type, value, scope, application_rule)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    const nights = stayNights(booking.check_in_date, booking.check_out_date);

    const accommodationLines = (booking.booking_villas || []).map((bv) => {
      const rate = Number(bv.rate_per_night) || Number(bv.villas?.base_rate_per_night) || 0;
      const lineNights = Number(bv.nights) || nights;
      return {
        type: 'accommodation',
        name: bv.villas?.name || 'Villa Unit',
        description: `${bv.villas?.name || 'Villa Unit'} — ${lineNights} night${lineNights !== 1 ? 's' : ''}`,
        quantity: lineNights,
        unitPrice: rate,
        subtotal: rate * lineNights,
      };
    });

    const addonLines = (booking.booking_addons || []).map((ba) => {
      const unitPrice = Number(ba.unit_price) || addonUnitPrice(ba.addons);
      const quantity = ba.quantity || 1;
      const multiplier = ba.addons?.is_per_night !== false ? nights : 1;
      const billableQty = quantity * multiplier;
      const subtotal = Number(ba.subtotal) || unitPrice * billableQty;
      return {
        type: 'addon',
        name: ba.addons?.name || 'Add-on',
        description: ba.addons?.name || 'Add-on',
        quantity: billableQty,
        unitPrice,
        subtotal,
      };
    });

    const villas = accommodationLines.map((line) => ({
      name: line.name,
      rate: line.unitPrice,
      nights: line.quantity,
      subtotal: line.subtotal,
    }));

    const addons = addonLines.map((line) => ({
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      subtotal: line.subtotal,
    }));

    const villaSubtotal = accommodationLines.reduce((sum, line) => sum + line.subtotal, 0);
    const addonSubtotal = addonLines.reduce((sum, line) => sum + line.subtotal, 0);
    const subtotalBeforeDiscount = villaSubtotal + addonSubtotal;

    let discountAmount = Number(booking.discount_amount) || 0;
    if (booking.discounts && discountAmount === 0) {
      const discount = booking.discounts;
      if (discount.type === 'percentage') {
        discountAmount = (subtotalBeforeDiscount * Number(discount.value)) / 100;
      } else if (discount.type === 'fixed') {
        discountAmount = Number(discount.value);
      }
    }

    const total = Math.max(subtotalBeforeDiscount - discountAmount, 0);
    const amountPaid = Number(booking.amount_paid) || 0;
    const balanceDue = Math.max(total - amountPaid, 0);
    const displayId = buildInvoiceId(booking);

    return {
      id: booking.id,
      displayId,
      created_at: booking.created_at,
      guestName: booking.guests?.full_name || 'Valued Guest',
      guestEmail: booking.guests?.email || '',
      phone: booking.guests?.phone_number || '',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      totalGuests: booking.total_guests,
      nights,
      villas,
      addons,
      accommodationLines,
      addonLines,
      villa_names: villas.map((v) => v.name).join(', ') || 'Villa Unit',
      villaNames: villas.map((v) => v.name).join(', ') || 'Villa Unit',
      subtotalBeforeDiscount,
      subtotal: subtotalBeforeDiscount,
      villaSubtotal,
      addonSubtotal,
      discountCode: booking.discounts?.code || null,
      discountAmount,
      total,
      totalPrice: total,
      amountPaid,
      balanceDue,
      paymentStatus: booking.payment_status || 'pending',
      notes: booking.notes || '',
      booking: {
        id: booking.id,
        display_id: booking.display_id,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        total_guests: booking.total_guests,
        total_price: booking.total_price,
        created_at: booking.created_at,
        guests: booking.guests,
      },
    };
  } catch (error) {
    console.error('Error building financial summary:', error);
    throw error;
  }
}

/**
 * Stream PDF to response
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
