/**
 * COGS calculation from property cost profiles.
 * Reservation COGS = Fixed Stay Cost + (Cost Per Night × Nights)
 */

export function calculateReservationCogs(fixedStayCost, costPerNight, nights) {
  const fixed = Number(fixedStayCost) || 0;
  const perNight = Number(costPerNight) || 0;
  const n = Math.max(Number(nights) || 0, 0);
  return fixed + perNight * n;
}

export function calculateGrossProfit(revenue, cogs) {
  return (Number(revenue) || 0) - (Number(cogs) || 0);
}

/**
 * Split booking-level revenue (addons, F&B) across properties by room revenue share.
 */
export function allocateByRoomShare(propertyRoomRevenues, amount) {
  const total = propertyRoomRevenues.reduce((s, v) => s + (Number(v.roomRevenue) || 0), 0);
  const share = Number(amount) || 0;
  if (!total || !share) {
    return propertyRoomRevenues.map((v) => ({ ...v, allocated: 0 }));
  }
  return propertyRoomRevenues.map((v) => ({
    ...v,
    allocated: share * ((Number(v.roomRevenue) || 0) / total),
  }));
}
