'use server';

import { z } from 'zod';
import { recomputeAssetAnalytics } from './analytics.actions';
import { getActionContextForCapability, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';
import { OPEN_MAINTENANCE_REQUEST_STATUSES } from '@/utils/maintenance/request-status';
import { datePlusDays } from '@/utils/pm/semantics';

const pmPaths = ['/pm', '/calendar', '/command', '/reports/pm'];
const ACTIVE_PM_SCHEDULE_STATUSES = ['scheduled', 'in_progress', 'overdue', 'deferred'] as const;

const pmResultToCondition = {
  pass: 'functional',
  issue_found: 'needs_repair',
  failed: 'non_functional',
} as const;

const pmCompletionSchema = z.object({
  schedule_id: z.string().min(1),
  completed_by: z.string().optional().nullable(),
  completion_date: z.string().min(1),
  duration_hours: z.coerce.number().optional().nullable(),
  result: z.enum(['pass', 'issue_found', 'failed']),
  checklist_results: z.array(z.object({
    task: z.string(),
    required: z.boolean().optional().default(false),
    completed: z.boolean().optional(),
    notes: z.string().optional().nullable(),
  })).default([]),
  notes: z.string().optional().nullable(),
  final_equipment_condition: z.enum(['functional', 'needs_repair', 'non_functional', 'under_maintenance']).optional().nullable(),
  corrective_action_needed: z.boolean().optional(),
  create_corrective_request: z.boolean().optional(),
});

const deferSkipSchema = z.object({
  schedule_id: z.string().min(1),
  action_type: z.enum(['skip', 'defer']),
  reason: z.string().trim().min(3),
  new_scheduled_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function getScheduleContext(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, id: string) {
  return supabase
    .from('pm_schedules')
    .select('*, pm_plans(id, name, frequency_days), equipment_assets(id, name, asset_code, department_id)')
    .eq('id', id)
    .maybeSingle();
}

export async function createPMPlanAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.plan.create');
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
    const { supabase, profile, error } = await getActionContextForCapability('pm.complete');
    if (error || !profile) return { success: false, error };
    const parsedStatus = z.enum(['scheduled', 'completed', 'overdue', 'skipped', 'deferred', 'in_progress', 'canceled']).parse(status);
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
    const { supabase, profile, error } = await getActionContextForCapability('pm.complete');
    if (error || !profile) return { success: false, error };
    const parsed = pmCompletionSchema.parse(payload);
    const completedBy = nullIfEmpty(parsed.completed_by) ?? profile.id;
    const finalCondition = parsed.final_equipment_condition ?? pmResultToCondition[parsed.result];
    const correctiveNeeded = parsed.corrective_action_needed ?? parsed.result !== 'pass';

    const scheduleRes = await getScheduleContext(supabase, parsed.schedule_id);
    if (scheduleRes.error) return { success: false, error: scheduleRes.error.message };
    if (!scheduleRes.data) return { success: false, error: 'PM schedule not found' };
    const schedule = scheduleRes.data as Record<string, unknown>;
    const assetId = schedule.asset_id as string;
    const planId = schedule.plan_id as string;
    const plan = schedule.pm_plans as { id?: string; name?: string; frequency_days?: number } | null;
    const asset = schedule.equipment_assets as { id?: string; name?: string; asset_code?: string; department_id?: string | null } | null;

    const data = {
      schedule_id: parsed.schedule_id,
      completed_by: completedBy,
      completion_date: parsed.completion_date,
      duration_hours: parsed.duration_hours ?? null,
      notes: nullIfEmpty(parsed.notes),
      checklist_results: parsed.checklist_results ?? [],
    };
    const result = await supabase.from('pm_completions').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };

    const scheduleUpdate = await supabase
      .from('pm_schedules')
      .update({
        status: 'completed',
        result: parsed.result,
        completion_checklist: parsed.checklist_results,
        completion_notes: nullIfEmpty(parsed.notes),
        final_equipment_condition: finalCondition,
        corrective_action_needed: correctiveNeeded,
        completed_by: completedBy,
        completed_at: new Date(`${parsed.completion_date}T12:00:00`).toISOString(),
      } as never)
      .eq('id', parsed.schedule_id)
      .select('*')
      .single();
    if (scheduleUpdate.error) return { success: false, error: scheduleUpdate.error.message };

    const nextDueDate = plan?.frequency_days ? datePlusDays(parsed.completion_date, plan.frequency_days) : null;
    await supabase
      .from('pm_plans')
      .update({
        last_completed_date: parsed.completion_date,
        next_due_date: nextDueDate,
      } as never)
      .eq('id', planId);

    await supabase
      .from('equipment_assets')
      .update({ condition: finalCondition } as never)
      .eq('id', assetId);

    let correctiveRequestId: string | null = null;
    if (parsed.create_corrective_request && correctiveNeeded) {
      const existing = await supabase
        .from('maintenance_requests')
        .select('id, request_number, status')
        .eq('asset_id', assetId)
        .in('status', [...OPEN_MAINTENANCE_REQUEST_STATUSES])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing.data?.id) {
        correctiveRequestId = existing.data.id as string;
      } else {
        const request = await supabase
          .from('maintenance_requests')
          .insert({
            request_number: `MR-${Date.now().toString(36).toUpperCase()}`,
            asset_id: assetId,
            requested_by: profile.id,
            department_id: asset?.department_id ?? profile.department_id,
            fault_description: `PM completion for ${asset?.asset_code ?? 'asset'} found ${parsed.result.replace(/_/g, ' ')}. ${parsed.notes ?? 'Review PM evidence and decide corrective action.'}`,
            urgency: parsed.result === 'failed' ? 'high' : 'medium',
            status: 'pending',
            notes: `Source: PM completion\nPM schedule: ${parsed.schedule_id}\nPlan: ${plan?.name ?? 'Preventive maintenance'}\nResult: ${parsed.result}`,
            reported_condition: finalCondition === 'functional' ? 'functional_issue' : finalCondition,
            reported_condition_source: 'pm-completion',
          } as never)
          .select('id')
          .single();
        if (!request.error) correctiveRequestId = (request.data as { id?: string }).id ?? null;
      }
    }

    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_completion.create', entityType: 'pm_completions', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    if (assetId) await recomputeAssetAnalytics(assetId).catch(() => undefined);
    revalidateMany([...pmPaths, `/pm/schedules/${parsed.schedule_id}`, '/equipment', `/equipment/${assetId}`, '/maintenance']);
    return { success: true, data: { completion: result.data, schedule: scheduleUpdate.data, correctiveRequestId } };
  } catch (err) {
    return actionError(err, 'Failed to create PM completion');
  }
}

