// Domain types matching the Supabase PostgreSQL schema.
// These are the application-level types used throughout the codebase.

// =============================================================================
// Enums
// =============================================================================
export type EquipmentCondition = 'functional' | 'needs_repair' | 'non_functional' | 'under_maintenance' | 'decommissioned';
export type EquipmentStatus = 'active' | 'inactive' | 'disposed' | 'in_storage';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceRequestStatus = 'pending' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'canceled';
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'canceled';
export type WorkType = 'corrective' | 'preventive' | 'inspection' | 'calibration' | 'installation';
export type MaintenanceEventType = 'corrective' | 'preventive' | 'inspection' | 'emergency';
export type PMScheduleStatus = 'scheduled' | 'completed' | 'overdue' | 'skipped' | 'in_progress';
export type CalibrationResult = 'pass' | 'fail' | 'adjusted';
export type CalibrationRequestStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected' | 'canceled';
export type TrainingType = 'equipment_operation' | 'maintenance' | 'safety' | 'calibration' | 'refresher' | 'other';
export type TrainingRequestStatus = 'pending' | 'approved' | 'scheduled' | 'completed' | 'rejected' | 'canceled';
export type TrainingAttendance = 'registered' | 'attended' | 'absent' | 'certified';
export type DisposalMethod = 'auction' | 'donation' | 'recycling' | 'destruction' | 'return_to_vendor' | 'other';
export type DisposalRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'canceled';
export type DocumentType = 'manual' | 'specification' | 'sop' | 'certificate' | 'warranty' | 'service_contract' | 'photo' | 'other';
export type CriticalityLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskDimension = 'severity' | 'occurrence' | 'detectability';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RecommendationFlagType =
  | 'urgent_maintenance' | 'monitor_closely' | 'prioritize_pm' | 'calibrate_soon'
  | 'replacement_candidate' | 'recurring_failure' | 'part_shortage' | 'high_risk'
  | 'low_availability' | 'overdue_pm' | 'warranty_expiring' | 'contract_expiring';
export type RoleName = 'developer' | 'admin' | 'technician' | 'department_user' | 'store_user' | 'viewer';

