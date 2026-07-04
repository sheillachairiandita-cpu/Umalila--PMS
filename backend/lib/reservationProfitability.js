import {
  calculateReservationCogs,
  calculateGrossProfit,
} from './cogsUtils.js';
import { stayNights } from './stayUtils.js';

export function createUpsertReservationProfitability(scopeQ, buildFinancialSummary) {
  return async function upsertReservationProfitability(bookingId, tenantId) {
    const { data: booking, error: bookingError } = await scopeQ(tenantId, 'bookings')
      .select('id, status, payment_status, check_in_date, check_out_date')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    if (booking.status === 'cancelled' || booking.payment_status === 'cancelled') {
      await scopeQ(tenantId, 'reservation_profitability').delete().eq('booking_id', bookingId);
      return [];
    }

    const summary = await buildFinancialSummary(bookingId, tenantId);
    const bookingProperties = summary.booking?.booking_properties || [];
    if (!bookingProperties.length) return [];

    const propertyIds = bookingProperties.map((bv) => bv.property_id).filter(Boolean);
    const { data: profiles } = await scopeQ(tenantId, 'property_cost_profiles')
      .select('property_id, fixed_stay_cost, cost_per_night')
      .in('property_id', propertyIds);

    const profileMap = {};
    (profiles || []).forEach((p) => { profileMap[p.property_id] = p; });

    const nights = stayNights(booking.check_in_date, booking.check_out_date);

    const roomByProperty = {};
    propertyIds.forEach((vid) => { roomByProperty[vid] = 0; });
    (summary.accommodationLines || []).forEach((line) => {
      const vid = line.property_id;
      if (vid && roomByProperty[vid] !== undefined) {
        roomByProperty[vid] += Number(line.subtotal) || 0;
      }
    });

    const totalRoomFromLines = Object.values(roomByProperty).reduce((s, v) => s + v, 0);
    if (totalRoomFromLines === 0 && summary.totalAccommodation > 0) {
      const perProperty = summary.totalAccommodation / bookingProperties.length;
      propertyIds.forEach((pid) => { roomByProperty[pid] = perProperty; });
    }

    const totalRoom = Object.values(roomByProperty).reduce((s, v) => s + v, 0);
    const addonTotal = summary.totalAddons || 0;
    const fbTotal = summary.totalMenuItems || 0;

    const rows = bookingProperties.map((bv) => {
      const vid = bv.property_id;
      const profile = profileMap[vid];
      const fixedSnap = Number(profile?.fixed_stay_cost) || 0;
      const perNightSnap = Number(profile?.cost_per_night) || 0;
      const propertyNights = Number(bv.nights) || nights;
      const cogs = calculateReservationCogs(fixedSnap, perNightSnap, propertyNights);

      const roomRevenue = roomByProperty[vid] || 0;
      const share = totalRoom > 0 ? roomRevenue / totalRoom : 1 / bookingProperties.length;
      const addonRevenue = addonTotal * share;
      const fbRevenue = fbTotal * share;
      const revenue = roomRevenue + addonRevenue + fbRevenue;
      const grossProfit = calculateGrossProfit(revenue, cogs);

      return {
        booking_id: bookingId,
        property_id: vid,
        tenant_id: tenantId,
        revenue,
        room_revenue: roomRevenue,
        addon_revenue: addonRevenue,
        fb_revenue: fbRevenue,
        cogs,
        gross_profit: grossProfit,
        fixed_stay_cost_snapshot: fixedSnap,
        cost_per_night_snapshot: perNightSnap,
        nights: propertyNights,
        calculated_at: new Date().toISOString(),
      };
    });

    const { data: existingRows } = await scopeQ(tenantId, 'reservation_profitability')
      .select('property_id')
      .eq('booking_id', bookingId);

    const removeIds = (existingRows || [])
      .map((r) => r.property_id)
      .filter((vid) => !propertyIds.includes(vid));

    if (removeIds.length) {
      await scopeQ(tenantId, 'reservation_profitability')
        .delete()
        .eq('booking_id', bookingId)
        .in('property_id', removeIds);
    }

    const { data, error } = await scopeQ(tenantId, 'reservation_profitability')
      .upsert(rows, { onConflict: 'booking_id,property_id' })
      .select();

    if (error) throw error;
    return data || [];
  };
}
