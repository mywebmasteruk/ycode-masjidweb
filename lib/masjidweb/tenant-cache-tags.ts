/**
 * Next.js `unstable_cache` / `revalidateTag` tags scoped by tenant.
 *
 * When `effectiveTenantId` is set (trusted `x-tenant-id` from proxy), tags include the
 * UUID so `clearAllCache(tenantId)` only invalidates that tenant's data cache entries.
 * Without a tenant id (local single-tenant / scripts), legacy global tags are used.
 */

export function tenantAllPagesTag(
  effectiveTenantId: string | null | undefined,
): string {
  const id = effectiveTenantId?.trim();
  if (id) return `tenant-${id}-all-pages`;
  return 'all-pages';
}

/**
 * @param path - URL path without host, e.g. `/`, `about`, `blog/post` (leading slashes stripped)
 */
export function tenantRouteTag(
  effectiveTenantId: string | null | undefined,
  path: string,
): string {
  const id = effectiveTenantId?.trim();
  const normalized = path.replace(/^\/+/, '');
  const base = normalized ? `route-/${normalized}` : 'route-/';
  if (id) return `tenant-${id}-${base}`;
  return base;
}
