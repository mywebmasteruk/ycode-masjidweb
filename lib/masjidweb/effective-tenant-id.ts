import { AsyncLocalStorage } from 'node:async_hooks';
import { cache } from 'react';
import { headers } from 'next/headers';
import { settingsTenantIdOrNull } from '@/lib/masjidweb/settings-tenant-id';

/**
 * Per-request override so route handlers can pin tenant from `NextRequest.headers`
 * before any `headers()` / React `cache()` reads. Provisioning publish hits the pool
 * hostname; the proxy sets `x-tenant-id` on the forwarded request — this guarantees
 * repositories see that id even if `headers()` and the request object ever diverge.
 */
const effectiveTenantOverride = new AsyncLocalStorage<string>();

export function runWithEffectiveTenantId<T>(
  tenantId: string,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return effectiveTenantOverride.run(tenantId, fn);
}

/**
 * Single entry point for “which tenant applies to this server work?”
 *
 * ## Resolution order
 * 1. **Override** — [runWithEffectiveTenantId] (e.g. publish route pins proxy `x-tenant-id`).
 * 2. `x-tenant-id` request header — **only** set by [proxy.ts](../../proxy.ts), never trusted from the browser.
 * 3. Env fallback (no request context): `TENANT_ID`, then `MASTER_TENANT_ID`, then `TEMPLATE_TENANT_ID`
 *    via [settings-tenant-id.ts](./settings-tenant-id.ts). Use for scripts, cron, local jobs; treat as
 *    **single-tenant** unless you pass tenant explicitly elsewhere.
 *
 * ## Threat model (builder)
 * - The proxy **strips** any client-supplied `x-tenant-id` / `x-tenant-slug`, then sets them from:
 *   - **Subdomain** → `tenant_registry` lookup, or
 *   - **TEMPLATE_TENANT_ID** on the master builder host, or
 *   - **Provisioning** publish (`x-provisioning-secret` + optional slug), or
 *   - **Apex /ycode** path: Supabase session `user_metadata.tenant_id` (read-only cookie client).
 * - For authenticated `/ycode/api/*` routes, the proxy also requires JWT `user_metadata.tenant_id` to
 *   match `x-tenant-id` when both are present (see `tenant-session-alignment.ts`).
 *
 * ## Service role vs RLS
 * Repositories use `getSupabaseAdmin()` (service role), which **bypasses** Postgres RLS. Row isolation
 * depends on **explicit** `.eq('tenant_id', …)` (or helpers in `tenant-query.ts`). RLS still protects
 * direct PostgREST access with the anon key + user JWT.
 *
 * Header/env resolution is wrapped in React `cache()` (fewer `headers()` calls). The override is
 * checked on every call so it always wins over a cached env fallback.
 *
 * ## Public site
 * Tenant for published pages should come from **hostname → tenant_registry**, not from a shared
 * deploy env default, when serving multiple tenants from one app.
 */
const readTenantIdFromHeadersAndEnv = cache(async (): Promise<string | null> => {
  try {
    const h = await headers();
    const fromHeader = h.get('x-tenant-id')?.trim();
    if (fromHeader) return fromHeader;
  } catch {
    /* no request AsyncLocalStorage context */
  }
  return settingsTenantIdOrNull();
});

export async function resolveEffectiveTenantId(): Promise<string | null> {
  const override = effectiveTenantOverride.getStore();
  if (override) return override;
  return readTenantIdFromHeadersAndEnv();
}
