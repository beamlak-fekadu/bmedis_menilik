export const CLOSED_PM_STATUSES = new Set(['completed', 'skipped', 'canceled']);
export const ACTIVE_PM_STATUSES = new Set(['scheduled', 'in_progress', 'overdue', 'deferred']);
export const COMPLIANCE_THRESHOLD = 80;

export type PMExplanation = {
  title: string;
  scoreLabel: string;
  formula: string;
  criteria: string[];
  rawValues?: Array<{ label: string; value: string | number | null }>;
  calculation: string;
  generatedReason: string;
  timestamp?: string | null;
  source?: string;
  assignmentMethod?: string;
  actionSuggestion?: string;
};

export type PMScheduleLike = {
  id: string;
  status: string;
  scheduled_date: string;
  assigned_to?: string | null;
  completed_at?: string | null;
};

export type PlanScheduleStateId = 'multiple_active' | 'overdue' | 'upcoming' | 'needs_next' | 'no_history';

export type PlanScheduleState = {
  id: PlanScheduleStateId;
  label: string;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  activeTasks: PMScheduleLike[];
  overdueTasks: PMScheduleLike[];
  primaryTask: PMScheduleLike | null;
};

export function todayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function formatPMDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

export function datePlusDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().split('T')[0];
}

export function isActivePMTask(status: string) {
  return ACTIVE_PM_STATUSES.has(status);
}

export function isClosedPMTask(status: string) {
  return CLOSED_PM_STATUSES.has(status);
}

export function isOverduePMTask(row: Pick<PMScheduleLike, 'scheduled_date' | 'status'>) {
  if (!isActivePMTask(row.status)) return false;
  return row.status === 'overdue' || new Date(`${row.scheduled_date}T00:00:00`) < todayDate();
}

export function isDueSoonPMTask(row: Pick<PMScheduleLike, 'scheduled_date' | 'status'>) {
  if (!isActivePMTask(row.status)) return false;
  const target = new Date(`${row.scheduled_date}T00:00:00`);
  const today = todayDate();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  return target >= today && target <= horizon;
}

function compareScheduleDate(a: PMScheduleLike, b: PMScheduleLike) {
  return a.scheduled_date.localeCompare(b.scheduled_date);
}

export function getPlanScheduleState(schedules: PMScheduleLike[]): PlanScheduleState {
  const activeTasks = schedules.filter((row) => isActivePMTask(row.status)).sort(compareScheduleDate);
  const overdueTasks = activeTasks.filter(isOverduePMTask).sort(compareScheduleDate);
  const primaryTask = overdueTasks[0] ?? activeTasks[0] ?? null;

  if (activeTasks.length > 1) {
    return { id: 'multiple_active', label: 'Review active tasks', variant: 'warning', activeTasks, overdueTasks, primaryTask };
  }
  if (overdueTasks.length > 0) {
    return { id: 'overdue', label: 'Overdue task', variant: 'error', activeTasks, overdueTasks, primaryTask };
  }
  if (activeTasks.length > 0) {
    return { id: 'upcoming', label: 'Upcoming task', variant: 'info', activeTasks, overdueTasks, primaryTask };
  }
  if (schedules.length > 0) {
    return { id: 'needs_next', label: 'Needs next task', variant: 'warning', activeTasks, overdueTasks, primaryTask };
  }
  return { id: 'no_history', label: 'Needs next task', variant: 'warning', activeTasks, overdueTasks, primaryTask };
}

export function formatPMStatusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPMPlanStatusExplanation(isActive: boolean): PMExplanation {
  return {
    title: isActive ? 'Plan: Active' : 'Plan: Paused',
    scoreLabel: isActive ? 'Plan: Active' : 'Plan: Paused',
    formula: 'pm_plans.is_active controls recurring task generation.',
    criteria: ['Active plans can generate future PM tasks.', 'Paused plans keep historical schedule records.', 'Pausing does not complete, delete, or cancel existing tasks.'],
    rawValues: [{ label: 'is_active', value: String(isActive) }],
    calculation: isActive ? 'Plan is enabled for future PM task generation.' : 'Plan is temporarily disabled for future PM task generation.',
    generatedReason: isActive
      ? 'This recurring PM plan is enabled. Future PM tasks can be generated from its frequency.'
      : 'This plan is temporarily disabled. Existing historical PM records remain, but new tasks should not be generated until resumed.',
    source: 'pm_plans',
    assignmentMethod: 'Stored plan state',
    actionSuggestion: isActive ? 'Pause only when the recurring PM program should stop generating new tasks.' : 'Resume when this recurring PM program should continue.',
  };
}

