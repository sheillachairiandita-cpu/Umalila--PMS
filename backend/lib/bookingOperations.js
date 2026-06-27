import { computePropertyStayCharges } from './propertyRateUtils.js';
import {
  calculateDiscountAmount,
  isDiscountEligible,
  resolveDiscountApplication,
  normalizeStatus,
} from './discountUtils.js';
import { stayNights } from './stayUtils.js';

function addonUnitPrice(addon) {
  return Number(addon?.price) || 0;
}

export async function fetchPricingHolidays(scopeQ, tenantId) {
  const { data, error } = await scopeQ(tenantId, 'pricing_holidays')
    .select('id, name, start_date, end_date')
    .order('start_date');
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

export function buildBookingPropertyRows(bookingId, propertyIds, propertyCatalog, checkIn, checkOut, holidays = []) {
  const propertyMap = Object.fromEntries((propertyCatalog || []).map((v) => [v.id, v]));
  return propertyIds.map((propertyId) => {
    const property = propertyMap[propertyId];
    const { avgRate, nights } = computePropertyStayCharges(property || {}, checkIn, checkOut, holidays);
    return {
      booking_id: bookingId,
      property_id: propertyId,
      rate_per_night: avgRate,
      nights,
    };
  });
}

export function buildBookingAddonRows(bookingId, selectedAddons, addonCatalog, nights) {
  const addonMap = Object.fromEntries((addonCatalog || []).map((a) => [a.id, a]));
  return selectedAddons.map((selection) => {
    const addon = addonMap[selection.addon_id];
    const unitPrice = addon ? addonUnitPrice(addon) : 0;
    const quantity = Number(selection.quantity) || 1;
    return {
      booking_id: bookingId,
      addon_id: selection.addon_id,
      quantity,
      unit_price: unitPrice,
    };
  });
}

async function fetchDiscountById(scopeQ, discountId, tenantId) {
  if (!discountId) return null;
  const { data, error } = await scopeQ(tenantId, 'discounts').select('*').eq('id', discountId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function computeBookingCharges(scopeQ, {
  property_ids = [],
  selected_addons = [],
  check_in_date,
  check_out_date,
  tenantId,
}) {
  const nights = stayNights(check_in_date, check_out_date);
  let propertyTotal = 0;
  const propertyLines = [];
  const holidays = await fetchPricingHolidays(scopeQ, tenantId);

  if (property_ids.length > 0) {
    const { data: properties, error } = await scopeQ(tenantId, 'properties')
      .select('id, name, base_rate_per_night, weekend_rate_per_night, holiday_rate_per_night')
      .in('id', property_ids);
    if (error) throw error;
    (properties || []).forEach((property) => {
      const { total, avgRate } = computePropertyStayCharges(property, check_in_date, check_out_date, holidays);
      propertyTotal += total;
      propertyLines.push({
        type: 'accommodation',
        name: property.name,
        description: `${property.name} — ${nights} night${nights !== 1 ? 's' : ''}`,
        quantity: nights,
        unitPrice: avgRate,
        subtotal: total,
        property_id: property.id,
      });
    });
  }

  let addonTotal = 0;
  const addonLines = [];

  if (selected_addons.length > 0) {
    const addonIds = selected_addons.map((a) => a.addon_id);
    const { data: addons, error } = await scopeQ(tenantId, 'addons')
      .select('id, name, price, is_per_night')
      .in('id', addonIds);
    if (error) throw error;
    const addonMap = Object.fromEntries((addons || []).map((a) => [a.id, a]));

    selected_addons.forEach(({ addon_id, quantity }) => {
      const addon = addonMap[addon_id];
      if (!addon) return;
      const qty = Number(quantity) || 1;
      const unitPrice = addonUnitPrice(addon);
      const multiplier = addon.is_per_night !== false ? nights : 1;
      const subtotal = unitPrice * qty * multiplier;
      addonTotal += subtotal;
      addonLines.push({
        type: 'addon',
        name: addon.name,
        description: addon.name,
        quantity: qty * multiplier,
        unitPrice,
        subtotal,
      });
    });
  }

  return {
    nights,
    propertyTotal,
    addonTotal,
    accommodationTotal: propertyTotal + addonTotal,
    propertyLines,
    addonLines,
  };
}

export async function resolveDiscountForBooking(scopeQ, {
  apply_discount,
  discount_id,
  context = {},
  charges = null,
  tenantId,
}) {
  if (!apply_discount) {
    return { discount: null, discount_id: null, discount_amount: 0 };
  }

  let discount = null;
  if (discount_id) {
    discount = await fetchDiscountById(scopeQ, discount_id, tenantId);
    if (discount) {
      const eligibility = isDiscountEligible(discount, context);
      if (!eligibility.eligible) {
        return { discount: null, discount_id: null, discount_amount: 0 };
      }
    }
  } else {
    const { data, error } = await scopeQ(tenantId, 'discounts')
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    const eligible = (data || []).filter((row) => isDiscountEligible(row, context).eligible);
    if (eligible.length > 0 && charges) {
      const resolved = resolveDiscountApplication(eligible, {
        ...context,
        propertyLines: charges.propertyLines,
        addonLines: charges.addonLines,
        menuLines: [],
      });
      discount = resolved.discount;
    } else if (eligible.length > 0) {
      discount = eligible[0];
    }
  }

  if (!discount || normalizeStatus(discount.status) !== 'active') {
    return { discount: null, discount_id: null, discount_amount: 0 };
  }

  return { discount, discount_id: discount.id, discount_amount: null };
}

export { calculateDiscountAmount };
