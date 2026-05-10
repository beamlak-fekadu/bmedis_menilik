import { createClient } from '@/lib/supabase/client';

export interface ReportFilters {
  department_id?: string;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
}

export async function getEquipmentReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('equipment_assets')
    .select(`
      id, asset_code, serial_number, name, condition, status,
      installation_date, warranty_expiry, purchase_date, purchase_cost, source,
      departments(id, name, code),
      equipment_categories(id, name, code, criticality_level),
      manufacturers(id, name),
      equipment_models(id, name)
    `)
    .is('deleted_at', null);

  if (filters.department_id) query = query.eq('department_id', filters.department_id);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.status) query = query.eq('status', filters.status);

  return query.order('asset_code', { ascending: true });
}

export async function getMaintenanceReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('maintenance_events')
    .select(`
      id, event_type, failure_date, downtime_start, downtime_end,
      repair_duration_hours, action_taken, service_cost, completion_date, notes,
      equipment_assets(id, asset_code, name, departments(id, name)),
      failure_codes(id, code, description),
      maintenance_action_codes(id, code, description)
    `);

  if (filters.date_from) query = query.gte('completion_date', filters.date_from);
  if (filters.date_to) query = query.lte('completion_date', filters.date_to);

  return query.order('completion_date', { ascending: false });
}

export async function getPMReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('pm_schedules')
    .select(`
      id, scheduled_date, status, notes,
      pm_plans(id, name, frequency_days),
      equipment_assets(id, asset_code, name, departments(id, name)),
      assigned_to_profile:profiles!pm_schedules_assigned_to_fkey(id, full_name)
    `);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date_from) query = query.gte('scheduled_date', filters.date_from);
  if (filters.date_to) query = query.lte('scheduled_date', filters.date_to);

  return query.order('scheduled_date', { ascending: false });
}

export async function getCalibrationReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('calibration_records')
    .select(`
      id, calibration_date, next_due_date, result, calibrated_by, notes,
      equipment_assets(id, asset_code, name, departments(id, name)),
      calibration_types(id, name, interval_months)
    `);

  if (filters.date_from) query = query.gte('calibration_date', filters.date_from);
  if (filters.date_to) query = query.lte('calibration_date', filters.date_to);

  return query.order('calibration_date', { ascending: false });
}

export async function getTrainingReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('training_sessions')
    .select(`
      id, title, trainer, training_date, duration_hours, location, description,
      max_participants,
      equipment_assets(id, asset_code, name),
      equipment_categories(id, name),
      staff_training_records(id, staff_name, status, certification_date)
    `);

  if (filters.date_from) query = query.gte('training_date', filters.date_from);
  if (filters.date_to) query = query.lte('training_date', filters.date_to);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);

  return query.order('training_date', { ascending: false });
}

export async function getSparePartsReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('spare_parts')
    .select(`
      id, part_code, name, description, category, unit,
      reorder_level, current_stock, unit_cost, is_active
    `);

  if (filters.category_id) query = query.eq('category', filters.category_id);

  return query.order('name', { ascending: true });
}

export async function getDisposalReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('disposal_requests')
    .select(`
      id, request_number, reason, disposal_method_proposed, status,
      approved_at, notes, created_at,
      equipment_assets(id, asset_code, name, departments(id, name)),
      disposed_assets(id, disposal_date, disposal_method, disposal_value)
    `);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date_from) query = query.gte('created_at', filters.date_from);
  if (filters.date_to) query = query.lte('created_at', filters.date_to);

  return query.order('created_at', { ascending: false });
}

export async function getWorkOrderReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('work_orders')
    .select(`
      id, work_order_number, request_id, status, priority, work_type,
      external_vendor, external_vendor_name, estimated_hours, actual_hours,
      started_at, completed_at, completion_outcome, final_equipment_condition,
      created_at,
      equipment_assets(id, asset_code, name, departments(id, name)),
      profiles(id, full_name)
    `);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date_from) query = query.gte('created_at', filters.date_from);
  if (filters.date_to) query = query.lte('created_at', filters.date_to);

  return query.order('created_at', { ascending: false });
}

export async function getProcurementReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('procurement_requests')
    .select('id, request_number, title, justification, status, priority, expected_delivery_date, created_at, updated_at');

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date_from) query = query.gte('created_at', filters.date_from);
  if (filters.date_to) query = query.lte('created_at', filters.date_to);

  return query.order('created_at', { ascending: false });
}

export async function getReplacementReport() {
  const supabase = createClient();
  return supabase
    .from('replacement_priority_scores')
    .select(`
      id, asset_id, age_score, failure_score, availability_score,
      maintenance_burden_score, spare_part_score, risk_score, cost_score,
      replacement_priority_index, rank, justification, computed_at,
      equipment_assets(id, asset_code, name, departments(id, name))
    `)
    .is('weights_profile_id', null)
    .order('rank', { ascending: true });
}

export async function getRiskFmeaReport() {
  const supabase = createClient();
  return supabase
    .from('equipment_risk_scores')
    .select(`
      id, asset_id, severity, occurrence, detectability, rpn, risk_level,
      explanation, assignment_method, assessed_at, computed_at,
      equipment_assets(id, asset_code, name, departments(id, name))
    `)
    .order('rpn', { ascending: false });
}

export async function getAuditSecurityReport(filters: ReportFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, old_values, new_values, created_at, profiles(full_name, email)');

  if (filters.date_from) query = query.gte('created_at', filters.date_from);
  if (filters.date_to) query = query.lte('created_at', filters.date_to);

  return query.order('created_at', { ascending: false }).limit(1000);
}
