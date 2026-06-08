// backend/lib/pdfHelpers.js

import { generateBookingConfirmationPdf } from '../services/bookingConfirmationPdf.js';

// Note: supabase will be passed as parameter or imported from server
let supabaseInstance;

export function setSupabaseInstance(supabaseClient) {
  supabaseInstance = supabaseClient;
}

/**
 * Build financial summary from booking data
 */
export async function buildFinancialSummary(bookingId, supabase) {
  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        check_in_date,
        check_out_date,
        total_guests,
        total_price,
        notes,
        payment_status,
        amount_paid,
        guests (full_name, email, phone_number),
        booking_villas (
          villas (id, name, base_rate_per_night, base_breakfast)
        ),
        booking_addons (
          quantity,
          addons (id, name, price_per_night, base_breakfast)
        ),
        discounts (id, code, name, type, value, scope)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Calculate nights
    const checkIn = new Date(booking.check_in_date);
    const checkOut = new Date(booking.check_out_date);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Calculate villa charges
    let villaSubtotal = 0;
    const villas = booking.booking_villas?.map(bv => {
      const rate = bv.villas?.base_rate_per_night || 0;
      const lineTotal = rate * nights;
      villaSubtotal += lineTotal;
      
      return {
        name: bv.villas?.name || 'Villa Unit',
        rate: rate,
        nights: nights,
        subtotal: lineTotal,
      };
    }) || [];

    // Calculate addon charges
    let addonSubtotal = 0;
    const addons = booking.booking_addons?.map(ba => {
      const price = ba.addons?.price_per_night || 0;
      const qty = ba.quantity || 1;
      const lineTotal = price * qty;
      addonSubtotal += lineTotal;
      
      return {
        name: ba.addons?.name || 'Add-on Service',
        unitPrice: price,
        quantity: qty,
        subtotal: lineTotal,
      };
    }) || [];

    // Calculate discount if applicable
    let discountAmount = 0;
    if (booking.discounts) {
      const discount = booking.discounts;
      const subtotal = villaSubtotal + addonSubtotal;
      
      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.value) / 100;
      } else if (discount.type === 'fixed') {
        discountAmount = discount.value;
      }
    }

    const subtotal = villaSubtotal + addonSubtotal;
    const totalAfterDiscount = Math.max(subtotal - discountAmount, 0);
    const amountPaid = booking.amount_paid || 0;
    const balanceDue = Math.max(totalAfterDiscount - amountPaid, 0);

    return {
      id: booking.id,
      displayId: `INV${booking.id.slice(0, 6).toUpperCase()}`,
      guestName: booking.guests?.full_name || 'Valued Guest',
      guestEmail: booking.guests?.email || '',
      guestPhone: booking.guests?.phone_number || '',
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      totalGuests: booking.total_guests,
      nights: nights,
      villas: villas,
      addons: addons,
      subtotal: subtotal,
      discountAmount: discountAmount,
      totalPrice: totalAfterDiscount,
      amountPaid: amountPaid,
      balanceDue: balanceDue,
      paymentStatus: booking.payment_status || 'pending',
      notes: booking.notes || '',
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
    // Call your existing bookingConfirmationPdf function
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