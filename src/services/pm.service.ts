import { createClient } from '@/lib/supabase/client';
import type { PMPlan, PMCompletion, PMScheduleStatus } from '@/types/database';
import { recomputeAssetAnalytics } from '@/actions/analytics.actions';

export interface PMPlanFilters {
  asset_id?: string;
  is_active?: boolean;
}

export interface PMScheduleFilters {
  status?: PMScheduleStatus;
  date_from?: string;
  date_to?: string;
  asset_id?: string;
}

const PM_PLAN_SELECT = `
  id, asset_id, template_id, name, frequency_days, next_due_date,
  last_completed_date, is_active, created_by, created_at, updated_at,
  equipment_assets(id, asset_code, name),
  pm_templates(id, name, frequency_days, checklist_items)
`;

const PM_SCHEDULE_SELECT = `
  id, plan_id, asset_id, scheduled_date, status, assigned_to, notes,
  created_at, updated_at,
  pm_plans(id, name, frequency_days),
  equipment_assets(id, asset_code, name),
  profiles(id, full_name, email)
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
  if (filters.date_from) query = query.gte('scheduled_date', filters.date_from);
  if (filters.date_to) query = query.lte('scheduled_date', filters.date_to);

  return query.order('scheduled_date', { ascending: true });
}

export async function updateScheduleStatus(id: string, status: PMScheduleStatus) {
  const supabase = createClient();
  const result = await supabase
    .from('pm_schedules')
    .update({ status })
    .eq('id', id)
    .select(PM_SCHEDULE_SELECT)
    .single();

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
  return supabase
    .from('pm_completions')
    .insert(data)
    .select('id, schedule_id, completed_by, completion_date, duration_hours, notes, checklist_results, created_at')
    .single();
}

export async function getOverduePMSchedules() {
  const supabase = createClient();
  return supabase
    .from('v_overdue_pm')
    .select('id, scheduled_date, status, plan_name, asset_code, asset_name, department_name, category_name, assigned_to_name, days_overdue')
    .order('scheduled_date', { ascending: true });
}
