import { NextResponse } from 'next/server';
import { getTenantIdFromHeaders, getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const tenantId = await getTenantIdFromHeaders();
  const client = await getSupabaseAdmin();

  let pagesCount = -1;
  let tenantsCount = -1;
  let clientType = 'unknown';

  if (client) {
    try {
      const { count } = await client.from('pages').select('*', { count: 'exact', head: true });
      pagesCount = count ?? -1;
    } catch (e: any) {
      pagesCount = -2;
    }

    try {
      const { count } = await client.from('collection_items').select('*', { count: 'exact', head: true });
      tenantsCount = count ?? -1;
    } catch (e: any) {
      tenantsCount = -2;
    }

    // Check if client is using service role or authenticated role
    try {
      const { data } = await client.auth.getUser();
      clientType = data?.user ? `authenticated (${data.user.email})` : 'service-role (no user)';
    } catch {
      clientType = 'service-role (getUser failed)';
    }
  }

  return NextResponse.json({
    tenantIdFromHeaders: tenantId,
    clientType,
    pagesVisible: pagesCount,
    collectionItemsVisible: tenantsCount,
    hasClient: !!client,
  });
}
