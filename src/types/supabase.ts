// Supabase schema types for the public schema.
// This mirrors the generated Supabase type shape while reusing the app's
// domain types from database.ts as row contracts.

import type {
  AssetStatusHistory,
  AuditLog,
  CalibrationCertificate,
  CalibrationRecord,
  CalibrationRequest,
  CalibrationType,
  Department,
  DisposedAsset,
  DisposalRequest,
  DowntimeLog,
  EquipmentAsset,
  EquipmentCategory,
  EquipmentDocument,
  EquipmentLocation,
  EquipmentModel,
  EquipmentPerformanceScore,
  EquipmentReliabilityMetrics,
  EquipmentRiskScore,
  EquipmentSummary,
  FailureCode,
  InstallationRecord,
  MaintenanceActionCode,
  MaintenanceEvent,
  MaintenancePartUsed,
  MaintenanceRequest,
  Manufacturer,
  PMChecklist,
  PMComplianceMetrics,
  PMCompletion,
  PMPlan,
  PMSchedule,
  PMTemplate,
  Profile,
  RecommendationFlag,
  ReplacementPriorityScore,
  RiskScale,
  Role,
  ScoringWeights,
  SparePart,
  StaffTrainingRecord,
  StatusLabel,
  StockIssue,
  StockReceipt,
  Supplier,
  TrainingRequest,
  TrainingSession,
  UserRole,
  Vendor,
  WorkOrder,
} from './database';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

type View<Row> = {
  Row: Row;
  Relationships: never[];
};

type FunctionDef<Args extends Record<string, unknown>, Returns> = {
  Args: Args;
  Returns: Returns;
};

export type ProcurementStatus = 'requested' | 'approved' | 'ordered' | 'in_transit' | 'delivered' | 'canceled';
export type TriageStatus = 'open' | 'scheduled' | 'in_progress' | 'completed' | 'dismissed';
export type EscalationStatus = 'open' | 'forwarded' | 'acknowledged' | 'resolved' | 'closed';
export type ChatRole = 'user' | 'assistant';
export type ChatDecision = 'answer' | 'limited_answer' | 'check_manual' | 'escalate' | 'refuse';
export type ChatAnswerBasis = 'system_data' | 'manual_or_sop' | 'general_safe_guidance' | 'insufficient_data';
export type ChatConfidence = 'high' | 'medium' | 'low';

