/**
 * Optional shared cookie domain so Supabase auth works across tenant subdomains
 * and the apex host (e.g. session from invite landing on https://masjidweb.com/...
 * is still sent to https://tenant.masjidweb.com).
 *
 * Set NEXT_PUBLIC_TENANT_DOMAIN_SUFFIX (browser) and TENANT_DOMAIN_SUFFIX (server)
 * to your tenant base domain, e.g. masjidweb.com
 *
 * Important: every @supabase/ssr client that reads or writes auth cookies (browser,
 * OAuth callback, session route, proxy auth check, getAuthUser) must use the same
 * cookieOptions when this feature is enabled — otherwise refresh can write
 * host-only cookies and you get duplicates or a broken session on subdomains.
 */
export function tenantDomainSuffixFromEnv(): string | undefined {
  const s =
    process.env.TENANT_DOMAIN_SUFFIX?.trim() ||
    process.env.NEXT_PUBLIC_TENANT_DOMAIN_SUFFIX?.trim();
  return s || undefined;
}

/** First host from x-forwarded-host or Host (Netlify / reverse proxies). */
export function requestHostname(headers: Headers): string {
  const xf = headers.get('x-forwarded-host');
  if (xf) {
    const first = xf.split(',')[0]?.trim() ?? '';
    if (first) return first.replace(/:\d+$/, '');
  }
  const host = headers.get('host')?.trim() ?? '';
  return host.replace(/:\d+$/, '');
}

export function supabaseCookieOptionsForHost(
  hostname: string,
  tenantDomainSuffix: string | undefined,
): { domain: string } | undefined {
  const suffix = (tenantDomainSuffix || '').trim().toLowerCase();
  if (!suffix) return undefined;

  const h = hostname.replace(/:\d+$/, '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost')) return undefined;

  if (h === suffix || h.endsWith(`.${suffix}`)) {
    return { domain: `.${suffix}` };
  }

  return undefined;
}

/** Cookie options for SSR / Edge clients when tenant suffix env is set and host matches. */
export function supabaseCookieOptionsForRequestHeaders(
  headers: Headers,
  tenantDomainSuffix: string | undefined = tenantDomainSuffixFromEnv(),
): { domain: string } | undefined {
  return supabaseCookieOptionsForHost(
    requestHostname(headers),
    tenantDomainSuffix,
  );
}
