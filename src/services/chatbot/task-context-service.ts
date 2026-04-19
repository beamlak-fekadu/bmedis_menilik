import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilityId, ChatContextRefs, ChatEvidence, TaskContextBundle, UserChatProfile } from '@/types/chatbot';
import { buildChatEvidence } from './context-service';

interface TaskContextParams {
  supabase: SupabaseClient;
  capability: CapabilityId;
  profile: UserChatProfile;
  contextRefs?: ChatContextRefs;
}

function isAdmin(profile: UserChatProfile) {
  return profile.roleNames.includes('admin');
}

async function loadTaskBlocks(supabase: SupabaseClient, profile: UserChatProfile) {
  const assignedWorkOrdersQuery = supabase
    .from('work_orders')
    .select('id, work_order_number, status, priority, assigned_to, created_at, asset_id')
    .in('status', ['open', 'assigned', 'in_progress', 'on_hold'])
    .order('created_at', { ascending: false })
    .limit(20);

  const scopedWorkOrdersQuery = isAdmin(profile)
    ? assignedWorkOrdersQuery
    : assignedWorkOrdersQuery.or(`assigned_to.eq.${profile.profileId},status.in.(open,assigned,in_progress,on_hold)`);

  let maintenanceApprovalsQuery = supabase
    .from('maintenance_requests')
    .select('id, request_number, status, urgency, created_at, department_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(12);

  if (!isAdmin(profile) && profile.departmentId) {
    maintenanceApprovalsQuery = maintenanceApprovalsQuery.eq('department_id', profile.departmentId);
  }

  const [workOrdersRes, overduePmRes, approvalMaintenanceRes, disposalRes, procurementRes] = await Promise.all([
    scopedWorkOrdersQuery,
    supabase
      .from('v_overdue_pm')
      .select('id, plan_name, asset_code, asset_name, days_overdue, department_name')
      .order('days_overdue', { ascending: false })
      .limit(12),
    maintenanceApprovalsQuery,
    supabase
      .from('disposal_requests')
      .select('id, request_number, status, created_at')
      .eq('status', 'submitted')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('procurement_requests')
      .select('id, request_number, status, priority, created_at')
      .in('status', ['requested', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return {
    assignedWorkOrders: (workOrdersRes.data ?? []) as Record<string, unknown>[],
    overduePm: (overduePmRes.data ?? []) as Record<string, unknown>[],
    maintenanceApprovals: (approvalMaintenanceRes.data ?? []) as Record<string, unknown>[],
    disposalApprovals: (disposalRes.data ?? []) as Record<string, unknown>[],
    procurementApprovals: (procurementRes.data ?? []) as Record<string, unknown>[],
  };
}

function buildPriorityReasoning(
  blocks: {
    assignedWorkOrders: Record<string, unknown>[];
    overduePm: Record<string, unknown>[];
    recommendationFlags: Record<string, unknown>[];
    decisionSupportQueue: Record<string, unknown>[];
  }
) {
  const reasons: string[] = [];
  const highPriorityOrders = blocks.assignedWorkOrders.filter((item) => ['high', 'critical'].includes(String(item.priority ?? '')));
  if (highPriorityOrders.length > 0) reasons.push(`${highPriorityOrders.length} high-priority work orders need action.`);
  const overdueHeavy = blocks.overduePm.filter((item) => Number(item.days_overdue ?? 0) >= 7);
  if (overdueHeavy.length > 0) reasons.push(`${overdueHeavy.length} PM tasks are overdue by at least one week.`);
  const criticalFlags = blocks.recommendationFlags.filter((item) => ['high', 'critical'].includes(String(item.severity ?? '')));
  if (criticalFlags.length > 0) reasons.push(`${criticalFlags.length} high-severity recommendation flags are still open.`);
  if (blocks.decisionSupportQueue.length > 0) reasons.push('Decision-support queue indicates triage pressure on key assets.');
  return reasons;
}

async function loadRiskAndAnalytics(supabase: SupabaseClient, contextRefs?: ChatContextRefs) {
  const equipmentId = contextRefs?.equipmentId;
  const [riskRes, reliabilityRes, replacementRes, flagsRes, decisionRes] = await Promise.all([
    equipmentId
      ? supabase
          .from('equipment_risk_scores')
          .select('asset_id, rpn, risk_level, assessed_at')
          .eq('asset_id', equipmentId)
          .order('assessed_at', { ascending: false })
          .limit(3)
      : supabase
          .from('equipment_risk_scores')
          .select('asset_id, rpn, risk_level, assessed_at')
          .order('assessed_at', { ascending: false })
          .limit(8),
    equipmentId
      ? supabase
          .from('equipment_reliability_metrics')
          .select('asset_id, mttr_hours, mtbf_hours, availability_ratio, computed_at')
          .eq('asset_id', equipmentId)
          .order('computed_at', { ascending: false })
          .limit(3)
      : supabase
          .from('equipment_reliability_metrics')
          .select('asset_id, mttr_hours, mtbf_hours, availability_ratio, computed_at')
          .order('computed_at', { ascending: false })
          .limit(8),
    equipmentId
      ? supabase
          .from('replacement_priority_scores')
          .select('asset_id, replacement_priority_index, rank, justification, computed_at')
          .eq('asset_id', equipmentId)
          .order('computed_at', { ascending: false })
          .limit(3)
      : supabase
          .from('replacement_priority_scores')
          .select('asset_id, replacement_priority_index, rank, justification, computed_at')
          .order('rank', { ascending: true })
          .limit(8),
    supabase
      .from('recommendation_flags')
      .select('id, asset_id, severity, flag_type, message, generated_at')
      .eq('is_acknowledged', false)
      .order('generated_at', { ascending: false })
      .limit(10),
    supabase
      .from('triage_action_queue')
      .select('id, asset_id, priority_score, recommendation, rationale')
      .eq('status', 'open')
      .order('priority_score', { ascending: false })
      .limit(10),
  ]);

  return {
    riskScores: (riskRes.data ?? []) as Record<string, unknown>[],
    reliabilityMetrics: (reliabilityRes.data ?? []) as Record<string, unknown>[],
    replacementPriority: (replacementRes.data ?? []) as Record<string, unknown>[],
    recommendationFlags: (flagsRes.data ?? []) as Record<string, unknown>[],
    decisionSupportQueue: (decisionRes.data ?? []) as Record<string, unknown>[],
  };
}

async function loadLogistics(supabase: SupabaseClient) {
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

async function loadDecisionSupportSnapshot(supabase: SupabaseClient) {
  const [readinessRes, workloadRes] = await Promise.all([
    supabase
      .from('clinical_readiness_snapshots')
      .select('department_id, readiness_score, essential_total, essential_functional, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(15),
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

function selectCapabilityBlocks(
  capability: CapabilityId,
  shared: Record<string, unknown>,
  riskAnalytics: Record<string, unknown>,
  logistics: Record<string, unknown>,
  decisionSupport: Record<string, unknown>
) {
  switch (capability) {
    case 'my_tasks':
    case 'prioritize_tasks':
      return {
        ...shared,
        ...riskAnalytics,
        ...decisionSupport,
        priorityReasoning: buildPriorityReasoning({
          assignedWorkOrders: (shared.assignedWorkOrders as Record<string, unknown>[]) ?? [],
          overduePm: (shared.overduePm as Record<string, unknown>[]) ?? [],
          recommendationFlags: (riskAnalytics.recommendationFlags as Record<string, unknown>[]) ?? [],
          decisionSupportQueue: (riskAnalytics.decisionSupportQueue as Record<string, unknown>[]) ?? [],
        }),
      };
    case 'summarize_work_order':
    case 'maintenance_guidance':
    case 'summarize_equipment':
    case 'maintenance_tips':
      return { ...shared };
    case 'explain_replacement_priority':
      return {
        replacementPriority: riskAnalytics.replacementPriority,
        recommendationFlags: riskAnalytics.recommendationFlags,
        reliabilityMetrics: riskAnalytics.reliabilityMetrics,
      };
    case 'explain_equipment_risk':
    case 'decision_support_analysis':
    case 'alerts_and_escalations':
      return { ...riskAnalytics, ...shared, ...decisionSupport };
    case 'explain_pm_status':
      return { overduePm: shared.overduePm, pmSignals: riskAnalytics.reliabilityMetrics };
    case 'logistics_status':
    case 'procurement_status':
      return { ...shared, ...logistics };
    case 'pending_approvals':
    case 'approval_tasks':
      return { ...shared, ...logistics };
    default:
      return { ...shared, ...riskAnalytics, ...logistics, ...decisionSupport };
  }
}

export async function buildTaskContext(params: TaskContextParams): Promise<TaskContextBundle> {
  const { supabase, capability, profile, contextRefs } = params;

  const intentForEvidence =
    capability === 'logistics_status'
      ? 'calibration_or_logistics'
      : capability === 'procurement_status'
        ? 'calibration_or_logistics'
      : capability === 'safe_troubleshooting'
        ? 'troubleshooting'
      : capability === 'decision_support_analysis' || capability === 'explain_equipment_risk' || capability === 'alerts_and_escalations' || capability === 'explain_replacement_priority'
          ? 'analytics_explanation'
          : capability === 'summarize_work_order'
            ? 'work_order_help'
          : capability === 'summarize_equipment'
            ? 'equipment_lookup'
            : 'maintenance_tip';

  const evidence: ChatEvidence = await buildChatEvidence(supabase, contextRefs, profile, intentForEvidence);
  const [shared, riskAnalytics, logistics, decisionSupport] = await Promise.all([
    loadTaskBlocks(supabase, profile),
    loadRiskAndAnalytics(supabase, contextRefs),
    loadLogistics(supabase),
    loadDecisionSupportSnapshot(supabase),
  ]);

  return {
    capability,
    evidence,
    blocks: selectCapabilityBlocks(capability, shared, riskAnalytics, logistics, decisionSupport),
  };
}
