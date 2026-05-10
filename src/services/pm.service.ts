import { createClient } from '@/lib/supabase/client';
import type { PMPlan, PMCompletion, PMScheduleStatus } from '@/types/domain';
import { recomputeAssetAnalytics } from '@/actions/analytics.actions';
import { logAuditEvent } from './audit.service';

export interface PMPlanFilters {
  asset_id?: string;
  is_active?: boolean;
}

export interface PMScheduleFilters {
  status?: PMScheduleStatus;
  date_from?: string;
  date_to?: string;
  asset_id?: string;
  plan_id?: string;
}

const PM_PLAN_SELECT = `
  id, asset_id, template_id, name, frequency_days, next_due_date,
  last_completed_date, is_active, created_by, created_at, updated_at,
  equipment_assets(id, asset_code, name, condition, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
  pm_templates(id, name, frequency_days, checklist_items)
`;

const PM_SCHEDULE_SELECT = `
  id, plan_id, asset_id, scheduled_date, status, assigned_to, notes,
  result, completion_checklist, completion_notes, final_equipment_condition,
  corrective_action_needed, skipped_reason, deferred_until, deferred_reason,
  completed_by, completed_at, started_at, created_at, updated_at,
  pm_plans(id, name, frequency_days, next_due_date, last_completed_date, is_active, pm_templates(id, name, checklist_items)),
  equipment_assets(id, asset_code, name, condition, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
  assigned_to_profile:profiles!pm_schedules_assigned_to_fkey(id, full_name, email),
  completed_by_profile:profiles!pm_schedules_completed_by_fkey(id, full_name, email),
  pm_completions(
    id, completed_by, completion_date, duration_hours, notes, checklist_results, created_at,
    completed_by_profile:profiles!pm_completions_completed_by_fkey(id, full_name, email)
  )
`;

export async function getPMPlans(filters: PMPlanFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('pm_plans')
    .select(PM_PLAN_SELECT);

  if (filters.asset_id) query = query.eq('asset_id', filters.asset_id);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

  return query.order('next_due_date', { ascending: true });
}

export async function getPMPlanById(id: string) {
  const supabase = createClient();
  return supabase
    .from('pm_plans')
    .select(PM_PLAN_SELECT)
    .eq('id', id)
    .single();
}

export async function createPMPlan(data: Omit<PMPlan, 'id' | 'created_at' | 'updated_at' | 'asset' | 'template'>) {
  const supabase = createClient();
  return supabase
    .from('pm_plans')
    .insert(data)
    .select(PM_PLAN_SELECT)
    .single();
}

export async function getPMSchedules(filters: PMScheduleFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('pm_schedules')
    .select(PM_SCHEDULE_SELECT);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.asset_id) query = query.eq('asset_id', filters.asset_id);
  if (filters.plan_id) query = query.eq('plan_id', filters.plan_id);
  if (filters.date_from) query = query.gte('scheduled_date', filters.date_from);
  if (filters.date_to) query = query.lte('scheduled_date', filters.date_to);

  return query.order('scheduled_date', { ascending: true });
}

export async function getPMScheduleById(id: string) {
  const supabase = createClient();
  return supabase
    .from('pm_schedules')
    .select(PM_SCHEDULE_SELECT)
    .eq('id', id)
    .single();
}

export async function getPMScheduleHistory(filters: { asset_id?: string; plan_id?: string } = {}) {
  const supabase = createClient();
  let query = supabase
    .from('pm_schedules')
    .select(PM_SCHEDULE_SELECT);

  if (filters.asset_id) query = query.eq('asset_id', filters.asset_id);
  if (filters.plan_id) query = query.eq('plan_id', filters.plan_id);

  return query.order('scheduled_date', { ascending: false }).limit(20);
}

export async function updateScheduleStatus(id: string, status: PMScheduleStatus) {
  const supabase = createClient();
  const oldRow = await supabase.from('pm_schedules').select(PM_SCHEDULE_SELECT).eq('id', id).single();
  const result = await supabase
    .from('pm_schedules')
    .update({ status })
    .eq('id', id)
    .select(PM_SCHEDULE_SELECT)
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'pm_schedule.status_update',
      entityType: 'pm_schedules',
      entityId: id,
      oldValues: (oldRow.data as Record<string, unknown> | null) ?? null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  if (!result.error && status === 'completed') {
    const assetId = (result.data as Record<string, unknown> | null)?.asset_id as string | undefined;
    if (assetId) {
      await recomputeAssetAnalytics(assetId).catch(() => {});
    }
  }

  return result;
}

export async function createPMCompletion(data: Omit<PMCompletion, 'id' | 'created_at'>) {
  const supabase = createClient();
  const result = await supabase
    .from('pm_completions')
    .insert(data)
    .select('id, schedule_id, completed_by, completion_date, duration_hours, notes, checklist_results, created_at')
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'pm_completion.create',
      entityType: 'pm_completions',
      entityId: (result.data as Record<string, unknown> | null)?.id as string | null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}

export async function getOverduePMSchedules() {
  const supabase = createClient();
  return supabase
    .from('v_overdue_pm')
    .select('id, asset_id, scheduled_date, status, plan_name, asset_code, asset_name, department_name, category_name, criticality_level, assigned_to_name, days_overdue')
    .order('scheduled_date', { ascending: true });
}
