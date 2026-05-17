import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilityId, ChatContextRefs, UserChatProfile } from '@/types/chatbot';
import {
  canReadAllOperationalCopilotContext,
  canUseStoreCopilotContext,
  canUseTechnicianCopilotContext,
  requiresDepartmentScope,
} from '../copilot-rbac';

export function isAdmin(profile: UserChatProfile) {
  return canReadAllOperationalCopilotContext(profile);
}

export function usesBroadWorkOrderPool(profile: UserChatProfile, capability: CapabilityId) {
  if (canReadAllOperationalCopilotContext(profile)) return true;
  if (capability === 'prioritize_tasks' && canUseTechnicianCopilotContext(profile)) return true;
  return false;
}

async function scopedAssetIdsForProfile(supabase: SupabaseClient, profile: UserChatProfile) {
  if (!requiresDepartmentScope(profile)) return null;
  if (!profile.departmentId) return [];
  const { data } = await supabase
    .from('equipment_assets')
    .select('id')
    .eq('department_id', profile.departmentId)
    .is('deleted_at', null)
    .limit(5000);
  return (data ?? []).map((row) => row.id as string).filter(Boolean);
}

export async function loadTaskBlocks(
  supabase: SupabaseClient,
  profile: UserChatProfile,
  capability: CapabilityId
) {
  const assignedWorkOrdersQuery = supabase
    .from('work_orders')
    .select('id, work_order_number, status, priority, assigned_to, created_at, asset_id')
    .in('status', ['open', 'assigned', 'in_progress', 'on_hold'])
    .order('created_at', { ascending: false })
    .limit(24);

  const scopedWorkOrdersQuery = usesBroadWorkOrderPool(profile, capability)
    ? assignedWorkOrdersQuery
    : assignedWorkOrdersQuery.eq('assigned_to', profile.profileId);

  let maintenanceApprovalsQuery = supabase
    .from('maintenance_requests')
    .select('id, request_number, status, urgency, created_at, department_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(12);

  if (!isAdmin(profile) && profile.departmentId) {
    maintenanceApprovalsQuery = maintenanceApprovalsQuery.eq('department_id', profile.departmentId);
  }

  let trainingRequestsQuery = supabase
    .from('training_requests')
    .select('id, request_number, status, training_type, created_at, department_id')
    .in('status', ['pending', 'approved', 'scheduled'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (!isAdmin(profile) && profile.departmentId) {
    trainingRequestsQuery = trainingRequestsQuery.eq('department_id', profile.departmentId);
  }

  let overduePmQuery = supabase
    .from('v_overdue_pm')
    .select('id, asset_id, plan_name, asset_code, asset_name, days_overdue, department_id, department_name, criticality_level, scheduled_date, status')
    .order('days_overdue', { ascending: false })
    .limit(12);

  if (requiresDepartmentScope(profile)) {
    overduePmQuery = profile.departmentId
      ? overduePmQuery.eq('department_id', profile.departmentId)
      : overduePmQuery.eq('department_id', '00000000-0000-0000-0000-000000000000');
  }

  const [
    workOrdersRes,
    overduePmRes,
    approvalMaintenanceRes,
    disposalRes,
    procurementRes,
    trainingRes,
    disposalQueueRes,
  ] = await Promise.all([
    scopedWorkOrdersQuery,
    overduePmQuery,
    maintenanceApprovalsQuery,
    supabase
      .from('disposal_requests')
      .select('id, request_number, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('procurement_requests')
      .select('id, request_number, status, priority, created_at')
      .in('status', ['requested', 'approved'])
      .order('created_at', { ascending: false })
      .limit(8),
    trainingRequestsQuery,
    supabase
      .from('disposal_requests')
      .select('id, request_number, status, reason, disposal_method_proposed, created_at, asset_id')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    assignedWorkOrders: (workOrdersRes.data ?? []) as Record<string, unknown>[],
    overduePm: (overduePmRes.data ?? []) as Record<string, unknown>[],
    maintenanceApprovals: (approvalMaintenanceRes.data ?? []) as Record<string, unknown>[],
    disposalApprovals: (disposalRes.data ?? []) as Record<string, unknown>[],
    procurementApprovals: (procurementRes.data ?? []) as Record<string, unknown>[],
    trainingRequests: (trainingRes.data ?? []) as Record<string, unknown>[],
    disposalPipeline: (disposalQueueRes.data ?? []) as Record<string, unknown>[],
  };
}

export async function loadRiskAndAnalytics(supabase: SupabaseClient, contextRefs?: ChatContextRefs, profile?: UserChatProfile) {
  const equipmentId = contextRefs?.equipmentId;
  const scopedAssetIds = profile ? await scopedAssetIdsForProfile(supabase, profile) : null;
  const denyEquipment = Boolean(equipmentId && scopedAssetIds && !scopedAssetIds.includes(equipmentId));
  const applyAssetScope = <T extends { in: (column: string, values: string[]) => T }>(query: T) => {
    if (!scopedAssetIds) return query;
    if (scopedAssetIds.length === 0) return query.in('asset_id', ['00000000-0000-0000-0000-000000000000']);
    return query.in('asset_id', scopedAssetIds);
  };

  if (denyEquipment) {
    return {
      riskScores: [],
      reliabilityMetrics: [],
      replacementPriority: [],
      recommendationFlags: [],
      decisionSupportQueue: [],
    };
  }

  const [riskRes, reliabilityRes, replacementRes, flagsRes, decisionRes] = await Promise.all([
    equipmentId
      ? supabase
          .from('equipment_risk_scores')
          .select('asset_id, rpn, risk_level, assessed_at, equipment_assets(asset_code, name, department_id, departments(name))')
          .eq('asset_id', equipmentId)
          .order('assessed_at', { ascending: false })
          .limit(3)
      : applyAssetScope(supabase
          .from('equipment_risk_scores')
          .select('asset_id, rpn, risk_level, assessed_at, equipment_assets(asset_code, name, department_id, departments(name))')
          .order('assessed_at', { ascending: false })
          .limit(8)),
    equipmentId
      ? supabase
          .from('equipment_reliability_metrics')
          .select('asset_id, mttr_hours, mtbf_hours, availability_ratio, computed_at, equipment_assets(asset_code, name, department_id, departments(name))')
          .eq('asset_id', equipmentId)
          .order('computed_at', { ascending: false })
          .limit(3)
      : applyAssetScope(supabase
          .from('equipment_reliability_metrics')
          .select('asset_id, mttr_hours, mtbf_hours, availability_ratio, computed_at, equipment_assets(asset_code, name, department_id, departments(name))')
          .order('computed_at', { ascending: false })
          .limit(8)),
    equipmentId
      ? supabase
          .from('replacement_priority_scores')
          .select('asset_id, replacement_priority_index, rank, justification, computed_at, equipment_assets(asset_code, name, department_id, departments(name))')
          .eq('asset_id', equipmentId)
          .order('computed_at', { ascending: false })
          .limit(3)
      : applyAssetScope(supabase
          .from('replacement_priority_scores')
          .select('asset_id, replacement_priority_index, rank, justification, computed_at, equipment_assets(asset_code, name, department_id, departments(name))')
          .order('rank', { ascending: true })
          .limit(8)),
    applyAssetScope(supabase
      .from('recommendation_flags')
      .select('id, asset_id, severity, flag_type, message, generated_at, equipment_assets(asset_code, name, department_id, departments(name))')
      .eq('is_acknowledged', false)
      .order('generated_at', { ascending: false })
      .limit(12)),
    applyAssetScope(supabase
      .from('triage_action_queue')
      .select('id, asset_id, priority_score, recommendation, rationale, equipment_assets(asset_code, name, department_id, departments(name))')
      .eq('status', 'open')
      .order('priority_score', { ascending: false })
      .limit(10)),
  ]);

  return {
    riskScores: (riskRes.data ?? []) as Record<string, unknown>[],
    reliabilityMetrics: (reliabilityRes.data ?? []) as Record<string, unknown>[],
    replacementPriority: (replacementRes.data ?? []) as Record<string, unknown>[],
    recommendationFlags: (flagsRes.data ?? []) as Record<string, unknown>[],
    decisionSupportQueue: (decisionRes.data ?? []) as Record<string, unknown>[],
  };
}

export async function loadLogistics(supabase: SupabaseClient, profile?: UserChatProfile) {
  if (profile && !canUseStoreCopilotContext(profile)) {
    return { lowStockParts: [], procurementPipeline: [] };
  }
  const [lowStockRes, procurementRes] = await Promise.all([
    supabase
      .from('v_low_stock_parts')
      .select('id, part_code, name, current_stock, reorder_level, deficit')
      .order('deficit', { ascending: false })
      .limit(10),
    supabase
      .from('procurement_requests')
      .select('id, request_number, title, status, priority, expected_delivery_date')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    lowStockParts: (lowStockRes.data ?? []) as Record<string, unknown>[],
    procurementPipeline: (procurementRes.data ?? []) as Record<string, unknown>[],
  };
}

export async function loadDecisionSupportSnapshot(supabase: SupabaseClient, profile?: UserChatProfile) {
  const [readinessRes, workloadRes] = await Promise.all([
    (() => {
      let query = supabase
      .from('clinical_readiness_snapshots')
      .select('department_id, readiness_score, essential_total, essential_functional, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(15);
      if (profile && requiresDepartmentScope(profile)) {
        query = profile.departmentId ? query.eq('department_id', profile.departmentId) : query.eq('department_id', '00000000-0000-0000-0000-000000000000');
      }
      return query;
    })(),
    supabase
      .from('workload_capacity_snapshots')
      .select('assignee_id, open_assignments, overdue_assignments, estimated_hours, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(20),
  ]);

  return {
    readinessSnapshot: (readinessRes.data ?? []) as Record<string, unknown>[],
    workloadSnapshot: (workloadRes.data ?? []) as Record<string, unknown>[],
  };
}
