import { createClient } from '@/lib/supabase/client';

export async function logOfflineSyncEvent(payload: {
  client_action_id: string;
  actor_user_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  sync_status: 'pending' | 'synced' | 'failed';
}) {
  const supabase = createClient();
  return supabase
    .from('offline_sync_events')
    .insert({
      client_action_id: payload.client_action_id,
      actor_user_id: payload.actor_user_id ?? null,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      action_type: payload.action_type,
      payload: payload.payload,
      sync_status: payload.sync_status,
      synced_at: payload.sync_status === 'synced' ? new Date().toISOString() : null,
    });
}