// =============================================================================
// Reference / Master Data
// =============================================================================
export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCategory {
  id: string;
  name: string;
  code: string;
  description: string | null;
  criticality_level: CriticalityLevel | null;
  created_at: string;
  updated_at: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  country: string | null;
  contact_info: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentModel {
  id: string;
  name: string;
  manufacturer_id: string | null;
  category_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  manufacturer?: Manufacturer;
  category?: EquipmentCategory;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FailureCode {
  id: string;
  code: string;
  description: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceActionCode {
  id: string;
  code: string;
  description: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalibrationType {
  id: string;
  name: string;
  description: string | null;
  interval_months: number;
  created_at: string;
  updated_at: string;
}

export interface PMChecklistItem {
  task: string;
  required: boolean;
  completed?: boolean;
  notes?: string;
}

export interface PMTemplate {
  id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  frequency_days: number;
  checklist_items: PMChecklistItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskScale {
  id: string;
  dimension: RiskDimension;
  level: number;
  label: string;
  description: string | null;
  created_at: string;
}

export interface ScoringWeights {
  id: string;
  profile_name: string;
  description: string | null;
  criteria: Record<string, number>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface StatusLabel {
  id: string;
  entity_type: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

// =============================================================================
// Auth / Users
// =============================================================================
export interface Role {
  id: string;
  name: RoleName;
  description: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
  roles?: Role[];
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// =============================================================================
// Asset / Inventory
// =============================================================================
export interface EquipmentAsset {
  id: string;
  asset_code: string;
  serial_number: string | null;
  name: string;
  model_id: string | null;
  category_id: string;
  department_id: string;
  manufacturer_id: string | null;
  vendor_id: string | null;
  supplier_id: string | null;
  installation_date: string | null;
  warranty_expiry: string | null;
  service_contract_expiry: string | null;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  purchase_date: string | null;
  purchase_cost: number | null;
  source: string | null;
  notes: string | null;
  photo_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  category?: EquipmentCategory;
  manufacturer?: Manufacturer;
  model?: EquipmentModel;
}

export interface EquipmentLocation {
  id: string;
  asset_id: string;
  department_id: string;
  building: string | null;
  floor: string | null;
  room: string | null;
  moved_at: string;
  moved_by: string | null;
  notes: string | null;
}

export interface AssetStatusHistory {
  id: string;
  asset_id: string;
  old_status: string | null;
  new_status: string;
  old_condition: string | null;
  new_condition: string | null;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

export interface EquipmentDocument {
  id: string;
  asset_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface InstallationRecord {
  id: string;
  asset_id: string;
  installed_by: string | null;
  installation_date: string;
  commissioning_date: string | null;
  acceptance_checklist: Record<string, unknown>[];
  go_live_date: string | null;
  initial_training_done: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Maintenance
// =============================================================================
export interface MaintenanceRequest {
  id: string;
  request_number: string;
  asset_id: string;
  requested_by: string | null;
  department_id: string;
  fault_description: string;
  urgency: Urgency;
  status: MaintenanceRequestStatus;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset?: EquipmentAsset;
  department?: Department;
  requester?: Profile;
}

export interface WorkOrder {
  id: string;
  work_order_number: string;
  request_id: string | null;
  asset_id: string;
  assigned_to: string | null;
  status: WorkOrderStatus;
  priority: Urgency;
  work_type: WorkType;
  root_cause: string | null;
  action_taken: string | null;
  external_vendor: boolean;
  external_vendor_name: string | null;
  closure_notes: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  asset?: EquipmentAsset;
  assignee?: Profile;
  request?: MaintenanceRequest;
}

export interface MaintenanceEvent {
  id: string;
  work_order_id: string | null;
  asset_id: string;
  event_type: MaintenanceEventType;
  failure_date: string | null;
  downtime_start: string | null;
  downtime_end: string | null;
  repair_duration_hours: number | null;
  action_taken: string | null;
  failure_code_id: string | null;
  action_code_id: string | null;
  service_cost: number | null;
  completed_by: string | null;
  completion_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  failure_code?: FailureCode;
  action_code?: MaintenanceActionCode;
}

export interface DowntimeLog {
  id: string;
  asset_id: string;
  event_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  reason: string | null;
  created_at: string;
}

export interface MaintenancePartUsed {
  id: string;
  event_id: string;
  spare_part_id: string | null;
  part_name: string;
  quantity_used: number;
  unit_cost: number | null;
  created_at: string;
}

// =============================================================================
// Preventive Maintenance
// =============================================================================
export interface PMPlan {
  id: string;
  asset_id: string;
  template_id: string | null;
  name: string;
  frequency_days: number;
  next_due_date: string | null;
  last_completed_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  asset?: EquipmentAsset;
  template?: PMTemplate;
}

export interface PMSchedule {
  id: string;
  plan_id: string;
  asset_id: string;
  scheduled_date: string;
  status: PMScheduleStatus;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plan?: PMPlan;
  asset?: EquipmentAsset;
  assignee?: Profile;
}

export interface PMChecklist {
  id: string;
  schedule_id: string;
  items: PMChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface PMCompletion {
  id: string;
  schedule_id: string;
  completed_by: string | null;
  completion_date: string;
  duration_hours: number | null;
  notes: string | null;
  checklist_results: PMChecklistItem[];
  created_at: string;
}

// =============================================================================
// Calibration
// =============================================================================
export interface CalibrationRequest {
  id: string;
  request_number: string;
  asset_id: string;
  requested_by: string | null;
  calibration_type_id: string | null;
  urgency: Urgency;
  status: CalibrationRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalibrationRecord {
  id: string;
  asset_id: string;
  calibration_type_id: string | null;
  calibrated_by: string | null;
  calibration_date: string;
  next_due_date: string | null;
  result: CalibrationResult;
  certificate_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalibrationCertificate {
  id: string;
  record_id: string;
  file_path: string;
  issued_by: string | null;
  issue_date: string | null;
  created_at: string;
}

// =============================================================================
// Spare Parts / Logistics
// =============================================================================
export interface SparePart {
  id: string;
  part_code: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  reorder_level: number;
  current_stock: number;
  unit_cost: number | null;
  compatible_categories: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockReceipt {
  id: string;
  part_id: string;
  quantity: number;
  received_by: string | null;
  received_date: string;
  supplier_id: string | null;
  invoice_ref: string | null;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface StockIssue {
  id: string;
  part_id: string;
  quantity: number;
  issued_to_event_id: string | null;
  issued_by: string | null;
  issue_date: string;
  department_id: string | null;
  notes: string | null;
  created_at: string;
}

// =============================================================================
// Training
// =============================================================================
export interface TrainingRequest {
  id: string;
  request_number: string;
  asset_id: string | null;
  requested_by: string | null;
  department_id: string | null;
  training_type: TrainingType;
  description: string | null;
  status: TrainingRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  asset_id: string | null;
  category_id: string | null;
  trainer: string;
  training_date: string;
  duration_hours: number | null;
  location: string | null;
  description: string | null;
  max_participants: number | null;
  created_at: string;
  updated_at: string;
}

export interface StaffTrainingRecord {
  id: string;
  session_id: string;
  staff_user_id: string | null;
  staff_name: string;
  status: TrainingAttendance;
  certification_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface EquipmentTrainingRecord {
  id: string;
  asset_id: string;
  session_id: string;
  topics_covered: string | null;
  notes: string | null;
  created_at: string;
}

// =============================================================================
// Disposal
// =============================================================================
export interface DisposalRequest {
  id: string;
  request_number: string;
  asset_id: string;
  requested_by: string | null;
  reason: string;
  disposal_method_proposed: DisposalMethod | null;
  status: DisposalRequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisposedAsset {
  id: string;
  asset_id: string;
  disposal_request_id: string | null;
  disposal_date: string;
  disposal_method: string;
  disposal_value: number | null;
  disposed_by: string | null;
  notes: string | null;
  created_at: string;
}

// =============================================================================
// Analytics / Computed
// =============================================================================
export interface EquipmentReliabilityMetrics {
  id: string;
  asset_id: string;
  period_start: string;
  period_end: string;
  mttr_hours: number | null;
  mtbf_hours: number | null;
  availability_ratio: number | null;
  total_downtime_hours: number | null;
  total_operational_hours: number | null;
  failure_count: number;
  repair_count: number;
  computed_at: string;
  asset?: EquipmentAsset;
}

export interface EquipmentRiskScore {
  id: string;
  asset_id: string;
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  risk_level: RiskLevel;
  assessed_by: string | null;
  assessed_at: string;
  notes: string | null;
  asset?: EquipmentAsset;
}

export interface PMComplianceMetrics {
  id: string;
  department_id: string | null;
  category_id: string | null;
  asset_id: string | null;
  period_start: string;
  period_end: string;
  scheduled_count: number;
  completed_count: number;
  pmc_percentage: number;
  computed_at: string;
}

export interface EquipmentPerformanceScore {
  id: string;
  asset_id: string;
  period_start: string;
  period_end: string;
  normalized_availability: number | null;
  normalized_mttr: number | null;
  normalized_downtime: number | null;
  normalized_pmc: number | null;
  normalized_failure_rate: number | null;
  composite_score: number | null;
  weights_profile_id: string | null;
  computed_at: string;
  asset?: EquipmentAsset;
}

export interface ReplacementPriorityScore {
  id: string;
  asset_id: string;
  period_start: string;
  period_end: string;
  age_score: number | null;
  failure_score: number | null;
  availability_score: number | null;
  maintenance_burden_score: number | null;
  spare_part_score: number | null;
  risk_score: number | null;
  cost_score: number | null;
  replacement_priority_index: number | null;
  rank: number | null;
  justification: string | null;
  weights_profile_id: string | null;
  computed_at: string;
  asset?: EquipmentAsset;
}

export interface RecommendationFlag {
  id: string;
  asset_id: string;
  flag_type: RecommendationFlagType;
  severity: Urgency;
  message: string;
  details: Record<string, unknown>;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  generated_at: string;
  expires_at: string | null;
  asset?: EquipmentAsset;
}

// =============================================================================
// Dashboard / View types
// =============================================================================
export interface DashboardStats {
  total_equipment: number;
  functional_count: number;
  non_functional_count: number;
  open_work_orders: number;
  overdue_pm: number;
  calibration_due_soon: number;
  low_stock_parts: number;
  pending_disposals: number;
  active_critical_alerts: number;
}

export interface EquipmentSummary {
  id: string;
  asset_code: string;
  name: string;
  serial_number: string | null;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  installation_date: string | null;
  warranty_expiry: string | null;
  purchase_cost: number | null;
  department_name: string;
  department_code: string;
  category_name: string;
  criticality_level: CriticalityLevel | null;
  manufacturer_name: string | null;
  model_name: string | null;
  age_years: number | null;
}
