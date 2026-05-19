export type ScoreDataMode = 'Live' | 'Snapshot' | 'Sandbox' | 'Mixed' | 'Not Implemented';
export type ScoreRefreshMode = 'Live view' | 'Triggered snapshot' | 'Manual refresh' | 'Simulation only' | 'Not implemented';
export type ScoreFreshness = 'Fresh' | 'Stale' | 'Very stale' | 'Missing' | 'No snapshot needed' | 'Simulation only' | 'Missing refresh' | 'Unknown';
export type OperationalImplementation = 'yes' | 'partial' | 'no';

export const SNAPSHOT_FRESH_HOURS = 24;
export const SNAPSHOT_VERY_STALE_HOURS = 72;

export interface ScoreWeight {
  key: string;
  label: string;
  defaultWeight: number;
  sourceField?: string;
  explanation: string;
}

export interface ScoreCriterion {
  label: string;
  source: string;
  explanation: string;
}

export interface ScoreRegistryEntry {
  key: string;
  displayName: string;
  category: string;
  dataMode: ScoreDataMode;
  sourceOfTruth: string;
  sourceTables: string[];
  sourceViews?: string[];
  sourceFunctions?: string[];
  refreshMode: ScoreRefreshMode;
  operationalConsumers: string[];
  affectsLiveDecisions: 'Yes' | 'No' | 'Developer-only' | 'N/A';
  sandboxChangesAffectLive: 'No' | 'Yes' | 'N/A';
  isWeightedComposite: boolean;
  operationalImplementation: OperationalImplementation;
  sensitivitySupported: boolean;
  sandboxOnly: boolean;
  weights?: ScoreWeight[];
  criteria: ScoreCriterion[];
  formulaSummary: string;
  notWeightAdjustableReason?: string;
  limitations: string;
  snapshotTimestampSources?: string[];
  refreshImplementation?: {
    rpc?: string;
    table?: string;
    timestampColumn?: string;
    notes: string;
  };
  sandboxMessage: string;
}

export function evaluateSnapshotFreshness(
  dataMode: ScoreDataMode,
  refreshMode: ScoreRefreshMode,
  lastRefresh: string | Date | null | undefined,
  now: Date = new Date(),
): ScoreFreshness {
  if (dataMode === 'Live') return 'No snapshot needed';
  if (dataMode === 'Sandbox' || refreshMode === 'Simulation only') return 'Simulation only';
  if (dataMode === 'Not Implemented' || refreshMode === 'Not implemented') return 'Missing refresh';
  if (!lastRefresh) return 'Missing';

  const refreshedAt = lastRefresh instanceof Date ? lastRefresh : new Date(lastRefresh);
  if (Number.isNaN(refreshedAt.getTime())) return 'Unknown';

  const ageHours = (now.getTime() - refreshedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours > SNAPSHOT_VERY_STALE_HOURS) return 'Very stale';
  if (ageHours > SNAPSHOT_FRESH_HOURS) return 'Stale';
  return 'Fresh';
}

export function scoreFreshnessBadgeVariant(freshness: ScoreFreshness): 'success' | 'warning' | 'error' | 'info' {
  if (freshness === 'Fresh' || freshness === 'No snapshot needed') return 'success';
  if (freshness === 'Stale' || freshness === 'Simulation only') return 'warning';
  if (freshness === 'Very stale' || freshness === 'Missing' || freshness === 'Missing refresh') return 'error';
  return 'info';
}

export function formatLastRefresh(value: string | null | undefined) {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown timestamp';
  return date.toLocaleString();
}

const RPI_WEIGHTS: ScoreWeight[] = [
  { key: 'ageScore', label: 'Age', defaultWeight: 15, sourceField: 'replacement_priority_scores.age_score', explanation: 'Older assets increase replacement pressure after normalization.' },
  { key: 'failureScore', label: 'Failures', defaultWeight: 15, sourceField: 'replacement_priority_scores.failure_score', explanation: 'Recent failure frequency increases replacement urgency.' },
  { key: 'availabilityScore', label: 'Availability', defaultWeight: 20, sourceField: 'replacement_priority_scores.availability_score', explanation: 'Inverse-normalized availability. Lower availability is worse.' },
  { key: 'maintenanceBurdenScore', label: 'Maintenance burden', defaultWeight: 15, sourceField: 'replacement_priority_scores.maintenance_burden_score', explanation: 'Downtime and maintenance burden increase planning priority.' },
  { key: 'sparePartScore', label: 'Spare support', defaultWeight: 10, sourceField: 'replacement_priority_scores.spare_part_score', explanation: 'Open shortage signals increase replacement pressure.' },
  { key: 'riskScore', label: 'FMEA risk', defaultWeight: 15, sourceField: 'replacement_priority_scores.risk_score', explanation: 'Higher RPN contribution increases lifecycle risk.' },
  { key: 'costScore', label: 'Lifecycle cost', defaultWeight: 10, sourceField: 'replacement_priority_scores.cost_score', explanation: 'Higher maintenance cost contributes to replacement pressure.' },
];

