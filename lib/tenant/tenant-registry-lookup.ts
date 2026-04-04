/**
 * Resolve tenant id/slug from tenant_registry via Supabase REST (service role).
 * Used by proxy.ts.
 *
 * No in-memory slug→id cache: after reclaim + reprovision the same slug gets a new
 * `tenant_registry.id`; caching the old UUID for 60s made the builder load an empty
 * tenant while rows lived under the new id.
 */

import { getSupabaseEnvConfig } from '@/lib/tenant/middleware-utils';

export async function lookupTenant(
  slug: string,
  /** @deprecated Reserved for future stricter filters; provisioning tenants are always included so /ycode works during setup. */
  _allowProvisioning = false,
): Promise<{ id: string; slug: string } | null> {
  const envConfig = getSupabaseEnvConfig();
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!envConfig || !key) return null;
  const url = envConfig.url;

  try {
    const qs = new URLSearchParams({
      slug: `eq.${slug}`,
      status: 'in.(active,provisioning)',
      select: 'id,slug',
      limit: '1',
    });
    const res = await fetch(`${url}/rest/v1/tenant_registry?${qs}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { id: string; slug: string }[];
    if (!rows.length) return null;
    return rows[0];
  } catch {
    return null;
  }
}