export async function assignPMScheduleAction(id: string, assignedTo: string | null): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.assign');
    if (error || !profile) return { success: false, error };
    const assignee = nullIfEmpty(assignedTo);
    const oldRow = await supabase.from('pm_schedules').select('*').eq('id', id).maybeSingle();
    const result = await supabase
      .from('pm_schedules')
      .update({ assigned_to: assignee } as never)
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_schedule.assign', entityType: 'pm_schedules', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    revalidateMany([...pmPaths, `/pm/schedules/${id}`, assetId ? `/equipment/${assetId}` : '/equipment']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to assign PM schedule');
  }
}

export async function startPMScheduleAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.complete');
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('pm_schedules').select('*').eq('id', id).maybeSingle();
    const result = await supabase
      .from('pm_schedules')
      .update({ status: 'in_progress', started_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_schedule.start', entityType: 'pm_schedules', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    revalidateMany([...pmPaths, `/pm/schedules/${id}`, assetId ? `/equipment/${assetId}` : '/equipment']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to start PM schedule');
  }
}

export async function deferOrSkipPMScheduleAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.complete');
    if (error || !profile) return { success: false, error };
    const parsed = deferSkipSchema.parse(payload);
    const oldRow = await supabase.from('pm_schedules').select('*').eq('id', parsed.schedule_id).maybeSingle();
    const updatePayload: Record<string, unknown> = {
      status: parsed.action_type === 'skip' ? 'skipped' : 'deferred',
      notes: nullIfEmpty(parsed.notes),
    };
    if (parsed.action_type === 'skip') updatePayload.skipped_reason = parsed.reason;
    if (parsed.action_type === 'defer') {
      updatePayload.deferred_reason = parsed.reason;
      updatePayload.deferred_until = nullIfEmpty(parsed.new_scheduled_date);
      if (parsed.new_scheduled_date) updatePayload.scheduled_date = parsed.new_scheduled_date;
    }
    const result = await supabase
      .from('pm_schedules')
      .update(updatePayload as never)
      .eq('id', parsed.schedule_id)
      .select('*')
      .single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: `pm_schedule.${parsed.action_type}`, entityType: 'pm_schedules', entityId: parsed.schedule_id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    if (assetId) await recomputeAssetAnalytics(assetId).catch(() => undefined);
    revalidateMany([...pmPaths, `/pm/schedules/${parsed.schedule_id}`, assetId ? `/equipment/${assetId}` : '/equipment']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to defer or skip PM schedule');
  }
}

