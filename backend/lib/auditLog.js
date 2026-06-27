export async function auditLog(supabase, {
  tenantId,
  userId = null,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  req = null,
}) {
  if (!tenantId || !action || !entityType || !entityId) return;

  try {
    await supabase.from('audit_log').insert([{
      tenant_id: tenantId,
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
