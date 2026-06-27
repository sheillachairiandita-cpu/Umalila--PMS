/**
 * Resolve tenant from staff email domain (e.g. user@umalila.com → umalila tenant).
 */

/** @param {string} email */
export function extractEmailDomain(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} email
 * @returns {Promise<{ id: string; slug: string; name: string; email_domains: string[] } | null>}
 */
export async function resolveTenantByEmailDomain(supabase, email) {
  const domain = extractEmailDomain(email);
  if (!domain) return null;

  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, email_domains')
    .contains('email_domains', [domain]);

  if (error) throw error;
  if (!data?.length) return null;
  if (data.length > 1) {
    const err = new Error(`Ambiguous tenant for email domain: ${domain}`);
    err.status = 500;
    throw err;
  }

  return data[0];
}

/**
 * @param {string[]} emailDomains
 * @param {string} email
 */
export function emailMatchesTenantDomains(emailDomains, email) {
  const domain = extractEmailDomain(email);
  if (!domain || !Array.isArray(emailDomains) || emailDomains.length === 0) return false;
  return emailDomains.map((d) => String(d).toLowerCase()).includes(domain);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} tenantId
 * @param {string} email
 */
export async function assertEmailMatchesTenant(supabase, tenantId, email) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('email_domains')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!emailMatchesTenantDomains(tenant?.email_domains, email)) {
    const err = new Error('Email must use your organization domain (e.g. @umalila.com or @kayuputih.com).');
    err.status = 400;
    throw err;
  }
}
