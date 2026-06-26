export async function auditLog(supabase, {
  propertyId,
  userId = null,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  req = null,
}) {
  if (!propertyId || !action || !entityType || !entityId) return;

  try {
    await supabase.from('audit_log').insert([{
      property_id: propertyId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || null,
    }]);
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
