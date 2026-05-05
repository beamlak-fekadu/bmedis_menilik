import { createClient } from '@/lib/supabase/client';

type AuditValues = Record<string, unknown> | null;

export async function getCurrentProfileId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return (profile?.id as string | undefined) ?? null;
}

export async function logAuditEvent(params: {
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: AuditValues;
  newValues?: AuditValues;
  details?: AuditValues;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const profileId = await getCurrentProfileId();
    if (!profileId) {
      const msg = '[audit] No linked profile for current user; audit row not written.';
      console.error(msg);
      return { success: false, error: msg };
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: profileId,
      performed_by: profileId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      details: params.details ?? null,
    });

    if (error) {
      console.error('[audit] Failed to write audit log:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[audit] Failed to write audit log:', message);
    return { success: false, error: message };
  }
}
