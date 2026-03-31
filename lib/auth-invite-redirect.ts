import type { NextRequest } from 'next/server';
import {
  requestHostname,
  tenantDomainSuffixFromEnv,
} from '@/lib/supabase-cookie-domain';

const ACCEPT_INVITE_PATH = '/ycode/accept-invite';

/**
 * Absolute invite redirect URLs must stay on the same host as the request or on
 * the configured tenant apex/wildcard (e.g. *.masjidweb.com). Otherwise a client
 * could try to bounce the post-invite flow through an untrusted origin (Supabase
 * may still block via redirect allowlist; this is defense in depth).
 */
function isInviteRedirectHostAllowed(
  redirectHostname: string,
  request: NextRequest,
): boolean {
  const reqHost = requestHostname(request.headers).toLowerCase();
  const h = redirectHostname.replace(/:\d+$/, '').toLowerCase();
  if (!h) return false;
  if (h === reqHost) return true;
  const suffix = tenantDomainSuffixFromEnv()?.toLowerCase();
  if (suffix && (h === suffix || h.endsWith(`.${suffix}`))) return true;
  return false;
}

/**
 * Supabase invite emails use `redirect_to` on the verify link. If it is missing,
 * GoTrue falls back to the project **Site URL** (e.g. https://masjidweb.com).
 * We derive a per-tenant URL from the incoming request host so invites sent
 * from a tenant subdomain return users to that same host (when the client does
 * not send a full `redirectTo`).
 */
export function resolveInviteRedirectUrl(
  request: NextRequest,
  bodyRedirectTo: unknown,
): string | undefined {
  const raw =
    typeof bodyRedirectTo === 'string' && bodyRedirectTo.trim().length > 0
      ? bodyRedirectTo.trim()
      : '';

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    try {
      const u = new URL(raw);
      if (isInviteRedirectHostAllowed(u.hostname, request)) {
        return raw;
      }
    } catch {
      // Unparseable — fall through to derived URL
    }
  }

  const host = requestHostname(request.headers).toLowerCase();

  if (!host) {
    return undefined;
  }

  const protoHeader = request.headers.get('x-forwarded-proto');
  const proto =
    protoHeader?.split(',')[0]?.trim() ||
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');

  return `${proto}://${host}${ACCEPT_INVITE_PATH}`;
}
