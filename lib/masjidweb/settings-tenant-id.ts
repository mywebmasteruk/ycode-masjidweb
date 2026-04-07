/**
 * MasjidWeb multi-tenant: one Supabase project, many sites. Rows are scoped by
 * `tenant_id` (see DB migration `settings_key_tenant_unique`).
 *
 * Precedence:
 * 1. `TENANT_ID` — per-tenant Netlify site (from provisioning)
 * 2. `MASTER_TENANT_ID` / `TEMPLATE_TENANT_ID` — shared builder site (e.g. masjidweb-multi)
 */
export function settingsTenantIdOrNull(): string | null {
  const id =
    process.env.TENANT_ID?.trim() ||
    process.env.MASTER_TENANT_ID?.trim() ||
    process.env.TEMPLATE_TENANT_ID?.trim();
  return id ? id : null;
}
