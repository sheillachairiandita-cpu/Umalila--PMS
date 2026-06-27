export function encodeExpenseProof(description, proofUrl) {
  const base = (description || '').trim();
  if (!proofUrl) return base || null;
  return base ? `${base}\n[proof:${proofUrl}]` : `[proof:${proofUrl}]`;
}

export function parseExpenseRecord(row) {
  const rawDescription = row.description || '';
  const proofMatch = rawDescription.match(/\[proof:([^\]]+)\]/);
  const proof = proofMatch?.[1] || null;
  const description = rawDescription.replace(/\n?\[proof:[^\]]+\]\s*$/, '').trim();
  return {
    id: row.id,
    displayId: row.display_id,
    category: row.category,
    description,
    amount: Number(row.amount) || 0,
    transactionDate: row.transaction_date,
    status: row.status,
    proof,
    createdAt: row.created_at,
  };
}

export function mapCostProfileRow(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.properties?.name || '—',
    fixedStayCost: Number(row.fixed_stay_cost) || 0,
    costPerNight: Number(row.cost_per_night) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProfitabilityRow(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    propertyId: row.property_id,
    propertyName: row.properties?.name || '—',
    revenue: Number(row.revenue) || 0,
    roomRevenue: Number(row.room_revenue) || 0,
    addonRevenue: Number(row.addon_revenue) || 0,
    fbRevenue: Number(row.fb_revenue) || 0,
    cogs: Number(row.cogs) || 0,
    grossProfit: Number(row.gross_profit) || 0,
    fixedStayCostSnapshot: Number(row.fixed_stay_cost_snapshot) || 0,
    costPerNightSnapshot: Number(row.cost_per_night_snapshot) || 0,
    nights: Number(row.nights) || 0,
    calculatedAt: row.calculated_at,
    checkIn: row.bookings?.check_in_date,
    checkOut: row.bookings?.check_out_date,
    bookingStatus: row.bookings?.status,
  };
}
