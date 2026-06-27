import { calculateDiscountAmount, mapDiscountRow } from './discountUtils.js';
import { buildTieredAccommodationLines } from './propertyRateUtils.js';
import {
  computeBookingTotalFromParts,
  computeBalanceDueFromParts,
} from './financialUtils.js';
import { stayNights } from './stayUtils.js';

export const ORDER_STATUSES = ['open', 'served', 'billed'];

function addonUnitPrice(addon) {
  return Number(addon?.price) || 0;
}

function buildInvoiceId(bookingOrId) {
  if (bookingOrId && typeof bookingOrId === 'object') {
    if (bookingOrId.display_id) return bookingOrId.display_id;
    return `UM-${String(bookingOrId.id).slice(0, 8).toUpperCase()}`;
  }
  return `UM-${String(bookingOrId).slice(0, 8).toUpperCase()}`;
}

async function fetchPricingHolidays(scopeQ, tenantId) {
  const { data, error } = await scopeQ(tenantId, 'pricing_holidays')
    .select('id, name, start_date, end_date')
    .order('start_date');
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

/**
 * Canonical booking financial summary (line items, discounts, orders, totals).
 * Used by invoice API, PDF, payments, and profitability.
 */
export function createBuildFinancialSummary(scopeQ) {
  async function buildFinancialSummary(bookingId, tenantId) {
    const { data: booking, error: bookingError } = await scopeQ(tenantId, 'bookings')
      .select(`
        *,
        discounts (id, code, name, type, value, scope, status, application_rule),
        guests (full_name, phone_number, email),
        booking_properties (
          rate_per_night,
          nights,
          property_id,
          properties (
            id,
            name,
            base_rate_per_night,
            weekend_rate_per_night,
            holiday_rate_per_night,
            base_breakfast
          )
        ),
        booking_addons (
          quantity,
          unit_price,
          subtotal,
          addons (name, price, is_per_night, base_breakfast)
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    const { data: orders, error: orderError } = await scopeQ(tenantId, 'orders')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        order_items (
          quantity,
          unit_price,
          subtotal,
          menu_items (name, category)
        )
      `)
      .eq('booking_id', bookingId)
      .in('status', ORDER_STATUSES);

    if (orderError) throw orderError;

    const nights = stayNights(booking.check_in_date, booking.check_out_date);
    const holidays = await fetchPricingHolidays(scopeQ, tenantId);
    const propertyCatalog = (booking.booking_properties || [])
      .map((bv) => bv.properties)
      .filter(Boolean);

    let accommodationLines = [];
    let calculatedAccommodation = 0;

    if (propertyCatalog.length > 0) {
      const tiered = buildTieredAccommodationLines(
        propertyCatalog,
        booking.check_in_date,
        booking.check_out_date,
        holidays,
      );
      accommodationLines = tiered.lines;
      calculatedAccommodation = tiered.total;
    }

    if (accommodationLines.length === 0) {
      (booking.booking_properties || []).forEach((bv) => {
        const rate = Number(bv.rate_per_night) || Number(bv.properties?.base_rate_per_night) || 0;
        const lineNights = Number(bv.nights) || nights;
        const subtotal = rate > 0 ? rate * lineNights : 0;
        if (rate > 0) {
          calculatedAccommodation += subtotal;
          accommodationLines.push({
            type: 'accommodation',
            name: bv.properties?.name || 'Property',
            description: `${bv.properties?.name || 'Property'} — ${lineNights} night${lineNights !== 1 ? 's' : ''}`,
            quantity: lineNights,
            unitPrice: rate,
            subtotal,
            property_id: bv.property_id,
          });
        }
      });
    }

    const accommodation = calculatedAccommodation > 0
      ? calculatedAccommodation
      : Number(booking.total_price) || 0;

    if (accommodationLines.length === 0) {
      accommodationLines.push({
        type: 'accommodation',
        name: 'Accommodation',
        description: `Stay ${booking.check_in_date} → ${booking.check_out_date}`,
        quantity: nights,
        unitPrice: nights > 0 ? accommodation / nights : accommodation,
        subtotal: accommodation,
      });
    }

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

    let extraBeds = 0;
    let extraBreakfast = 0;
    let otherAddons = 0;
    (booking.booking_addons || []).forEach((ba) => {
      const unitPrice = Number(ba.unit_price) || addonUnitPrice(ba.addons);
      const quantity = ba.quantity || 1;
      const multiplier = ba.addons?.is_per_night !== false ? nights : 1;
      const lineTotal = Number(ba.subtotal) || unitPrice * quantity * multiplier;
      const addonName = (ba.addons?.name || '').toLowerCase();
      if (addonName.includes('extra bed')) extraBeds += lineTotal;
      else if ((ba.addons?.base_breakfast || 0) > 0 || addonName.includes('breakfast')) extraBreakfast += lineTotal;
      else otherAddons += lineTotal;
    });

    const totalAddons = addonLines.reduce((sum, line) => sum + line.subtotal, 0);

    const menuLines = [];
    let menuTotal = 0;
    (orders || []).forEach((order) => {
      if (order.order_items?.length) {
        order.order_items.forEach((item) => {
          const unitPrice = Number(item.unit_price) || 0;
          const quantity = item.quantity || 1;
          const subtotal = Number(item.subtotal) || unitPrice * quantity;
          menuTotal += subtotal;
          menuLines.push({
            type: 'menu',
            name: item.menu_items?.name || 'Menu Item',
            description: item.menu_items?.name || 'Menu Item',
            category: item.menu_items?.category || null,
            quantity,
            unitPrice,
            subtotal,
            orderDate: order.created_at,
          });
        });
      } else if (Number(order.total_amount) > 0) {
        menuTotal += Number(order.total_amount);
        menuLines.push({
          type: 'menu',
          name: 'Order (unspecified items)',
          description: 'Order total',
          quantity: 1,
          unitPrice: Number(order.total_amount),
          subtotal: Number(order.total_amount),
          orderDate: order.created_at,
        });
      }
    });

    const menuItems = menuLines.map(({ name, quantity, subtotal, unitPrice }) => ({
      name, quantity, subtotal, unitPrice,
    }));

    const subtotalBeforeDiscount = accommodation + totalAddons + menuTotal;

    let discountAmount = 0;
    let discountLines = [];
    let discountMeta = null;

    if (booking.discount_id && booking.discounts) {
      const discountResult = calculateDiscountAmount(booking.discounts, {
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        nights,
        bookingAmount: subtotalBeforeDiscount,
        propertyIds: (booking.booking_properties || []).map((bv) => bv.property_id).filter(Boolean),
        propertyLines: accommodationLines,
        addonLines,
        menuLines,
      });
      discountAmount = discountResult.amount > 0
        ? discountResult.amount
        : Number(booking.discount_amount) || 0;
      discountLines = discountResult.lines.length > 0
        ? discountResult.lines
        : (discountAmount > 0 ? [{
            type: 'discount',
            name: booking.discounts.name || booking.discounts.code || 'Discount',
            description: `Discount (${booking.discounts.code})`,
            quantity: 1,
            unitPrice: -discountAmount,
            subtotal: -discountAmount,
          }] : []);
      discountMeta = mapDiscountRow(booking.discounts);
    } else if (Number(booking.discount_amount) > 0) {
      discountAmount = Number(booking.discount_amount);
      discountLines = [{
        type: 'discount',
        name: 'Discount',
        description: 'Applied discount',
        quantity: 1,
        unitPrice: -discountAmount,
        subtotal: -discountAmount,
      }];
    }

    const lineItems = [...accommodationLines, ...addonLines, ...menuLines, ...discountLines];
    const total = computeBookingTotalFromParts(subtotalBeforeDiscount, discountAmount);
    const amountPaid = Number(booking.amount_paid) || 0;
    const balanceDue = computeBalanceDueFromParts(total, amountPaid);

    const { data: partialPayments } = await scopeQ(tenantId, 'finances')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('category', 'partial_payment')
      .limit(1);

    return {
      booking,
      invoiceId: buildInvoiceId(booking),
      displayId: booking.display_id || buildInvoiceId(booking),
      accommodation,
      totalAccommodation: accommodation,
      totalAddons,
      totalMenuItems: menuTotal,
      extraBeds,
      extraBreakfast,
      otherAddons,
      accommodationLines,
      addonLines,
      menuLines,
      discountLines,
      lineItems,
      menuItems,
      menuTotal,
      subtotalBeforeDiscount,
      discountAmount,
      discount: discountMeta,
      discountCode: discountMeta?.code || null,
      applicationRule: discountMeta?.application_rule || null,
      total,
      amountPaid,
      balanceDue,
      balance: balanceDue,
      reminder: balanceDue,
      paymentStatus: booking.payment_status || 'pending',
      hasPartialPayment: (partialPayments || []).length > 0
        || booking.payment_status === 'partial'
        || booking.payment_status === 'complete',
      propertyNames: booking.booking_properties?.map((bv) => bv.properties?.name).filter(Boolean).join(', ') || '—',
      guestName: booking.guests?.full_name || 'Guest',
      guestEmail: booking.guests?.email || '',
      phone: booking.guests?.phone_number || '',
      totalGuests: booking.total_guests,
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      nights,
    };
  }

  return { buildFinancialSummary };
}