type MemisLookupValue = {
  id: string;
  lookup_group: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProcurementRequest = {
  id: string;
  request_number: string;
  title: string;
  justification: string;
  status: ProcurementStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requested_by: string | null;
  department_id: string | null;
  expected_delivery_date: string | null;
  created_at: string;
  updated_at: string;
};

type EquipmentHealthSnapshot = {
  id: string;
  asset_id: string;
  health_score: number;
  reliability_component: number | null;
  pm_component: number | null;
  risk_component: number | null;
  status_component: number | null;
  explanation: Json;
  snapshot_date: string;
  created_at: string;
};

type ClinicalReadinessSnapshot = {
  id: string;
  department_id: string;
  readiness_score: number;
  essential_total: number;
  essential_functional: number;
  details: Json;
  snapshot_date: string;
  created_at: string;
};

type TriageActionQueue = {
  id: string;
  asset_id: string;
  priority_score: number;
  recommendation: string;
  rationale: Json;
  status: TriageStatus;
  generated_at: string;
  due_by: string | null;
  assigned_to: string | null;
};

type RepeatRepairFlag = {
  id: string;
  asset_id: string;
  failure_count_window: number;
  window_days: number;
  recommendation: string;
  created_at: string;
  is_resolved: boolean;
};

type EscalationRule = {
  id: string;
  rule_name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Json;
  escalate_to_role: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
};

type EscalationEvent = {
  id: string;
  rule_id: string | null;
  asset_id: string | null;
  work_order_id: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  status: EscalationStatus;
  forwarded_to: string | null;
  created_at: string;
  resolved_at: string | null;
};

type WorkloadCapacitySnapshot = {
  id: string;
  assignee_id: string | null;
  snapshot_date: string;
  open_assignments: number;
  overdue_assignments: number;
  estimated_hours: number;
  capacity_hours: number;
  backlog_delta: number;
};

type InspectionTemplate = {
  id: string;
  template_name: string;
  template_type: 'inspection' | 'calibration' | 'maintenance';
  grading_scale: Json;
  checklist_items: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OfflineSyncEvent = {
  id: string;
  client_action_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action_type: string;
  payload: Json;
  sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
  synced_at: string | null;
};

type ChatSession = {
  id: string;
  user_id: string;
  title: string;
  equipment_id: string | null;
  work_order_id: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
};

type ChatMessage = {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  intent: string | null;
  decision: ChatDecision | null;
  answer_basis: ChatAnswerBasis | null;
  confidence: ChatConfidence | null;
  metadata: Json | null;
  created_at: string;
};

type ChatSessionMemory = {
  session_id: string;
  summary_text: string;
  focus: string;
  last_entities: Json;
  updated_at: string;
};

type ChatTelemetryEvent = {
  id: string;
  session_id: string;
  query: string;
  intent: string;
  capability: string;
  confidence_score: number;
  confidence_label: ChatConfidence;
  decision: ChatDecision;
  blocked: boolean;
  fallback_reason: string | null;
  role_names: Json;
  module_label: string | null;
  evidence_signals: Json;
  metadata: Json | null;
  created_at: string;
};

type ChatEvaluationRun = {
  id: string;
  created_by: string;
  title: string;
  notes: string | null;
  created_at: string;
};

type ChatEvaluationResult = {
  id: string;
  run_id: string;
  prompt_id: string;
  prompt: string;
  expected_capability: string;
  actual_capability: string | null;
  capability_match: boolean;
  confidence_score: number | null;
  fallback_used: boolean;
  over_refusal: boolean;
  notes: string | null;
  metadata: Json | null;
  created_at: string;
};

type DecisionSupportRefreshLog = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error';
  error_message: string | null;
  triggered_by: string | null;
  scope: 'asset' | 'all';
  asset_id: string | null;
};

export interface Database {
  public: {
    Tables: {
      departments: Table<Department>;
      equipment_categories: Table<EquipmentCategory>;
      manufacturers: Table<Manufacturer>;
      equipment_models: Table<EquipmentModel>;
      vendors: Table<Vendor>;
      suppliers: Table<Supplier>;
      failure_codes: Table<FailureCode>;
      maintenance_action_codes: Table<MaintenanceActionCode>;
      calibration_types: Table<CalibrationType>;
      pm_templates: Table<PMTemplate>;
      risk_scales: Table<RiskScale>;
      scoring_weights: Table<ScoringWeights>;
      status_labels: Table<StatusLabel>;
      roles: Table<Role>;
      profiles: Table<Profile>;
      user_roles: Table<UserRole>;
      audit_logs: Table<AuditLog>;
      equipment_assets: Table<EquipmentAsset>;
      equipment_locations: Table<EquipmentLocation>;
      asset_status_history: Table<AssetStatusHistory>;
      equipment_documents: Table<EquipmentDocument>;
      installation_records: Table<InstallationRecord>;
      maintenance_requests: Table<MaintenanceRequest>;
      work_orders: Table<WorkOrder>;
      maintenance_events: Table<MaintenanceEvent>;
      downtime_logs: Table<DowntimeLog>;
      maintenance_parts_used: Table<MaintenancePartUsed>;
      pm_plans: Table<PMPlan>;
      pm_schedules: Table<PMSchedule>;
      pm_checklists: Table<PMChecklist>;
      pm_completions: Table<PMCompletion>;
      calibration_requests: Table<CalibrationRequest>;
      calibration_records: Table<CalibrationRecord>;
      calibration_certificates: Table<CalibrationCertificate>;
      spare_parts: Table<SparePart>;
      stock_receipts: Table<StockReceipt>;
      stock_issues: Table<StockIssue>;
      training_requests: Table<TrainingRequest>;
      training_sessions: Table<TrainingSession>;
      staff_training_records: Table<StaffTrainingRecord>;
      disposal_requests: Table<DisposalRequest>;
      disposed_assets: Table<DisposedAsset>;
      equipment_reliability_metrics: Table<EquipmentReliabilityMetrics>;
      equipment_risk_scores: Table<EquipmentRiskScore>;
      pm_compliance_metrics: Table<PMComplianceMetrics>;
      equipment_performance_scores: Table<EquipmentPerformanceScore>;
      replacement_priority_scores: Table<ReplacementPriorityScore>;
      recommendation_flags: Table<RecommendationFlag>;
      memis_lookup_values: Table<MemisLookupValue>;
      procurement_requests: Table<ProcurementRequest>;
      equipment_health_snapshots: Table<EquipmentHealthSnapshot>;
      clinical_readiness_snapshots: Table<ClinicalReadinessSnapshot>;
      triage_action_queue: Table<TriageActionQueue>;
      repeat_repair_flags: Table<RepeatRepairFlag>;
      escalation_rules: Table<EscalationRule>;
      escalation_events: Table<EscalationEvent>;
      workload_capacity_snapshots: Table<WorkloadCapacitySnapshot>;
      inspection_templates: Table<InspectionTemplate>;
      offline_sync_events: Table<OfflineSyncEvent>;
      chat_sessions: Table<ChatSession>;
      chat_messages: Table<ChatMessage>;
      chat_session_memory: Table<ChatSessionMemory>;
      chat_telemetry_events: Table<ChatTelemetryEvent>;
      chat_evaluation_runs: Table<ChatEvaluationRun>;
      chat_evaluation_results: Table<ChatEvaluationResult>;
      decision_support_refresh_log: Table<DecisionSupportRefreshLog>;
    };
    Views: {
      v_equipment_summary: View<EquipmentSummary>;
      v_open_work_orders: View<Record<string, unknown>>;
      v_overdue_pm: View<Record<string, unknown>>;
      v_calibration_due: View<Record<string, unknown>>;
      v_low_stock_parts: View<Record<string, unknown>>;
      v_dashboard_stats: View<Record<string, unknown>>;
      v_command_center_triage: View<Record<string, unknown>>;
      v_asset_health_summary: View<Record<string, unknown>>;
      v_department_readiness: View<Record<string, unknown>>;
      v_replacement_decision: View<Record<string, unknown>>;
      v_maintenance_risk_context: View<Record<string, unknown>>;
    };
    Functions: {
      update_updated_at_column: FunctionDef<Record<string, never>, unknown>;
      auth_user_has_role: FunctionDef<{ required_role: string }, boolean>;
      fn_compute_mttr: FunctionDef<{ p_asset_id: string; p_start_date: string; p_end_date: string }, number | null>;
      fn_compute_mtbf: FunctionDef<{ p_asset_id: string; p_start_date: string; p_end_date: string }, number | null>;
      fn_compute_availability: FunctionDef<{ p_asset_id: string; p_start_date: string; p_end_date: string }, number | null>;
      fn_compute_pmc: FunctionDef<{ p_department_id?: string | null; p_start_date: string; p_end_date: string }, number | null>;
      refresh_decision_support_snapshots: FunctionDef<{ snapshot_dt?: string }, undefined>;
      recompute_equipment_analytics: FunctionDef<{ p_asset_id: string }, undefined>;
      recompute_all_equipment_analytics: FunctionDef<Record<string, never>, undefined>;
      set_chat_sessions_updated_at: FunctionDef<Record<string, never>, unknown>;
      touch_chat_session_last_message: FunctionDef<Record<string, never>, unknown>;
    };
    Enums: {
      procurement_status: ProcurementStatus;
      triage_status: TriageStatus;
      escalation_status: EscalationStatus;
      chat_role: ChatRole;
      chat_decision: ChatDecision;
      chat_answer_basis: ChatAnswerBasis;
      chat_confidence: ChatConfidence;
    };
  };
}
