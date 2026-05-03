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
}) {
  try {
    const supabase = createClient();
    const profileId = await getCurrentProfileId();

    const { error } = await supabase.from('audit_logs').insert({
      user_id: profileId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
    });

    if (error && process.env.NODE_ENV !== 'production') {
      console.warn('[audit] Failed to write audit log:', error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[audit] Failed to write audit log:', err);
    }
  }
}
