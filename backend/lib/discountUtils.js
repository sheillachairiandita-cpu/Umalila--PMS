/**
 * Discount calculation helpers aligned with discounts.application_rule
 */

export function calculateDiscountAmount(discount, context) {
  if (!discount || discount.status !== 'active') {
    return { amount: 0, lines: [] };
  }

  const type = discount.type;
  const value = Number(discount.value) || 0;
  const rule = discount.application_rule || 'all_items';
  const scope = discount.scope || 'global';

  const villaLines = context.villaLines || [];
  const addonLines = context.addonLines || [];
  const menuLines = context.menuLines || [];

  const scopedVillaTotal = villaLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
  const scopedAddonTotal = addonLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
  const scopedMenuTotal = menuLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);

  let eligibleBase = 0;

  if (scope === 'global' || scope === 'villas') eligibleBase += scopedVillaTotal;
  if (scope === 'global' || scope === 'addons') eligibleBase += scopedAddonTotal;
  if (scope === 'global' || scope === 'menu') eligibleBase += scopedMenuTotal;

  if (eligibleBase <= 0) {
    return { amount: 0, lines: [] };
  }

  let amount = 0;
  let detail = '';

  if (
    rule === 'highest_priced_single' &&
    type === 'percentage' &&
    (scope === 'villas' || scope === 'global') &&
    villaLines.length > 0
  ) {
    const highest = villaLines.reduce(
      (max, line) => ((Number(line.subtotal) || 0) > (Number(max.subtotal) || 0) ? line : max),
      villaLines[0]
    );
    amount = (Number(highest.subtotal) || 0) * (value / 100);
    detail = `${value}% off ${highest.name || highest.description || 'highest-priced villa'}`;
  } else if (
    rule === 'lowest_priced_single' &&
    type === 'percentage' &&
    (scope === 'villas' || scope === 'global') &&
    villaLines.length > 0
  ) {
    const lowest = villaLines.reduce(
      (min, line) => ((Number(line.subtotal) || 0) < (Number(min.subtotal) || 0) ? line : min),
      villaLines[0]
    );
    amount = (Number(lowest.subtotal) || 0) * (value / 100);
    detail = `${value}% off ${lowest.name || lowest.description || 'lowest-priced villa'}`;
  } else if (type === 'percentage') {
    amount = eligibleBase * (value / 100);
    detail = `${value}% off eligible charges`;
  } else {
    amount = Math.min(value, eligibleBase);
    detail = `Fixed Rp ${value.toLocaleString('id-ID')} off`;
  }

  amount = Math.round(amount * 100) / 100;

  if (amount <= 0) {
    return { amount: 0, lines: [] };
  }

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

export function mapDiscountRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    promo_code: row.code,
    name: row.name,
    type: row.type,
    value: row.value,
    scope: row.scope,
    status: row.status,
    is_active: row.status === 'active',
    application_rule: row.application_rule || 'all_items',
    villa_id: row.villa_id || null,
    created_at: row.created_at,
  };
}

export function discountPayloadFromBody(body, { partial = false } = {}) {
  const payload = {};
  const assign = (key, value) => {
    if (value !== undefined) payload[key] = value;
  };

  if (!partial || body.code !== undefined || body.promo_code !== undefined) {
    assign('code', String(body.code || body.promo_code || '').trim().toUpperCase());
  }
  if (!partial || body.name !== undefined) assign('name', body.name?.trim());
  if (!partial || body.type !== undefined) assign('type', body.type);
  if (!partial || body.value !== undefined) assign('value', Number(body.value));
  if (!partial || body.scope !== undefined) assign('scope', body.scope);
  if (!partial || body.application_rule !== undefined) {
    assign('application_rule', body.application_rule || 'all_items');
  }
  if (!partial || body.villa_id !== undefined) assign('villa_id', body.villa_id || null);

  if (body.status !== undefined || body.is_active !== undefined) {
    const active = body.is_active !== undefined ? body.is_active : body.status === 'active';
    assign('status', active ? 'active' : 'inactive');
  } else if (!partial) {
    payload.status = 'active';
  }

  return payload;
}
