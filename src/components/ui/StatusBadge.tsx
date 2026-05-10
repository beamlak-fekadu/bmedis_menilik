import Badge from './Badge';
import type { EquipmentCondition, Urgency, WorkOrderStatus, MaintenanceRequestStatus, PMScheduleStatus, RiskLevel } from '@/types/database';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';

const conditionVariant: Record<EquipmentCondition, BadgeVariant> = {
  functional: 'success',
  needs_repair: 'warning',
  non_functional: 'error',
  under_maintenance: 'purple',
  decommissioned: 'default',
};

const urgencyVariant: Record<Urgency, BadgeVariant> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const woStatusVariant: Record<WorkOrderStatus, BadgeVariant> = {
  open: 'warning',
  assigned: 'info',
  in_progress: 'purple',
  on_hold: 'default',
  completed: 'success',
  canceled: 'default',
};

const mrStatusVariant: Record<MaintenanceRequestStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'info',
  assigned: 'purple',
  in_progress: 'purple',
  completed: 'success',
  rejected: 'error',
  canceled: 'default',
};

const pmStatusVariant: Record<PMScheduleStatus, BadgeVariant> = {
  scheduled: 'info',
  in_progress: 'purple',
  completed: 'success',
  overdue: 'error',
  skipped: 'default',
  deferred: 'warning',
  canceled: 'default',
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

function formatLabel(val: string): string {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ConditionBadge({ condition }: { condition: EquipmentCondition }) {
  return <Badge variant={conditionVariant[condition]}>{formatLabel(condition)}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <Badge variant={urgencyVariant[urgency]}>{formatLabel(urgency)}</Badge>;
}

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge variant={woStatusVariant[status]}>{formatLabel(status)}</Badge>;
}

export function RequestStatusBadge({ status }: { status: MaintenanceRequestStatus }) {
  return <Badge variant={mrStatusVariant[status]}>{formatLabel(status)}</Badge>;
}

export function PMStatusBadge({ status }: { status: PMScheduleStatus }) {
  return <Badge variant={pmStatusVariant[status]}>{formatLabel(status)}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge variant={riskVariant[level]}>{formatLabel(level)}</Badge>;
}
