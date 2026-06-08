// backend/lib/pdfHelpers.js

import { generateBookingConfirmationPdf } from '../services/bookingConfirmationPdf.js';

/**
 * Build financial summary from booking data
 * Format data to match bookingConfirmationPdf.js template expectations
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
        created_at,
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

    // Build villas array
    const villas = booking.booking_villas?.map(bv => ({
      name: bv.villas?.name || 'Villa Unit',
      rate: bv.villas?.base_rate_per_night || 0,
      nights: nights,
      subtotal: (bv.villas?.base_rate_per_night || 0) * nights,
    })) || [];

    // Build addons array
    const addons = booking.booking_addons?.map(ba => ({
      name: ba.addons?.name || 'Add-on',
      unitPrice: ba.addons?.price_per_night || 0,
      quantity: ba.quantity || 1,
      subtotal: (ba.addons?.price_per_night || 0) * (ba.quantity || 1),
    })) || [];

    // Calculate totals
    const villaSubtotal = villas.reduce((sum, v) => sum + (v.subtotal || 0), 0);
    const addonSubtotal = addons.reduce((sum, a) => sum + (a.subtotal || 0), 0);
    const subtotal = villaSubtotal + addonSubtotal;

    // Calculate discount if applicable
    let discountAmount = 0;
    if (booking.discounts) {
      const discount = booking.discounts;
      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.value) / 100;
      } else if (discount.type === 'fixed') {
        discountAmount = discount.value;
      }
    }

    const totalAfterDiscount = Math.max(subtotal - discountAmount, 0);
    const amountPaid = booking.amount_paid || 0;
    const balanceDue = Math.max(totalAfterDiscount - amountPaid, 0);

    // Return summary object formatted for PDF template
    return {
      // Invoice metadata
      id: booking.id,
      displayId: `INV${booking.id.slice(0, 6).toUpperCase()}`,
      created_at: booking.created_at,
      
      // Guest information
      guestName: booking.guests?.full_name || 'Valued Guest',
      guestEmail: booking.guests?.email || '',
      phone: booking.guests?.phone_number || '',
      
      // Stay details
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      totalGuests: booking.total_guests,
      nights: nights,
      
      // Villa and addon details (for line items)
      villas: villas,
      addons: addons,
      villa_names: villas.map(v => v.name).join(', ') || 'Villa Unit',
      
      // Financial details
      subtotal: subtotal,
      villaSubtotal: villaSubtotal,
      addonSubtotal: addonSubtotal,
      discountCode: booking.discounts?.code || null,
      discountAmount: discountAmount,
      total: totalAfterDiscount,
      totalPrice: totalAfterDiscount,
      
      // Payment status
      amountPaid: amountPaid,
      balanceDue: balanceDue,
      paymentStatus: booking.payment_status || 'pending',
      
      // Additional info
      notes: booking.notes || '',
      
      // Booking object (for template backwards compatibility)
      booking: {
        id: booking.id,
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
    // Call the PDF generation function
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