export async function updatePMPlanStatusAction(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.plan.create');
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('pm_plans').select('*').eq('id', id).maybeSingle();
    const result = await supabase.from('pm_plans').update({ is_active: isActive } as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: isActive ? 'pm_plan.activate' : 'pm_plan.pause', entityType: 'pm_plans', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany(pmPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update PM plan');
  }
}

export async function pausePMPlanAction(id: string, reason?: string | null): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.plan.create');
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('pm_plans').select('*').eq('id', id).maybeSingle();
    if (oldRow.error) return { success: false, error: oldRow.error.message };
    if (!oldRow.data) return { success: false, error: 'PM plan not found' };
    const result = await supabase.from('pm_plans').update({ is_active: false } as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'pm_plan.pause',
      entityType: 'pm_plans',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: result.data as Record<string, unknown>,
      details: { reason: nullIfEmpty(reason) },
    });
    revalidateMany([...pmPaths, `/pm/plans/${id}/history`, assetId ? `/equipment/${assetId}` : '/equipment']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to pause PM plan');
  }
}

export async function resumePMPlanAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.plan.create');
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('pm_plans').select('*').eq('id', id).maybeSingle();
    if (oldRow.error) return { success: false, error: oldRow.error.message };
    if (!oldRow.data) return { success: false, error: 'PM plan not found' };
    const result = await supabase.from('pm_plans').update({ is_active: true } as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'pm_plan.resume',
      entityType: 'pm_plans',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: result.data as Record<string, unknown>,
    });
    revalidateMany([...pmPaths, `/pm/plans/${id}/history`, assetId ? `/equipment/${assetId}` : '/equipment']);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to resume PM plan');
  }
}

export async function generateNextPMScheduleAction(planId: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('pm.plan.create');
    if (error || !profile) return { success: false, error };
    const planRes = await supabase.from('pm_plans').select('*').eq('id', planId).maybeSingle();
    if (planRes.error) return { success: false, error: planRes.error.message };
    if (!planRes.data) return { success: false, error: 'PM plan not found' };
    const plan = planRes.data as Record<string, unknown>;
    if (plan.is_active === false) return { success: false, error: 'Resume this PM plan before generating the next task.' };

    const existingActive = await supabase
      .from('pm_schedules')
      .select('id, plan_id, asset_id, scheduled_date, status')
      .eq('plan_id', planId)
      .in('status', [...ACTIVE_PM_SCHEDULE_STATUSES])
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingActive.error) return { success: false, error: existingActive.error.message };
    if (existingActive.data?.id) {
      return { success: true, data: { schedule: existingActive.data, existing: true, message: 'This plan already has an unfinished PM task.' } };
    }

    const frequencyDays = Number(plan.frequency_days ?? 90);
    let scheduledDate = (plan.next_due_date as string | null)
      ?? (plan.last_completed_date ? datePlusDays(plan.last_completed_date as string, frequencyDays) : null)
      ?? new Date().toISOString().split('T')[0];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const sameDate = await supabase
        .from('pm_schedules')
        .select('id, status')
        .eq('plan_id', planId)
        .eq('scheduled_date', scheduledDate)
        .limit(1)
        .maybeSingle();
      if (sameDate.error) return { success: false, error: sameDate.error.message };
      if (!sameDate.data?.id) break;
      scheduledDate = datePlusDays(scheduledDate, frequencyDays);
    }

    const result = await supabase
      .from('pm_schedules')
      .insert({
        plan_id: planId,
        asset_id: plan.asset_id,
        scheduled_date: scheduledDate,
        status: 'scheduled',
      } as never)
      .select('*')
      .single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'pm_schedule.generate_next', entityType: 'pm_schedules', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    const scheduleId = (result.data as { id?: string }).id;
    revalidateMany([...pmPaths, `/pm/plans/${planId}/history`, scheduleId ? `/pm/schedules/${scheduleId}` : '/pm', assetId ? `/equipment/${assetId}` : '/equipment']);
    return { success: true, data: { schedule: result.data, existing: false } };
  } catch (err) {
    return actionError(err, 'Failed to generate PM schedule');
  }
}
