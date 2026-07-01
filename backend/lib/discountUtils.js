/**
 * Discount model, validation, eligibility, and calculation engine.
 */

export const DISCOUNT_STATUSES = Object.freeze(['draft', 'active', 'archived']);
export const DISCOUNT_TYPES = Object.freeze(['percentage', 'fixed']);
export const DISCOUNT_SCOPES = Object.freeze(['all_items', 'properties', 'addons', 'menu']);
export const APPLICABLE_PROPERTIES_MODES = Object.freeze(['all', 'selected']);
export const APPLICATION_RULES = Object.freeze(['all_items', 'highest_priced_single', 'lowest_priced_single']);

const LEGACY_SCOPE_MAP = { global: 'all_items' };
const LEGACY_STATUS_MAP = { inactive: 'archived' };

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function parseOptionalInt(value) {
  const num = parseOptionalNumber(value);
  return num === null ? null : Math.trunc(num);
}

function parseDate(value) {
  if (!value) return null;
  const str = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

export function parseIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
  }
  return [];
}

export function normalizeScope(scope) {
  return LEGACY_SCOPE_MAP[scope] || scope || 'all_items';
}

export function normalizeStatus(status, isActive) {
  if (status && LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  if (status && DISCOUNT_STATUSES.includes(status)) return status;
  if (isActive === true) return 'active';
  if (isActive === false) return 'archived';
  return status || 'draft';
}

function includesScope(scope, target) {
  const normalized = normalizeScope(scope);
  return normalized === 'all_items' || normalized === target;
}

function capDiscountAmount(amount, discount) {
  const max = Number(discount.max_discount_amount);
  if (max > 0 && amount > max) return max;
  return amount;
}

function selectedPropertyIds(discount) {
  return [...new Set(parseIdList(discount?.property_ids))];
}

function filterPropertyLines(propertyLines, discount) {
  const lines = propertyLines || [];
  const ids = selectedPropertyIds(discount);
  if (ids.length === 0) return lines;
  return lines.filter((line) => ids.includes(String(line.property_id || line.propertyId)));
}

function lastStayNight(checkOutDate) {
  if (!checkOutDate) return null;
  const date = new Date(`${checkOutDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function computeEligibleBase(scope, propertyLines, addonLines, menuLines) {
  let eligibleBase = 0;

  if (includesScope(scope, 'properties')) {
    eligibleBase += propertyLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
  }
  if (includesScope(scope, 'addons')) {
    eligibleBase += addonLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
  }
  if (includesScope(scope, 'menu')) {
    eligibleBase += menuLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
  }

  return eligibleBase;
}

function computeRuleAmount(discount, propertyLines, eligibleBase) {
  const type = discount.type;
  const value = Number(discount.value) || 0;
  const rule = discount.application_rule || 'all_items';
  const scope = normalizeScope(discount.scope);

  if (
    rule === 'highest_priced_single' &&
    includesScope(scope, 'properties') &&
    propertyLines.length > 0
  ) {
    const target = propertyLines.reduce(
      (max, line) => ((Number(line.subtotal) || 0) > (Number(max.subtotal) || 0) ? line : max),
      propertyLines[0]
    );
    const subtotal = Number(target.subtotal) || 0;
    const amount = type === 'percentage' ? subtotal * (value / 100) : Math.min(value, subtotal);
    return {
      amount,
      detail: type === 'percentage'
        ? `${value}% off ${target.name || target.description || 'highest-priced property'}`
        : `Fixed Rp ${value.toLocaleString('id-ID')} off ${target.name || target.description || 'highest-priced property'}`,
    };
  }

  if (
    rule === 'lowest_priced_single' &&
    includesScope(scope, 'properties') &&
    propertyLines.length > 0
  ) {
    const target = propertyLines.reduce(
      (min, line) => ((Number(line.subtotal) || 0) < (Number(min.subtotal) || 0) ? line : min),
      propertyLines[0]
    );
    const subtotal = Number(target.subtotal) || 0;
    const amount = type === 'percentage' ? subtotal * (value / 100) : Math.min(value, subtotal);
    return {
      amount,
      detail: type === 'percentage'
        ? `${value}% off ${target.name || target.description || 'lowest-priced property'}`
        : `Fixed Rp ${value.toLocaleString('id-ID')} off ${target.name || target.description || 'lowest-priced property'}`,
    };
  }

  if (type === 'percentage') {
    return {
      amount: eligibleBase * (value / 100),
      detail: `${value}% off eligible charges`,
    };
  }

  return {
    amount: Math.min(value, eligibleBase),
    detail: `Fixed Rp ${value.toLocaleString('id-ID')} off`,
  };
}

export function isDiscountEligible(discount, context = {}) {
  if (!discount) {
    return { eligible: false, reason: 'Discount not found.' };
  }

  const status = normalizeStatus(discount.status, discount.is_active);
  if (status !== 'active') {
    return {
      eligible: false,
      reason: status === 'archived' ? 'Discount is archived.' : 'Discount is not active.',
    };
  }

  const bookingDate = context.bookingDate || new Date().toISOString().slice(0, 10);

  if (discount.booking_start_date && bookingDate < discount.booking_start_date) {
    return { eligible: false, reason: 'Discount is not yet valid for booking.' };
  }
  if (discount.booking_end_date && bookingDate > discount.booking_end_date) {
    return { eligible: false, reason: 'Discount booking period has ended.' };
  }

  const checkInDate = context.checkInDate;
  const checkOutDate = context.checkOutDate;

  if (checkInDate && discount.stay_start_date && checkInDate < discount.stay_start_date) {
    return { eligible: false, reason: 'Stay dates are outside the discount period.' };
  }

  const lastNight = lastStayNight(checkOutDate);
  if (lastNight && discount.stay_end_date && lastNight > discount.stay_end_date) {
    return { eligible: false, reason: 'Stay dates are outside the discount period.' };
  }

  const bookingAmount = Number(context.bookingAmount) || 0;
  const minBookingAmount = Number(discount.min_booking_amount);
  if (minBookingAmount > 0 && bookingAmount < minBookingAmount) {
    return { eligible: false, reason: 'Booking amount does not meet the minimum requirement.' };
  }

  const nights = Number(context.nights) || 0;
  const minNights = Number(discount.min_nights);
  if (minNights > 0 && nights < minNights) {
    return { eligible: false, reason: 'Stay does not meet the minimum nights requirement.' };
  }

  const totalUsage = context.totalUsageCount ?? Number(discount.usage_count) ?? 0;
  const totalLimit = parseOptionalInt(discount.total_usage_limit);
  if (totalLimit !== null && totalLimit >= 0 && totalUsage >= totalLimit) {
    return { eligible: false, reason: 'Discount usage limit has been reached.' };
  }

  const guestUsage = Number(context.guestUsageCount) || 0;
  const guestLimit = parseOptionalInt(discount.per_guest_limit);
  if (guestLimit !== null && guestLimit >= 0 && guestUsage >= guestLimit) {
    return { eligible: false, reason: 'Guest usage limit has been reached for this discount.' };
  }

  const scope = normalizeScope(discount.scope);
  const propertyIds = selectedPropertyIds(discount);
  const bookingPropertyIds = (context.propertyIds || []).map(String);

  if (scope === 'properties' && propertyIds.length > 0) {
    const hasMatch = bookingPropertyIds.some((id) => propertyIds.includes(id));
    if (!hasMatch) {
      return { eligible: false, reason: 'Discount does not apply to the selected properties.' };
    }
  }

  return { eligible: true, reason: null };
}

export function validateDiscountPayload(payload, options = {}) {
  const errors = [];
  const { partial = false } = options;
  const scope = payload.scope !== undefined ? normalizeScope(payload.scope) : undefined;
  const applicableProperties = payload.applicable_properties || 'all';
  const propertyIds = parseIdList(payload.property_ids);

  if (!partial) {
    if (!payload.code) errors.push('Promo code is required.');
    if (!payload.name) errors.push('Name is required.');
    if (payload.value === undefined || payload.value === null) errors.push('Discount value is required.');
    if (!payload.type) errors.push('Discount type is required.');
    if (!payload.scope) errors.push('Scope is required.');
  }

  if (payload.code !== undefined && !String(payload.code).trim()) {
    errors.push('Promo code is required.');
  }

  if (payload.type !== undefined && !DISCOUNT_TYPES.includes(payload.type)) {
    errors.push('Invalid discount type.');
  }

  if (payload.scope !== undefined && !DISCOUNT_SCOPES.includes(scope)) {
    errors.push('Invalid discount scope.');
  }

  if (payload.status !== undefined && !DISCOUNT_STATUSES.includes(normalizeStatus(payload.status))) {
    errors.push('Invalid discount status.');
  }

  if (payload.value !== undefined) {
    const value = Number(payload.value);
    if (Number.isNaN(value) || value <= 0) {
      errors.push('Discount value must be greater than zero.');
    } else if (payload.type === 'percentage' && value > 100) {
      errors.push('Percentage discounts cannot exceed 100%.');
    }
  }

  if (payload.type === 'percentage' && payload.value !== undefined && Number(payload.value) > 100) {
    errors.push('Percentage discounts cannot exceed 100%.');
  }

  if (payload.booking_start_date && payload.booking_end_date) {
    if (payload.booking_end_date <= payload.booking_start_date) {
      errors.push('Booking end date must be later than start date.');
    }
  }

  if (payload.stay_start_date && payload.stay_end_date) {
    if (payload.stay_end_date <= payload.stay_start_date) {
      errors.push('Stay end date must be later than start date.');
    }
  }

  if (payload.total_usage_limit !== undefined && payload.total_usage_limit !== null) {
    const limit = Number(payload.total_usage_limit);
    if (Number.isNaN(limit) || limit < 0) errors.push('Total usage limit cannot be negative.');
  }

  if (payload.per_guest_limit !== undefined && payload.per_guest_limit !== null) {
    const limit = Number(payload.per_guest_limit);
    if (Number.isNaN(limit) || limit < 0) errors.push('Per guest limit cannot be negative.');
  }

  if (scope === 'properties' && applicableProperties === 'selected' && propertyIds.length === 0) {
    errors.push('At least one property must be selected when scope is Properties Only and applicable properties is Selected Properties.');
  }

  return { valid: errors.length === 0, errors };
}

export function calculateDiscountAmount(discount, context = {}) {
  if (!discount) return { amount: 0, lines: [] };

  const status = normalizeStatus(discount.status, discount.is_active);
  if (status !== 'active') return { amount: 0, lines: [] };

  const eligibility = isDiscountEligible(discount, context);
  if (!eligibility.eligible) return { amount: 0, lines: [] };

  const scope = normalizeScope(discount.scope);
  const propertyLines = filterPropertyLines(context.propertyLines || [], discount);
  const addonLines = context.addonLines || [];
  const menuLines = context.menuLines || [];

  const eligibleBase = computeEligibleBase(scope, propertyLines, addonLines, menuLines);
  if (eligibleBase <= 0) return { amount: 0, lines: [] };

  const { amount: rawAmount, detail } = computeRuleAmount(discount, propertyLines, eligibleBase);
  let amount = capDiscountAmount(rawAmount, discount);
  amount = round2(amount);

  if (amount <= 0) return { amount: 0, lines: [] };

  return {
    amount,
    lines: [{
      type: 'discount',
      name: discount.name || discount.code,
      description: `Discount (${discount.code}) — ${detail}`,
      quantity: 1,
      unitPrice: -amount,
      subtotal: -amount,
    }],
  };
}

function pickWinningDiscount(evaluated) {
  if (!evaluated.length) return null;
  return [...evaluated].sort((a, b) => {
    const priorityDiff = (Number(b.discount.priority) || 0) - (Number(a.discount.priority) || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return b.amount - a.amount;
  })[0];
}

export function resolveDiscountApplication(discounts, context = {}) {
  const evaluated = (discounts || [])
    .map((discount) => ({ discount, ...calculateDiscountAmount(discount, context) }))
    .filter((entry) => entry.amount > 0);

  if (!evaluated.length) {
    return { amount: 0, discount: null, discounts: [], lines: [] };
  }

  const stackable = evaluated.filter((entry) => entry.discount.stackable);
  const nonStackable = evaluated.filter((entry) => !entry.discount.stackable);
  const stackableTotal = round2(stackable.reduce((sum, entry) => sum + entry.amount, 0));
  const bestNonStackable = pickWinningDiscount(nonStackable);

  if (stackable.length > 0 && stackableTotal >= (bestNonStackable?.amount || 0)) {
    const primary = pickWinningDiscount(stackable);
    return {
      amount: stackableTotal,
      discount: primary.discount,
      discounts: stackable.map((entry) => entry.discount),
      lines: stackable.flatMap((entry) => entry.lines),
    };
  }

  if (bestNonStackable) {
    return {
      amount: bestNonStackable.amount,
      discount: bestNonStackable.discount,
      discounts: [bestNonStackable.discount],
      lines: bestNonStackable.lines,
    };
  }

  return { amount: 0, discount: null, discounts: [], lines: [] };
}

export function mapDiscountRow(row) {
  if (!row) return null;

  const status = normalizeStatus(row.status);
  const scope = normalizeScope(row.scope);
  const propertyIds = parseIdList(row.property_ids);

  return {
    id: row.id,
    code: row.code,
    promo_code: row.code,
    name: row.name,
    description: row.description || '',
    type: row.type,
    value: row.value,
    max_discount_amount: row.max_discount_amount ?? null,
    scope,
    status,
    is_active: status === 'active',
    application_rule: row.application_rule || 'all_items',
    applicable_properties: propertyIds.length > 0 ? 'selected' : 'all',
    property_ids: propertyIds,
    booking_start_date: row.booking_start_date || null,
    booking_end_date: row.booking_end_date || null,
    stay_start_date: row.stay_start_date || null,
    stay_end_date: row.stay_end_date || null,
    min_booking_amount: row.min_booking_amount ?? null,
    min_nights: row.min_nights ?? null,
    total_usage_limit: row.total_usage_limit ?? null,
    per_guest_limit: row.per_guest_limit ?? null,
    usage_count: row.usage_count ?? 0,
    stackable: !!row.stackable,
    priority: row.priority ?? 0,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_by: row.updated_by || null,
    updated_at: row.updated_at || null,
  };
}

export function discountPayloadFromBody(body, { partial = false, userId = null, forUpdate = false } = {}) {
  const payload = {};
  const assign = (key, value) => {
    if (value !== undefined) payload[key] = value;
  };

  if (!partial || body.code !== undefined || body.promo_code !== undefined) {
    assign('code', String(body.code || body.promo_code || '').trim().toUpperCase());
  }
  if (!partial || body.name !== undefined) assign('name', body.name?.trim());
  if (!partial || body.description !== undefined) assign('description', body.description?.trim() || null);
  if (!partial || body.type !== undefined) assign('type', body.type);
  if (!partial || body.value !== undefined) assign('value', Number(body.value));
  if (!partial || body.max_discount_amount !== undefined) {
    assign('max_discount_amount', parseOptionalNumber(body.max_discount_amount));
  }
  if (!partial || body.scope !== undefined) assign('scope', normalizeScope(body.scope));
  if (!partial || body.application_rule !== undefined) {
    assign('application_rule', body.application_rule || 'all_items');
  }
  if (!partial || body.property_ids !== undefined || body.applicable_properties !== undefined) {
    const mode = body.applicable_properties || 'all';
    const ids = parseIdList(body.property_ids);
    assign('property_ids', mode === 'selected' ? ids : []);
  }
  if (!partial || body.booking_start_date !== undefined) assign('booking_start_date', parseDate(body.booking_start_date));
  if (!partial || body.booking_end_date !== undefined) assign('booking_end_date', parseDate(body.booking_end_date));
  if (!partial || body.stay_start_date !== undefined) assign('stay_start_date', parseDate(body.stay_start_date));
  if (!partial || body.stay_end_date !== undefined) assign('stay_end_date', parseDate(body.stay_end_date));
  if (!partial || body.min_booking_amount !== undefined) {
    assign('min_booking_amount', parseOptionalNumber(body.min_booking_amount));
  }
  if (!partial || body.min_nights !== undefined) assign('min_nights', parseOptionalInt(body.min_nights));
  if (!partial || body.total_usage_limit !== undefined) {
    assign('total_usage_limit', parseOptionalInt(body.total_usage_limit));
  }
  if (!partial || body.per_guest_limit !== undefined) {
    assign('per_guest_limit', parseOptionalInt(body.per_guest_limit));
  }
  if (!partial || body.stackable !== undefined) assign('stackable', !!body.stackable);
  if (!partial || body.priority !== undefined) assign('priority', parseOptionalInt(body.priority) ?? 0);

  if (body.status !== undefined || body.is_active !== undefined) {
    assign('status', normalizeStatus(body.status, body.is_active));
  } else if (!partial) {
    payload.status = 'draft';
  }

  if (forUpdate) {
    payload.updated_at = new Date().toISOString();
    if (userId) payload.updated_by = userId;
  } else if (!partial) {
    if (userId) payload.created_by = userId;
  }

  if (body.updated_by !== undefined) payload.updated_by = body.updated_by || null;
  if (body.created_by !== undefined && !forUpdate) payload.created_by = body.created_by || null;

  return payload;
}

export function buildDiscountBookingContext({
  bookingDate,
  checkInDate,
  checkOutDate,
  nights,
  bookingAmount,
  propertyIds,
  guestId,
  totalUsageCount,
  guestUsageCount,
} = {}) {
  return {
    bookingDate: bookingDate || new Date().toISOString().slice(0, 10),
    checkInDate,
    checkOutDate,
    nights,
    bookingAmount,
    propertyIds: propertyIds || [],
    guestId,
    totalUsageCount,
    guestUsageCount,
  };
}
