/** Booking-scoped tenant helpers (child tables without property_id). */

export async function assertBookingInProperty(supabase, scopeQ, propertyId, bookingId) {
  const { data, error } = await scopeQ(propertyId, 'bookings')
    .select('id')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error('Booking not found.');
    err.status = 404;
    throw err;
  }
  return data;
}

export async function findVillaBookingConflicts(
  supabase,
  { villaIds, checkIn, checkOut, propertyId, excludeBookingId = null },
) {
  let query = supabase
    .from('booking_villas')
    .select('villa_id, booking_id, bookings!inner (id, check_in_date, check_out_date, status, property_id)')
    .eq('bookings.property_id', propertyId)
    .in('villa_id', villaIds)
    .not('bookings.status', 'eq', 'cancelled')
    .lt('bookings.check_in_date', checkOut)
    .gt('bookings.check_out_date', checkIn);

  if (excludeBookingId) {
    query = query.neq('booking_id', excludeBookingId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteBookingChildren(supabase, bookingId) {
  await supabase.from('booking_addons').delete().eq('booking_id', bookingId);
  await supabase.from('booking_villas').delete().eq('booking_id', bookingId);
}

export async function deleteBookingCascade(supabase, scopeQ, propertyId, bookingId) {
  await deleteBookingChildren(supabase, bookingId);
  await scopeQ(propertyId, 'bookings').delete().eq('id', bookingId);
}
