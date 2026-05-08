'use server';

import { z } from 'zod';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

export async function createInstallationRecordAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      installed_by: z.string().trim().min(1),
      installation_date: z.string().min(1),
      commissioning_date: z.string().optional().nullable(),
      go_live_date: z.string().optional().nullable(),
      initial_training_done: z.boolean().optional(),
      acceptance_checklist: z.unknown().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, commissioning_date: nullIfEmpty(parsed.commissioning_date), go_live_date: nullIfEmpty(parsed.go_live_date), initial_training_done: parsed.initial_training_done ?? false, acceptance_checklist: parsed.acceptance_checklist ?? [], notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('installation_records').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'installation_record.create', entityType: 'installation_records', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(['/installation', '/equipment', '/inventory', '/command']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create installation record');
  }
}
