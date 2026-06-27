/** Booking-scoped tenant helpers (child tables without tenant_id). */

export async function assertBookingInTenant(supabase, scopeQ, tenantId, bookingId) {
  const { data, error } = await scopeQ(tenantId, 'bookings')
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

export const assertBookingInProperty = assertBookingInTenant;

export async function findPropertyBookingConflicts(
  supabase,
  { propertyIds, checkIn, checkOut, tenantId, excludeBookingId = null },
) {
  let query = supabase
    .from('booking_properties')
    .select('property_id, booking_id, bookings!inner (id, check_in_date, check_out_date, status, tenant_id)')
    .eq('bookings.tenant_id', tenantId)
    .in('property_id', propertyIds)
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
  await supabase.from('booking_properties').delete().eq('booking_id', bookingId);
}

export async function deleteBookingCascade(supabase, scopeQ, tenantId, bookingId) {
  await deleteBookingChildren(supabase, bookingId);
  await scopeQ(tenantId, 'bookings').delete().eq('id', bookingId);
}
