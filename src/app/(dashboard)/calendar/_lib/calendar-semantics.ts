import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Gauge,
  PackageCheck,
  Stethoscope,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type CalendarEventType =
  | 'pm'
  | 'calibration'
  | 'work_order'
  | 'maintenance_request'
  | 'training'
  | 'installation'
  | 'procurement'
  | 'disposal'
  | 'replacement'
  | 'document';

export type CalendarEventStatus =
  | 'scheduled'
  | 'due_soon'
  | 'overdue'
  | 'in_progress'
  | 'completed'
  | 'pending'
  | 'approved'
  | 'assigned'
  | 'on_hold'
  | 'delayed'
  | 'cancelled'
  | 'info';

export interface CalendarEvent {
  id: string;
  sourceType: CalendarEventType;
  sourceTable: string;
  sourceId: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  status: CalendarEventStatus;
  priority?: string | null;
  criticality?: string | null;
  departmentName?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  assignedToName?: string | null;
  href: string;
  actionLabel: string;
  canMutate: boolean;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface HospitalCalendarScope {
  profileId: string;
  departmentId: string | null;
  departmentName: string | null;
  roleNames: string[];
  primaryRole: string;
  canMutate: boolean;
  canSeeAll: boolean;
}

export interface CalendarSourceWarning {
  source: string;
  label: string;
  message: string;
  hint?: string;
}

export interface HospitalCalendarData {
  events: CalendarEvent[];
  warnings: CalendarSourceWarning[];
  scope: HospitalCalendarScope;
}

export const CALENDAR_TYPE_LABELS: Record<CalendarEventType, string> = {
  pm: 'PM',
  calibration: 'Calibration',
  work_order: 'Work order',
  maintenance_request: 'Maintenance request',
  training: 'Training',
  installation: 'Installation',
  procurement: 'Procurement',
  disposal: 'Disposal',
  replacement: 'Replacement',
  document: 'Document',
};

export const CALENDAR_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  scheduled: 'Scheduled',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  in_progress: 'In progress',
  completed: 'Completed',
  pending: 'Pending',
  approved: 'Approved',
  assigned: 'Assigned',
  on_hold: 'On hold',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
  info: 'Info',
};

export const CALENDAR_TYPE_ICONS: Record<CalendarEventType, LucideIcon> = {
  pm: CalendarCheck,
  calibration: Gauge,
  work_order: Wrench,
  maintenance_request: ClipboardList,
  training: GraduationCap,
  installation: Stethoscope,
  procurement: PackageCheck,
  disposal: Trash2,
  replacement: AlertTriangle,
  document: FileText,
};

export const CALENDAR_TYPE_STYLES: Record<CalendarEventType, string> = {
  pm: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200',
  calibration: 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200',
  work_order: 'border-orange-500/30 bg-orange-500/12 text-orange-200',
  maintenance_request: 'border-rose-500/30 bg-rose-500/12 text-rose-200',
  training: 'border-sky-500/30 bg-sky-500/12 text-sky-200',
  installation: 'border-violet-500/30 bg-violet-500/12 text-violet-200',
  procurement: 'border-amber-500/30 bg-amber-500/12 text-amber-200',
  disposal: 'border-slate-500/30 bg-slate-500/12 text-slate-200',
  replacement: 'border-red-500/30 bg-red-500/12 text-red-200',
  document: 'border-indigo-500/30 bg-indigo-500/12 text-indigo-200',
};

export function formatCalendarLabel(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return 'Not recorded';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isTerminalCalendarStatus(status: CalendarEventStatus) {
  return status === 'completed' || status === 'cancelled';
}

export function sortCalendarEvents(events: CalendarEvent[]) {
  const statusWeight: Record<CalendarEventStatus, number> = {
    overdue: 0,
    on_hold: 1,
    in_progress: 2,
    due_soon: 3,
    pending: 4,
    approved: 5,
    assigned: 6,
    scheduled: 7,
    delayed: 8,
    info: 9,
    completed: 10,
    cancelled: 11,
  };
  const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...events].sort((a, b) => {
    const dateCompare = a.startDate.localeCompare(b.startDate);
    if (dateCompare !== 0) return dateCompare;
    const statusCompare = statusWeight[a.status] - statusWeight[b.status];
    if (statusCompare !== 0) return statusCompare;
    return (priorityWeight[a.priority ?? ''] ?? 4) - (priorityWeight[b.priority ?? ''] ?? 4);
  });
}