export const SCORE_REGISTRY: ScoreRegistryEntry[] = [
  {
    key: 'rpn_fmea',
    displayName: 'RPN / FMEA Risk',
    category: 'Risk',
    dataMode: 'Snapshot',
    sourceOfTruth: 'equipment_risk_scores refreshed by fn_refresh_fmea_risk_scores() and recompute_equipment_analytics().',
    sourceTables: ['equipment_risk_scores', 'maintenance_events', 'work_orders', 'pm_schedules', 'calibration_records', 'equipment_assets'],
    sourceFunctions: ['fn_compute_fmea_risk_for_asset', 'fn_refresh_fmea_risk_scores', 'recompute_equipment_analytics'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Command Center risk evidence', 'Equipment detail', 'Replacement Priority', 'Reports', 'Notification Center internal risk signals', 'Developer Lab'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'Severity', source: 'asset category, condition, department impact', explanation: '1 to 10 severity factor.' },
      { label: 'Occurrence', source: 'failure and corrective work history', explanation: '1 to 10 occurrence factor.' },
      { label: 'Detectability', source: 'PM and calibration control evidence', explanation: '1 to 10 detectability factor.' },
    ],
    formulaSummary: 'RPN = Severity x Occurrence x Detectability.',
    notWeightAdjustableReason: 'RPN is multiplicative FMEA, not a weighted-sum score.',
    limitations: 'Manual overrides are allowed only through the FMEA override path and must keep audit evidence.',
    snapshotTimestampSources: ['equipment_risk_scores.computed_at', 'equipment_risk_scores.assessed_at'],
    refreshImplementation: { rpc: 'fn_refresh_fmea_risk_scores', table: 'equipment_risk_scores', timestampColumn: 'computed_at', notes: 'Recomputes active asset FMEA rows.' },
    sandboxMessage: 'Operational RPN uses BMEDIS risk evidence. This sandbox documents factors only; it does not modify operational FMEA scores.',
  },
  {
    key: 'replacement_priority',
    displayName: 'RPI / Replacement Priority',
    category: 'Lifecycle',
    dataMode: 'Snapshot',
    sourceOfTruth: 'replacement_priority_scores and v_replacement_decision.',
    sourceTables: ['replacement_priority_scores', 'equipment_reliability_metrics', 'equipment_risk_scores', 'maintenance_events', 'recommendation_flags'],
    sourceViews: ['v_replacement_decision'],
    sourceFunctions: ['compute_replacement_priority_scores_all'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Replacement Priority', 'Command Center', 'Reports', 'Equipment evidence', 'Developer Lab'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: RPI_WEIGHTS,
    criteria: RPI_WEIGHTS.map((weight) => ({
      label: weight.label,
      source: weight.sourceField ?? 'replacement_priority_scores',
      explanation: weight.explanation,
    })),
    formulaSummary: 'RPI = weighted sum of normalized age, failure, inverse availability, burden, spare, risk, and cost criteria.',
    limitations: 'RPI supports planning evidence only. It never approves replacement automatically.',
    snapshotTimestampSources: ['replacement_priority_scores.computed_at'],
    refreshImplementation: { rpc: 'compute_replacement_priority_scores_all', table: 'replacement_priority_scores', timestampColumn: 'computed_at', notes: 'Computes system RPI rows where weights_profile_id is null.' },
    sandboxMessage: 'Operational RPI uses snapshot BMEDIS data. This sandbox only simulates alternative weighting and does not modify operational replacement scores.',
  },
  {
    key: 'equipment_health',
    displayName: 'Equipment Health Score',
    category: 'Equipment',
    dataMode: 'Snapshot',
    sourceOfTruth: 'equipment_health_snapshots generated by refresh_decision_support_snapshots().',
    sourceTables: ['equipment_health_snapshots', 'equipment_reliability_metrics', 'pm_compliance_metrics', 'equipment_risk_scores', 'equipment_assets', 'recommendation_flags'],
    sourceViews: ['v_asset_health_summary'],
    sourceFunctions: ['refresh_decision_support_snapshots'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Command Center', 'Equipment detail', 'Developer Lab'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: [
      { key: 'availability', label: 'Availability', defaultWeight: 35, sourceField: 'equipment_reliability_metrics.availability_ratio', explanation: 'Higher availability improves health.' },
      { key: 'pmCompliance', label: 'PM compliance', defaultWeight: 25, sourceField: 'pm_compliance_metrics.pmc_percentage', explanation: 'Higher PM compliance improves health.' },
      { key: 'riskControl', label: 'RPN control', defaultWeight: 25, sourceField: 'equipment_risk_scores.rpn', explanation: 'RPN is inverted so lower risk improves health.' },
      { key: 'conditionStatus', label: 'Condition and flags', defaultWeight: 15, sourceField: 'equipment_assets.condition, recommendation_flags', explanation: 'Poor condition and active flags reduce health.' },
    ],
    criteria: [
      { label: 'Reliability', source: 'equipment_reliability_metrics', explanation: 'Availability ratio from MTBF and MTTR.' },
      { label: 'Preventive control', source: 'pm_compliance_metrics', explanation: 'Latest asset-level PM compliance.' },
      { label: 'Risk', source: 'equipment_risk_scores', explanation: 'RPN penalty.' },
      { label: 'Condition', source: 'equipment_assets and recommendation_flags', explanation: 'Condition and open flags penalty.' },
    ],
    formulaSummary: 'Health = availability 35 + PM compliance 25 + inverted RPN control 25 + condition/status 15.',
    limitations: 'Defaults are used inside the database function when supporting snapshot rows are missing; freshness must be checked.',
    snapshotTimestampSources: ['equipment_health_snapshots.created_at', 'equipment_health_snapshots.snapshot_date'],
    refreshImplementation: { rpc: 'refresh_decision_support_snapshots', table: 'equipment_health_snapshots', timestampColumn: 'created_at', notes: 'Refreshes daily asset health snapshots.' },
    sandboxMessage: 'Operational Equipment Health uses snapshot BMEDIS data. This sandbox only simulates alternative weighting and does not modify operational health scores.',
  },
  {
    key: 'department_clinical_readiness',
    displayName: 'Department / Clinical Readiness',
    category: 'Readiness',
    dataMode: 'Mixed',
    sourceOfTruth: 'v_department_readiness backed by clinical_readiness_snapshots, with operational pages also reading live equipment counts.',
    sourceTables: ['clinical_readiness_snapshots', 'equipment_assets', 'equipment_categories'],
    sourceViews: ['v_department_readiness'],
    sourceFunctions: ['refresh_decision_support_snapshots'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Command Center readiness cards', 'Department dashboard', 'Viewer dashboard', 'Reports'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'Essential functional assets', source: 'v_department_readiness.essential_functional', explanation: 'Functional active high or critical assets.' },
      { label: 'Essential total assets', source: 'v_department_readiness.essential_total', explanation: 'Active high or critical assets in a department.' },
      { label: 'Live supporting counts', source: 'equipment_assets', explanation: 'Operational pages may combine readiness with current asset counts and open work.' },
    ],
    formulaSummary: 'Readiness = essential functional assets / total essential assets x 100.',
    notWeightAdjustableReason: 'Readiness is a ratio and rule-based risk classification, not a weighted score.',
    limitations: 'The current v_department_readiness view reads the latest clinical_readiness_snapshots row, so stale snapshots must be surfaced.',
    snapshotTimestampSources: ['clinical_readiness_snapshots.created_at', 'v_department_readiness.snapshot_created_at'],
    refreshImplementation: { rpc: 'refresh_decision_support_snapshots', table: 'clinical_readiness_snapshots', timestampColumn: 'created_at', notes: 'Refreshes department readiness snapshots from current equipment records.' },
    sandboxMessage: 'Operational readiness uses v_department_readiness and current BMEDIS evidence. This sandbox only documents alternative interpretation and does not modify operational readiness.',
  },
  {
    key: 'critical_action_score',
    displayName: 'Critical Action Score',
    category: 'Command Center',
    dataMode: 'Live',
    sourceOfTruth: 'buildCriticalActions() in command-center-data.ts from current corrective, PM, calibration, stock, replacement, procurement, installation, and risk signals.',
    sourceTables: ['work_orders', 'maintenance_requests', 'pm_schedules', 'calibration_records', 'spare_parts', 'procurement_requests', 'replacement_priority_scores', 'recommendation_flags'],
    refreshMode: 'Live view',
    operationalConsumers: ['Command Center critical action strip'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: [
      { key: 'corrective', label: 'Corrective maintenance', defaultWeight: 100, sourceField: 'buildCriticalActions.CATEGORY_WEIGHTS.corrective', explanation: 'Highest base priority for active corrective work.' },
      { key: 'needsRequest', label: 'Needs request', defaultWeight: 90, sourceField: 'CATEGORY_WEIGHTS.needs_request', explanation: 'Condition-problem assets without open corrective work.' },
      { key: 'calibration', label: 'Calibration', defaultWeight: 85, sourceField: 'CATEGORY_WEIGHTS.calibration', explanation: 'Accuracy and safety compliance urgency.' },
      { key: 'pm', label: 'PM overdue', defaultWeight: 75, sourceField: 'CATEGORY_WEIGHTS.pm', explanation: 'Preventive maintenance urgency.' },
      { key: 'stock', label: 'Stock blocker', defaultWeight: 70, sourceField: 'CATEGORY_WEIGHTS.stock', explanation: 'Parts blocking work or causing stockout risk.' },
      { key: 'riskWatch', label: 'Risk watch', defaultWeight: 65, sourceField: 'CATEGORY_WEIGHTS.risk_watch', explanation: 'Informational risk signals without active work.' },
      { key: 'installation', label: 'Installation', defaultWeight: 60, sourceField: 'CATEGORY_WEIGHTS.installation', explanation: 'Pending installation workflow.' },
      { key: 'replacement', label: 'Replacement', defaultWeight: 55, sourceField: 'CATEGORY_WEIGHTS.replacement', explanation: 'Lifecycle planning evidence.' },
      { key: 'procurement', label: 'Procurement', defaultWeight: 45, sourceField: 'CATEGORY_WEIGHTS.procurement', explanation: 'Delayed procurement impact.' },
      { key: 'training', label: 'Training', defaultWeight: 35, sourceField: 'CATEGORY_WEIGHTS.training', explanation: 'Training request urgency.' },
    ],
    criteria: [
      { label: 'Category base', source: 'command-center-data.ts', explanation: 'Base weights rank cross-module categories.' },
      { label: 'Item score', source: 'typed command fetchers', explanation: 'Each triage fetcher computes current operational urgency.' },
    ],
    formulaSummary: 'Critical action score = category base weight + current item priority score.',
    limitations: 'Sandbox changes are not wired to Command Center. Operational ranking remains code-defined until an audited weighting profile feature exists.',
    sandboxMessage: 'Operational critical actions are built from current work, PM, calibration, stock, procurement, replacement, installation, and risk signals. This sandbox only simulates alternative weighting and does not modify the Command Center.',
  },
  {
    key: 'stock_blocker_priority',
    displayName: 'Stock Blocker Priority',
    category: 'Inventory',
    dataMode: 'Live',
    sourceOfTruth: 'fetchStockBlockers() from spare_parts, maintenance_parts_used, maintenance_events, and open work_orders.',
    sourceTables: ['spare_parts', 'maintenance_parts_used', 'maintenance_events', 'work_orders'],
    refreshMode: 'Live view',
    operationalConsumers: ['Command Center', 'Spare Parts', 'Logistics', 'Store role dashboard'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: [
      { key: 'maintenanceBlocker', label: 'Open work linkage', defaultWeight: 100, sourceField: 'linkedOpenWorkByPart', explanation: 'Confirmed open work linkage makes a part a repair blocker.' },
      { key: 'stockout', label: 'Stockout', defaultWeight: 90, sourceField: 'spare_parts.current_stock', explanation: 'Current stock equal to zero is urgent even without work linkage.' },
      { key: 'lowStockBase', label: 'Low stock base', defaultWeight: 60, sourceField: 'spare_parts.current_stock <= reorder_level', explanation: 'Low stock risk base score.' },
      { key: 'deficitMultiplier', label: 'Reorder deficit', defaultWeight: 30, sourceField: 'reorder_level - current_stock', explanation: 'Larger reorder deficit increases low-stock risk.' },
    ],
    criteria: [
      { label: 'Current stock', source: 'spare_parts.current_stock', explanation: 'Quantity on hand.' },
      { label: 'Reorder level', source: 'spare_parts.reorder_level', explanation: 'Minimum expected stock.' },
      { label: 'Open work linkage', source: 'maintenance_parts_used -> work_orders', explanation: 'Distinguishes confirmed blockers from low-stock risk.' },
    ],
    formulaSummary: 'Priority = 100 if linked to active work, else 90 for stockout, else 60 + reorder deficit ratio x 30.',
    limitations: 'Work linkage depends on maintenance_parts_used evidence; no fuzzy matching is used.',
    sandboxMessage: 'Operational stock priority uses live stock, issue, maintenance, and work-order data. This sandbox only simulates alternative weighting.',
  },
  {
    key: 'procurement_delay_priority',
    displayName: 'Procurement Delay Priority',
    category: 'Procurement',
    dataMode: 'Live',
    sourceOfTruth: 'fetchProcurementTriage() from current procurement_requests rows.',
    sourceTables: ['procurement_requests'],
    refreshMode: 'Live view',
    operationalConsumers: ['Command Center', 'Procurement', 'Logistics', 'Reports'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: [
      { key: 'pipelineBase', label: 'Open pipeline base', defaultWeight: 45, sourceField: 'procurement_requests.status', explanation: 'Open procurement rows start with base priority.' },
      { key: 'delayMultiplier', label: 'Delay age multiplier', defaultWeight: 45, sourceField: 'procurement_requests.created_at', explanation: 'Older open procurement requests increase priority up to the cap.' },
    ],
    criteria: [
      { label: 'Status', source: 'procurement_requests.status', explanation: 'Delivered and canceled rows are excluded.' },
      { label: 'Delay days', source: 'procurement_requests.created_at', explanation: 'Current implementation uses age of open request as delay pressure.' },
    ],
    formulaSummary: 'Priority = 45 + min(45, open age days x 0.5).',
    limitations: 'Expected delivery date is shown elsewhere; this Command Center priority currently uses open request age.',
    sandboxMessage: 'Operational procurement priority uses live procurement workflow data. This sandbox only simulates alternative weighting.',
  },
  {
    key: 'calibration_risk_priority',
    displayName: 'Calibration Risk Priority',
    category: 'Calibration',
    dataMode: 'Live',
    sourceOfTruth: 'fetchCalibrationTriage() from v_calibration_due and calibration records.',
    sourceTables: ['calibration_records', 'calibration_requests', 'equipment_assets'],
    sourceViews: ['v_calibration_due'],
    refreshMode: 'Live view',
    operationalConsumers: ['Calibration', 'Command Center', 'Reports', 'Notification Center internal compliance signals'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: [
      { key: 'dueBase', label: 'Due or overdue base', defaultWeight: 50, sourceField: 'v_calibration_due.next_due_date', explanation: 'Items due in the triage window start with base compliance priority.' },
      { key: 'overdueMultiplier', label: 'Overdue days multiplier', defaultWeight: 50, sourceField: 'daysSince(next_due_date)', explanation: 'More overdue days increase risk up to the cap.' },
    ],
    criteria: [
      { label: 'Next due date', source: 'v_calibration_due.next_due_date', explanation: 'Due or overdue calibration date.' },
      { label: 'Overdue days', source: 'computed from next_due_date', explanation: 'Older overdue items rank higher.' },
    ],
    formulaSummary: 'Priority = 50 + min(50, overdue days x 0.5).',
    limitations: 'The final polishing semantic calls for additional criticality/result/workflow-state factors; current code uses due date urgency in Command Center.',
    sandboxMessage: 'Operational calibration priority uses live calibration due evidence. This sandbox only simulates alternative weighting.',
  },
  {
    key: 'pm_triage_priority',
    displayName: 'PM Triage Priority',
    category: 'PM',
    dataMode: 'Live',
    sourceOfTruth: 'fetchPMTriage() from v_overdue_pm.',
    sourceTables: ['pm_schedules', 'pm_plans'],
    sourceViews: ['v_overdue_pm'],
    refreshMode: 'Live view',
    operationalConsumers: ['PM', 'Command Center', 'Reports'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: true,
    operationalImplementation: 'yes',
    sensitivitySupported: true,
    sandboxOnly: false,
    weights: [
      { key: 'overdueBase', label: 'Overdue base', defaultWeight: 50, sourceField: 'v_overdue_pm.scheduled_date', explanation: 'Overdue PM rows start with base urgency.' },
      { key: 'overdueAgeMultiplier', label: 'Overdue age multiplier', defaultWeight: 50, sourceField: 'daysSince(scheduled_date)', explanation: 'Older overdue PM rows increase priority up to the cap.' },
    ],
    criteria: [
      { label: 'Scheduled date', source: 'v_overdue_pm.scheduled_date', explanation: 'Past due date drives urgency.' },
      { label: 'Overdue days', source: 'computed from scheduled_date', explanation: 'Older overdue PM is ranked higher.' },
    ],
    formulaSummary: 'Priority = 50 + min(50, overdue days x 0.3).',
    limitations: 'Criticality and PM result risk are not currently part of this Command Center PM triage formula.',
    sandboxMessage: 'Operational PM triage uses live overdue PM evidence. This sandbox only simulates alternative weighting.',
  },
  {
    key: 'pm_compliance',
    displayName: 'PM Compliance',
    category: 'PM',
    dataMode: 'Snapshot',
    sourceOfTruth: 'pm_compliance_metrics and live pm_schedules windows.',
    sourceTables: ['pm_compliance_metrics', 'pm_schedules', 'pm_completions'],
    sourceFunctions: ['compute_pm_compliance_metrics', 'recompute_equipment_analytics'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['PM', 'Command Center', 'Reports', 'Equipment detail'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'Scheduled count', source: 'pm_compliance_metrics.scheduled_count', explanation: 'Total scheduled PM in the period.' },
      { label: 'Completed count', source: 'pm_compliance_metrics.completed_count', explanation: 'Completed PM in the period. Skipped and deferred are not completed.' },
    ],
    formulaSummary: 'PMC = completed scheduled PM tasks / total scheduled PM tasks x 100.',
    notWeightAdjustableReason: 'PM Compliance is a ratio with no weights to adjust.',
    limitations: 'Some pages also use live recent windows from pm_schedules; snapshot freshness still matters for stored metrics.',
    snapshotTimestampSources: ['pm_compliance_metrics.computed_at'],
    refreshImplementation: { rpc: 'recompute_all_equipment_analytics', table: 'pm_compliance_metrics', timestampColumn: 'computed_at', notes: 'Recomputes asset-level PM compliance through analytics recompute.' },
    sandboxMessage: 'Operational PM Compliance uses BMEDIS PM records. There are no weights to adjust in this sandbox.',
  },
  {
    key: 'technician_workload_capacity',
    displayName: 'Technician Workload / Capacity',
    category: 'Workload',
    dataMode: 'Live',
    sourceOfTruth: 'fetchTechnicianWorkload() from current work_orders and technician profiles.',
    sourceTables: ['work_orders', 'profiles', 'user_roles', 'roles'],
    refreshMode: 'Live view',
    operationalConsumers: ['Command Center workload', 'Work Orders'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'Open assignments', source: 'work_orders.assigned_to', explanation: 'Current open work count per technician.' },
      { label: 'In progress', source: 'work_orders.status', explanation: 'Current execution load.' },
      { label: 'Critical tasks', source: 'work_orders.priority', explanation: 'Critical work pushes status to overloaded.' },
    ],
    formulaSummary: 'Status = overloaded if open assignments >= 6 or any critical task; busy if open assignments >= 3; otherwise available.',
    notWeightAdjustableReason: 'Workload capacity is threshold-based status classification, not a weighted score.',
    limitations: 'Estimated hours are displayed but do not currently drive the status threshold.',
    sandboxMessage: 'Operational workload uses live work-order assignments. There are no weights to adjust in this sandbox.',
  },
  {
    key: 'availability',
    displayName: 'Availability',
    category: 'Reliability',
    dataMode: 'Snapshot',
    sourceOfTruth: 'equipment_reliability_metrics from recompute_equipment_analytics().',
    sourceTables: ['equipment_reliability_metrics', 'downtime_logs', 'maintenance_events'],
    sourceFunctions: ['fn_compute_availability', 'recompute_equipment_analytics'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Equipment detail', 'Replacement Priority', 'Command Center evidence', 'Reports'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'MTBF', source: 'equipment_reliability_metrics.mtbf_hours', explanation: 'Mean time between failures.' },
      { label: 'MTTR', source: 'equipment_reliability_metrics.mttr_hours', explanation: 'Mean time to repair.' },
    ],
    formulaSummary: 'Availability = MTBF / (MTBF + MTTR).',
    notWeightAdjustableReason: 'Availability is a reliability formula with no adjustable weights.',
    limitations: 'Depends on downtime and maintenance event completeness.',
    snapshotTimestampSources: ['equipment_reliability_metrics.computed_at'],
    refreshImplementation: { rpc: 'recompute_all_equipment_analytics', table: 'equipment_reliability_metrics', timestampColumn: 'computed_at', notes: 'Recomputes reliability rows for active assets.' },
    sandboxMessage: 'Operational Availability uses stored reliability metrics. There are no weights to adjust in this sandbox.',
  },
  {
    key: 'mtbf',
    displayName: 'MTBF',
    category: 'Reliability',
    dataMode: 'Snapshot',
    sourceOfTruth: 'equipment_reliability_metrics from fn_compute_mtbf().',
    sourceTables: ['equipment_reliability_metrics', 'maintenance_events'],
    sourceFunctions: ['fn_compute_mtbf', 'recompute_equipment_analytics'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Equipment detail', 'Reports', 'Availability'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'Operational hours', source: 'equipment_reliability_metrics.total_operational_hours', explanation: 'Hours available in the period.' },
      { label: 'Failure count', source: 'equipment_reliability_metrics.failure_count', explanation: 'Failures in the period.' },
    ],
    formulaSummary: 'MTBF = operational hours / failure count.',
    notWeightAdjustableReason: 'MTBF is a reliability formula with no weights to adjust.',
    limitations: 'No recorded failures can produce null or fallback display behavior depending on page.',
    snapshotTimestampSources: ['equipment_reliability_metrics.computed_at'],
    refreshImplementation: { rpc: 'recompute_all_equipment_analytics', table: 'equipment_reliability_metrics', timestampColumn: 'computed_at', notes: 'Recomputes reliability rows for active assets.' },
    sandboxMessage: 'Operational MTBF uses stored reliability metrics. There are no weights to adjust in this sandbox.',
  },
  {
    key: 'mttr',
    displayName: 'MTTR',
    category: 'Reliability',
    dataMode: 'Snapshot',
    sourceOfTruth: 'equipment_reliability_metrics from fn_compute_mttr().',
    sourceTables: ['equipment_reliability_metrics', 'maintenance_events'],
    sourceFunctions: ['fn_compute_mttr', 'recompute_equipment_analytics'],
    refreshMode: 'Triggered snapshot',
    operationalConsumers: ['Equipment detail', 'Reports', 'Availability'],
    affectsLiveDecisions: 'Yes',
    sandboxChangesAffectLive: 'No',
    isWeightedComposite: false,
    operationalImplementation: 'yes',
    sensitivitySupported: false,
    sandboxOnly: false,
    criteria: [
      { label: 'Repair duration', source: 'maintenance_events.repair_duration_hours', explanation: 'Total repair hours.' },
      { label: 'Repair count', source: 'maintenance_events.completion_date', explanation: 'Completed repairs in the period.' },
    ],
    formulaSummary: 'MTTR = total repair time / completed repair count.',
    notWeightAdjustableReason: 'MTTR is a reliability formula with no weights to adjust.',
    limitations: 'Requires completed repair events with duration evidence.',
    snapshotTimestampSources: ['equipment_reliability_metrics.computed_at'],
    refreshImplementation: { rpc: 'recompute_all_equipment_analytics', table: 'equipment_reliability_metrics', timestampColumn: 'computed_at', notes: 'Recomputes reliability rows for active assets.' },
    sandboxMessage: 'Operational MTTR uses stored reliability metrics. There are no weights to adjust in this sandbox.',
  },
];

export const SENSITIVITY_SUPPORTED_SCORES = SCORE_REGISTRY.filter((score) => score.sensitivitySupported);
export const NOT_WEIGHT_ADJUSTABLE_SCORES = SCORE_REGISTRY.filter((score) => !score.sensitivitySupported);

export function getScoreRegistryEntry(key: string) {
  return SCORE_REGISTRY.find((score) => score.key === key);
}

export function getDefaultWeightMap(score: ScoreRegistryEntry): Record<string, number> {
  return Object.fromEntries((score.weights ?? []).map((weight) => [weight.key, weight.defaultWeight]));
}
