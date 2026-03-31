/**
 * Settings Repository
 *
 * Data access layer for application settings stored in the database
 */

import { settingsTenantIdOrNull } from '@/lib/masjidweb/settings-tenant-id';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { Setting } from '@/types';

/**
 * Get all settings
 *
 * @returns Promise resolving to all settings
 */
export async function getAllSettings(): Promise<Setting[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  let listQuery = client.from('settings').select('*').order('key', { ascending: true });
  const listTid = settingsTenantIdOrNull();
  if (listTid) {
    listQuery = listQuery.eq('tenant_id', listTid);
  }

  const { data, error } = await listQuery;

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a setting by key
 *
 * @param key - The setting key
 * @returns Promise resolving to the setting value or null if not found
 */
export async function getSettingByKey(key: string): Promise<any | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  let oneQuery = client.from('settings').select('value').eq('key', key);
  const oneTid = settingsTenantIdOrNull();
  if (oneTid) {
    oneQuery = oneQuery.eq('tenant_id', oneTid);
  }

  const { data, error } = await oneQuery.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch setting: ${error.message}`);
  }

  return data?.value ?? null;
}

/**
 * Get multiple settings by keys in a single query
 *
 * @param keys - Array of setting keys to fetch
 * @returns Promise resolving to a map of key -> value
 */
export async function getSettingsByKeys(keys: string[]): Promise<Record<string, any>> {
  if (keys.length === 0) {
    return {};
  }

  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  let keysQuery = client.from('settings').select('key, value').in('key', keys);
  const keysTid = settingsTenantIdOrNull();
  if (keysTid) {
    keysQuery = keysQuery.eq('tenant_id', keysTid);
  }

  const { data, error } = await keysQuery;

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  const result: Record<string, any> = {};
  for (const setting of data || []) {
    result[setting.key] = setting.value;
  }

  return result;
}

/**
 * Set a setting value (insert or update)
 *
 * @param key - The setting key
 * @param value - The value to store
 * @returns Promise resolving to the created/updated setting
 */
export async function setSetting(key: string, value: any): Promise<Setting> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const tenantId = settingsTenantIdOrNull();
  const row: Record<string, unknown> = {
    key,
    value,
    updated_at: new Date().toISOString(),
  };
  if (tenantId) {
    row.tenant_id = tenantId;
  }

  const { data, error } = await client
    .from('settings')
    .upsert(row, {
      onConflict: tenantId ? 'tenant_id,key' : 'key',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set setting: ${error.message}`);
  }

  return data;
}

/**
 * Set multiple settings at once (batch upsert)
 * Settings with null/undefined values are deleted instead of upserted.
 *
 * @param settings - Object with key-value pairs to store
 * @returns Promise resolving to the number of settings updated
 */
export async function setSettings(settings: Record<string, any>): Promise<number> {
  const entries = Object.entries(settings);
  if (entries.length === 0) {
    return 0;
  }

  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Separate entries: null/undefined values should be deleted, others upserted
  const toUpsert: [string, any][] = [];
  const toDelete: string[] = [];

  for (const [key, value] of entries) {
    if (value === null || value === undefined) {
      toDelete.push(key);
    } else {
      toUpsert.push([key, value]);
    }
  }

  // Delete settings with null values
  if (toDelete.length > 0) {
    let delQuery = client.from('settings').delete().in('key', toDelete);
    const delTid = settingsTenantIdOrNull();
    if (delTid) {
      delQuery = delQuery.eq('tenant_id', delTid);
    }

    const { error: deleteError } = await delQuery;

    if (deleteError) {
      throw new Error(`Failed to delete settings: ${deleteError.message}`);
    }
  }

  // Upsert settings with non-null values
  if (toUpsert.length > 0) {
    const now = new Date().toISOString();
    const tenantId = settingsTenantIdOrNull();
    const records = toUpsert.map(([key, value]) => ({
      key,
      value,
      updated_at: now,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    }));

    const { error } = await client
      .from('settings')
      .upsert(records, {
        onConflict: tenantId ? 'tenant_id,key' : 'key',
      });

    if (error) {
      throw new Error(`Failed to set settings: ${error.message}`);
    }
  }

  return entries.length;
}