export function getAssetCriticalityExplanation(criticality?: string | null): PMExplanation {
  const label = criticality ? formatPMStatusLabel(criticality) : 'Not set';
  return {
    title: `Asset criticality: ${label}`,
    scoreLabel: `Asset criticality: ${label}`,
    formula: 'equipment category criticality assigned to the asset.',
    criteria: ['Clinical importance', 'Service continuity impact', 'Equipment category risk classification'],
    rawValues: [{ label: 'criticality_level', value: criticality ?? 'Not set' }],
    calculation: label,
    generatedReason: 'This comes from the equipment category criticality. Critical assets affect patient safety or service continuity and should have stricter PM follow-up.',
    source: 'equipment_categories.criticality_level',
    assignmentMethod: 'Reference/master data',
    actionSuggestion: criticality === 'critical' || criticality === 'high' ? 'Prioritize PM follow-up and overdue task resolution.' : 'Follow normal PM cadence unless other risk evidence is present.',
  };
}

export function getPMScheduleStateExplanation(state: PlanScheduleState): PMExplanation {
  const reasonByState: Record<PlanScheduleStateId, string> = {
    multiple_active: 'This plan has more than one unfinished PM task. Review the active tasks before generating another.',
    overdue: 'This plan has an unfinished PM schedule past its scheduled date.',
    upcoming: 'This plan has one unfinished PM task already generated.',
    needs_next: 'This plan has PM history but no unfinished upcoming PM task. Generate the next task to continue the PM cycle.',
    no_history: 'This plan has no generated PM schedule records yet. Generate the next task to begin tracking.',
  };
  const actionByState: Record<PlanScheduleStateId, string> = {
    multiple_active: 'Open the plan history and reconcile active tasks.',
    overdue: 'Open the overdue task and complete, defer, or assign it.',
    upcoming: 'Open the upcoming task if assignment or execution is needed.',
    needs_next: 'Generate the next task when the plan should continue.',
    no_history: 'Generate the first task when the plan should begin.',
  };

  return {
    title: `Schedule state: ${state.label}`,
    scoreLabel: state.label,
    formula: 'unfinished task check = scheduled + in progress + overdue + deferred PM schedules.',
    criteria: ['Existing unfinished PM task', 'Scheduled date compared with today', 'Historical schedule count'],
    rawValues: [
      { label: 'Active tasks', value: state.activeTasks.length },
      { label: 'Overdue tasks', value: state.overdueTasks.length },
      { label: 'Primary task', value: state.primaryTask?.id.slice(0, 8) ?? 'None' },
    ],
    calculation: state.label,
    generatedReason: reasonByState[state.id],
    source: 'pm_schedules',
    assignmentMethod: 'Derived from exact schedule rows',
    actionSuggestion: actionByState[state.id],
  };
}

export function getPMScheduleStatusExplanation(status: string): PMExplanation {
  const label = formatPMStatusLabel(status);
  const active = isActivePMTask(status);
  const reasonByStatus: Record<string, string> = {
    scheduled: 'This PM task has been generated and is waiting for assignment or execution.',
    in_progress: 'This PM task has started and still requires completion evidence.',
    overdue: 'This PM task is unfinished and past its scheduled date.',
    deferred: 'This PM task was moved or delayed with a reason. It remains unfinished and does not count as completed.',
    completed: 'This PM task has completion evidence and counts toward PM compliance.',
    skipped: 'This PM task was skipped with a reason. It is tracked separately and does not count as completed.',
    canceled: 'This PM task was canceled and is retained as history.',
  };
  return {
    title: `PM schedule status: ${label}`,
    scoreLabel: label,
    formula: 'pm_schedules.status drives PM task action and compliance treatment.',
    criteria: ['Task completion state', 'Assignment/execution state', 'Compliance treatment'],
    rawValues: [{ label: 'status', value: status }],
    calculation: active ? 'Unfinished active PM task' : 'Historical/non-active PM schedule record',
    generatedReason: reasonByStatus[status] ?? 'This is the stored workflow status for the PM schedule.',
    source: 'pm_schedules.status',
    assignmentMethod: 'Stored workflow state',
    actionSuggestion: active ? 'Open the schedule detail to assign, complete, defer, or review the task.' : 'Use the record as PM history/evidence.',
  };
}

export function getPMCountExplanation(kind: 'records' | 'active' | 'due_soon' | 'overdue' | 'skipped_deferred'): string {
  const text = {
    records: 'PM Schedule Records include historical completed, skipped, deferred, canceled, overdue, and upcoming generated PM tasks.',
    active: 'Active PM Tasks are unfinished PM tasks that still require action.',
    due_soon: 'Due Soon counts active PM tasks due within the next 30 days.',
    overdue: 'Overdue PM counts active PM tasks past their scheduled date or explicitly marked overdue.',
    skipped_deferred: 'Skipped/deferred PM tasks are tracked separately and do not count as completed.',
  };
  return text[kind];
}
