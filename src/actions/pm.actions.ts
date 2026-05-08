'use server';

import { z } from 'zod';
import { recomputeAssetAnalytics } from './analytics.actions';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const pmPaths = ['/pm', '/command', '/reports/pm'];

export async function createPMPlanAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      template_id: z.string().optional().nullable(),
      name: z.string().trim().min(3),
      frequency_days: z.coerce.number().int().min(1),
      next_due_date: z.string().optional().nullable(),
      last_completed_date: z.string().optional().nullable(),
      is_active: z.boolean().optional(),
      created_by: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, template_id: nullIfEmpty(parsed.template_id), next_due_date: nullIfEmpty(parsed.next_due_date), last_completed_date: nullIfEmpty(parsed.last_completed_date), is_active: parsed.is_active ?? true, created_by: nullIfEmpty(parsed.created_by) ?? profile.id };
    const result = await supabase.from('pm_plans').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_plan.create', entityType: 'pm_plans', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(pmPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create PM plan');
  }
}

export async function updateScheduleStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsedStatus = z.enum(['scheduled', 'completed', 'overdue', 'skipped', 'in_progress']).parse(status);
    const oldRow = await supabase.from('pm_schedules').select('*').eq('id', id).maybeSingle();
    const result = await supabase.from('pm_schedules').update({ status: parsedStatus } as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_schedule.status_update', entityType: 'pm_schedules', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    if (parsedStatus === 'completed' && assetId) await recomputeAssetAnalytics(assetId).catch(() => undefined);
    revalidateMany([...pmPaths, `/pm/schedules/${id}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update PM schedule');
  }
}

export async function createPMCompletionAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      schedule_id: z.string().min(1),
      completed_by: z.string().optional().nullable(),
      completion_date: z.string().min(1),
      duration_hours: z.coerce.number().optional().nullable(),
      checklist_results: z.unknown().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, completed_by: nullIfEmpty(parsed.completed_by) ?? profile.id, duration_hours: parsed.duration_hours ?? null, notes: nullIfEmpty(parsed.notes), checklist_results: parsed.checklist_results ?? null };
    const result = await supabase.from('pm_completions').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_completion.create', entityType: 'pm_completions', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    const schedule = await supabase.from('pm_schedules').select('asset_id').eq('id', parsed.schedule_id).maybeSingle();
    const assetId = (schedule.data as { asset_id?: string } | null)?.asset_id;
    if (assetId) await recomputeAssetAnalytics(assetId).catch(() => undefined);
    revalidateMany(pmPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create PM completion');
  }
}
