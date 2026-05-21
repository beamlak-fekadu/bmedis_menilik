import { createClient } from '@/lib/supabase/server';
import type { RoleName } from '@/types/roles';
import {
  calibrationCalendarHref,
  disposedAssetCalendarHref,
  disposalCalendarHref,
  documentCalendarHref,
  installationRecordCalendarHref,
  installationRequestCalendarHref,
  maintenanceRequestCalendarHref,
  pmCalendarHref,
  procurementCalendarHref,
  trainingCalendarHref,
  workOrderCalendarHref,
} from './calendar-routes';
import {
  type CalendarEvent,
  type CalendarEventStatus,
  type CalendarEventType,
  type CalendarSourceWarning,
  type HospitalCalendarData,
  type HospitalCalendarScope,
  formatCalendarLabel,
  sortCalendarEvents,
} from './calendar-semantics';

type RawRow = Record<string, unknown>;
type RawRelation<T = RawRow> = T | T[] | null | undefined;

type CalendarProfile = {
  id: string;
  department_id?: string | null;
  roleNames?: string[];
};

const ACTIVE_PM_STATUSES = ['scheduled', 'in_progress', 'overdue', 'deferred'];
const TERMINAL_STATUSES = ['completed', 'canceled', 'cancelled', 'rejected', 'skipped'];

type CalendarSourceKey =
  | 'pm'
  | 'calibration'
  | 'work_orders'
  | 'maintenance_requests'
  | 'training'
  | 'installation'
  | 'procurement'
  | 'disposal'
  | 'specification';

type CalendarSourceConfig = {
  source: CalendarSourceKey;
  label: string;
  hint?: string;
};

const SOURCE_HINTS: Partial<Record<CalendarSourceKey, string>> = {
  pm: 'If PM evidence fields are missing, apply migration 00042_pm_schedule_evidence.sql.',
  installation: 'If installation_requests is missing, apply migration 00040_installation_requests.sql.',
  specification: 'If specification_requests is missing, apply migration 00041_specification_requests.sql.',
};

function firstRelation<T>(value: RawRelation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function dateOnly(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return raw.includes('T') ? raw.split('T')[0] : raw;
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function isPastDate(value: string) {
  return value < todayKey();
}

function isWithinDays(value: string, days: number) {
  const target = new Date(`${value}T00:00:00`);
  const start = new Date(`${todayKey()}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return target >= start && target <= end;
}

function normalizeStatus(status: unknown, date?: string | null): CalendarEventStatus {
  const value = String(status ?? '').toLowerCase();
  if ((value === 'scheduled' || value === 'pending' || value === 'approved' || value === 'assigned') && date && isPastDate(date)) {
    return 'overdue';
  }
  if (value === 'overdue') return 'overdue';
  if (value === 'in_progress' || value === 'ordered' || value === 'in_transit' || value === 'commissioning') return 'in_progress';
  if (value === 'completed' || value === 'delivered' || value === 'disposed' || value === 'pass' || value === 'adjusted') return 'completed';
  if (value === 'pending' || value === 'submitted' || value === 'requested' || value === 'in_review') return 'pending';
  if (value === 'approved') return 'approved';
  if (value === 'assigned') return 'assigned';
  if (value === 'on_hold') return 'on_hold';
  if (value === 'deferred') return date && isPastDate(date) ? 'overdue' : 'scheduled';
  if (value === 'canceled' || value === 'cancelled' || value === 'skipped') return 'cancelled';
  if (value === 'rejected') return 'cancelled';
  if (date && isPastDate(date)) return 'overdue';
  if (date && isWithinDays(date, 14)) return 'due_soon';
  return 'scheduled';
}

function assetFrom(row: RawRow) {
  const asset = firstRelation(row.equipment_assets as RawRelation);
  const department = firstRelation(asset?.departments as RawRelation);
  const category = firstRelation(asset?.equipment_categories as RawRelation);
  return {
    assetId: text(asset?.id) ?? text(row.asset_id),
    assetCode: text(asset?.asset_code),
    assetName: text(asset?.name) ?? text(row.equipment_name),
    departmentName: text(department?.name),
    criticality: text(category?.criticality_level),
  };
}

function departmentFrom(row: RawRow) {
  const department = firstRelation(row.departments as RawRelation);
  return text(department?.name);
}

function profileName(row: RawRow, key = 'profiles') {
  return text(firstRelation(row[key] as RawRelation)?.full_name);
}

function event(params: CalendarEvent): CalendarEvent {
  return params;
}

function canMutate(scope: HospitalCalendarScope) {
  return scope.canMutate;
}

function openActionLabel(sourceType: CalendarEventType, status: CalendarEventStatus) {
  if (status === 'completed') return `View ${formatCalendarLabel(sourceType)} record`;
  if (status === 'overdue') return 'Review overdue item';
  if (status === 'on_hold') return 'Resolve blocker';
  if (status === 'in_progress') return 'View progress';
  return `Open ${formatCalendarLabel(sourceType)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Unknown source error';
}

function warningHint(source: CalendarSourceKey, message: string, fallback?: string) {
  const lower = message.toLowerCase();
  if (source === 'installation' && (lower.includes('installation_requests') || lower.includes('relation') || lower.includes('schema cache'))) {
    return SOURCE_HINTS.installation;
  }
  if (source === 'specification' && (lower.includes('specification_requests') || lower.includes('relation') || lower.includes('schema cache'))) {
    return SOURCE_HINTS.specification;
  }
  if (source === 'pm' && (lower.includes('completed_at') || lower.includes('started_at') || lower.includes('deferred_until') || lower.includes('schema cache'))) {
    return SOURCE_HINTS.pm;
  }
  if (lower.includes('more than one relationship') || lower.includes('ambiguous')) {
    return 'Calendar query needs an explicit Supabase foreign-key relationship hint.';
  }
  return fallback;
}

async function source<T>(warnings: CalendarSourceWarning[], config: CalendarSourceConfig, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    const message = errorMessage(error);
    console.warn(`[calendar] Failed to load ${config.source} events`, error);
    warnings.push({
      source: config.source,
      label: config.label,
      message,
      hint: warningHint(config.source, message, config.hint),
    });
    return [];
  }
}

async function fetchPMCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const { data, error } = await supabase
    .from('pm_schedules')
    .select(`
      id, plan_id, asset_id, scheduled_date, status, assigned_to, notes, completed_at, started_at, deferred_until,
      pm_plans(id, name, frequency_days),
      equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
      assigned_to_profile:profiles!pm_schedules_assigned_to_fkey(id, full_name, email)
    `)
    .order('scheduled_date', { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);

  return ((data ?? []) as RawRow[]).flatMap((row) => {
    const scheduledDate = dateOnly(row.scheduled_date);
    if (!scheduledDate) return [];
    const plan = firstRelation(row.pm_plans as RawRelation);
    const assigned = firstRelation(row.assigned_to_profile as RawRelation);
    const asset = assetFrom(row);
    const rawStatus = text(row.status) ?? 'scheduled';
    const status = ACTIVE_PM_STATUSES.includes(rawStatus) && isPastDate(scheduledDate)
      ? 'overdue'
      : normalizeStatus(rawStatus, scheduledDate);
    const planName = text(plan?.name) ?? 'Preventive maintenance';
    return [
      event({
        id: `pm_schedules:${row.id}:scheduled`,
        sourceType: 'pm',
        sourceTable: 'pm_schedules',
        sourceId: String(row.id),
        title: `${planName}`,
        subtitle: asset.assetName,
        description: text(row.notes),
        startDate: scheduledDate,
        endDate: dateOnly(row.completed_at),
        allDay: true,
        status,
        criticality: asset.criticality,
        departmentName: asset.departmentName,
        assetId: asset.assetId,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        assignedToName: text(assigned?.full_name),
        href: pmCalendarHref(String(row.id)),
        actionLabel: status === 'completed' ? 'Open PM evidence' : status === 'overdue' ? 'Open PM schedule' : 'Open PM schedule',
        canMutate: canMutate(scope),
        metadata: {
          planId: text(row.plan_id),
          rawStatus,
          assignedProfileId: text(row.assigned_to),
          startedAt: dateOnly(row.started_at),
          completedAt: dateOnly(row.completed_at),
          deferredUntil: dateOnly(row.deferred_until),
        },
      }),
    ];
  });
}

async function fetchCalibrationCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const [records, requests] = await Promise.all([
    supabase
      .from('calibration_records')
      .select(`
        id, asset_id, calibration_type_id, calibration_date, next_due_date, result, notes, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
        calibration_types(id, name, interval_months)
      `)
      .order('calibration_date', { ascending: false })
      .limit(1000),
    supabase
      .from('calibration_requests')
      .select(`
        id, request_number, asset_id, requested_by, calibration_type_id, urgency, status, notes, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
        calibration_types(id, name, interval_months)
      `)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (records.error) throw new Error(records.error.message);
  if (requests.error) throw new Error(requests.error.message);

  const recordEvents = ((records.data ?? []) as RawRow[]).flatMap((row) => {
    const asset = assetFrom(row);
    const type = firstRelation(row.calibration_types as RawRelation);
    const typeName = text(type?.name) ?? 'Calibration';
    const calibrationDate = dateOnly(row.calibration_date);
    const dueDate = dateOnly(row.next_due_date);
    const items: CalendarEvent[] = [];
    if (calibrationDate) {
      items.push(event({
        id: `calibration_records:${row.id}:completed`,
        sourceType: 'calibration',
        sourceTable: 'calibration_records',
        sourceId: String(row.id),
        title: `${typeName} completed`,
        subtitle: asset.assetName,
        description: text(row.notes),
        startDate: calibrationDate,
        allDay: true,
        status: 'completed',
        criticality: asset.criticality,
        departmentName: asset.departmentName,
        assetId: asset.assetId,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        href: calibrationCalendarHref({ recordId: String(row.id), assetId: asset.assetId }),
        actionLabel: 'Open calibration context',
        canMutate: canMutate(scope),
        metadata: { result: text(row.result) },
      }));
    }
    if (dueDate) {
      const status = isPastDate(dueDate) ? 'overdue' : isWithinDays(dueDate, 30) ? 'due_soon' : 'scheduled';
      items.push(event({
        id: `calibration_records:${row.id}:next_due`,
        sourceType: 'calibration',
        sourceTable: 'calibration_records',
        sourceId: String(row.id),
        title: `${typeName} due`,
        subtitle: asset.assetName,
        description: text(row.notes),
        startDate: dueDate,
        allDay: true,
        status,
        criticality: asset.criticality,
        departmentName: asset.departmentName,
        assetId: asset.assetId,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        href: calibrationCalendarHref({ recordId: String(row.id), assetId: asset.assetId }),
        actionLabel: 'Open calibration context',
        canMutate: canMutate(scope),
        metadata: { result: text(row.result), sourceDate: 'next_due_date' },
      }));
    }
    return items;
  });

  const requestEvents = ((requests.data ?? []) as RawRow[]).flatMap((row) => {
    const created = dateOnly(row.created_at);
    if (!created) return [];
    const asset = assetFrom(row);
    const type = firstRelation(row.calibration_types as RawRelation);
    const typeName = text(type?.name) ?? 'Calibration request';
    return [event({
      id: `calibration_requests:${row.id}:created`,
      sourceType: 'calibration',
      sourceTable: 'calibration_requests',
      sourceId: String(row.id),
      title: `${typeName} request`,
      subtitle: text(row.request_number) ?? asset.assetName,
      description: text(row.notes),
      startDate: created,
      allDay: true,
      status: normalizeStatus(row.status, created),
      priority: text(row.urgency),
      criticality: asset.criticality,
      departmentName: asset.departmentName,
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      href: calibrationCalendarHref({ requestId: String(row.id), assetId: asset.assetId }),
      actionLabel: 'Open calibration request context',
      canMutate: canMutate(scope),
    })];
  });

  return [...recordEvents, ...requestEvents];
}

async function fetchWorkOrderCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      id, work_order_number, request_id, asset_id, assigned_to, status, priority, work_type,
      root_cause, action_taken, closure_notes, started_at, completed_at, created_at,
      equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
      profiles!work_orders_assigned_to_fkey(id, full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  return ((data ?? []) as RawRow[]).flatMap((row) => {
    const asset = assetFrom(row);
    const created = dateOnly(row.created_at);
    const started = dateOnly(row.started_at);
    const completed = dateOnly(row.completed_at);
    const primaryDate = completed ?? started ?? created;
    if (!primaryDate) return [];
    const status = normalizeStatus(row.status, primaryDate);
    return [event({
      id: `work_orders:${row.id}:primary`,
      sourceType: 'work_order',
      sourceTable: 'work_orders',
      sourceId: String(row.id),
      title: text(row.work_order_number) ?? 'Work order',
      subtitle: asset.assetName,
      description: text(row.closure_notes) ?? text(row.action_taken) ?? text(row.root_cause),
      startDate: primaryDate,
      endDate: completed,
      allDay: true,
      status,
      priority: text(row.priority),
      criticality: asset.criticality,
      departmentName: asset.departmentName,
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      assignedToName: profileName(row),
      href: workOrderCalendarHref(String(row.id)),
      actionLabel: openActionLabel('work_order', status),
      canMutate: canMutate(scope),
      metadata: {
        workType: text(row.work_type),
        assignedProfileId: text(row.assigned_to),
        createdAt: created,
        startedAt: started,
        completedAt: completed,
      },
    })];
  });
}

async function fetchMaintenanceRequestCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select(`
      id, request_number, asset_id, requested_by, department_id, fault_description, urgency, status, resolved_at, notes, created_at,
      equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
      departments(id, name, code)
    `)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  return ((data ?? []) as RawRow[]).flatMap((row) => {
    const created = dateOnly(row.created_at);
    if (!created) return [];
    const asset = assetFrom(row);
    const status = normalizeStatus(row.status, created);
    return [event({
      id: `maintenance_requests:${row.id}:created`,
      sourceType: 'maintenance_request',
      sourceTable: 'maintenance_requests',
      sourceId: String(row.id),
      title: text(row.request_number) ?? 'Maintenance request',
      subtitle: asset.assetName,
      description: text(row.fault_description) ?? text(row.notes),
      startDate: dateOnly(row.resolved_at) ?? created,
      allDay: true,
      status: text(row.status) === 'completed' ? 'completed' : status,
      priority: text(row.urgency),
      criticality: asset.criticality,
      departmentName: asset.departmentName ?? departmentFrom(row),
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      href: maintenanceRequestCalendarHref(String(row.id)),
      actionLabel: openActionLabel('maintenance_request', status),
      canMutate: canMutate(scope),
      metadata: { createdAt: created, resolvedAt: dateOnly(row.resolved_at) },
    })];
  });
}

async function fetchTrainingCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const [sessions, requests] = await Promise.all([
    supabase
      .from('training_sessions')
      .select(`
        id, title, asset_id, category_id, trainer, training_date, duration_hours, location, description, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
        equipment_categories(id, name, criticality_level)
      `)
      .order('training_date', { ascending: true })
      .limit(1000),
    supabase
      .from('training_requests')
      .select(`
        id, request_number, asset_id, requested_by, department_id, training_type, description, status, notes, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
        departments(id, name, code)
      `)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (sessions.error) throw new Error(sessions.error.message);
  if (requests.error) throw new Error(requests.error.message);

  const sessionEvents = ((sessions.data ?? []) as RawRow[]).flatMap((row) => {
    const date = dateOnly(row.training_date);
    if (!date) return [];
    const asset = assetFrom(row);
    return [event({
      id: `training_sessions:${row.id}:session`,
      sourceType: 'training',
      sourceTable: 'training_sessions',
      sourceId: String(row.id),
      title: text(row.title) ?? 'Training session',
      subtitle: asset.assetName ?? text(row.location),
      description: text(row.description),
      startDate: date,
      allDay: true,
      status: isPastDate(date) ? 'completed' : isWithinDays(date, 14) ? 'due_soon' : 'scheduled',
      criticality: asset.criticality,
      departmentName: asset.departmentName,
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      assignedToName: text(row.trainer),
      href: trainingCalendarHref({ sessionId: String(row.id), assetId: asset.assetId }),
      actionLabel: 'Open training session context',
      canMutate: canMutate(scope),
      metadata: { durationHours: typeof row.duration_hours === 'number' ? row.duration_hours : null, location: text(row.location) },
    })];
  });

  const requestEvents = ((requests.data ?? []) as RawRow[]).flatMap((row) => {
    const date = dateOnly(row.created_at);
    if (!date) return [];
    const asset = assetFrom(row);
    const status = normalizeStatus(row.status, date);
    return [event({
      id: `training_requests:${row.id}:created`,
      sourceType: 'training',
      sourceTable: 'training_requests',
      sourceId: String(row.id),
      title: `${formatCalendarLabel(text(row.training_type))} training request`,
      subtitle: text(row.request_number) ?? asset.assetName,
      description: text(row.description) ?? text(row.notes),
      startDate: date,
      allDay: true,
      status,
      departmentName: asset.departmentName ?? departmentFrom(row),
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      href: trainingCalendarHref({ requestId: String(row.id), assetId: asset.assetId }),
      actionLabel: openActionLabel('training', status),
      canMutate: canMutate(scope),
    })];
  });

  return [...sessionEvents, ...requestEvents];
}

async function fetchInstallationCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const [requests, records] = await Promise.all([
    supabase
      .from('installation_requests')
      .select(`
        id, request_number, asset_id, equipment_name, vendor, status, priority, installation_reason,
        received_date, requested_installation_date, scheduled_date, target_go_live_date, completed_at, assigned_to, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
        departments(id, name, code),
        assigned_to_profile:profiles!installation_requests_assigned_to_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('installation_records')
      .select(`
        id, asset_id, installed_by, installation_date, commissioning_date, go_live_date, initial_training_done, notes, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level))
      `)
      .order('installation_date', { ascending: false })
      .limit(1000),
  ]);
  if (requests.error) throw new Error(requests.error.message);
  if (records.error) throw new Error(records.error.message);

  const requestEvents = ((requests.data ?? []) as RawRow[]).flatMap((row) => {
    const asset = assetFrom(row);
    const assigned = firstRelation(row.assigned_to_profile as RawRelation);
    const entries = [
      { key: 'received_date', label: 'Received for installation', date: dateOnly(row.received_date) },
      { key: 'requested_installation_date', label: 'Installation requested', date: dateOnly(row.requested_installation_date) ?? dateOnly(row.created_at) },
      { key: 'scheduled_date', label: 'Installation scheduled', date: dateOnly(row.scheduled_date) },
      { key: 'target_go_live_date', label: 'Target go-live', date: dateOnly(row.target_go_live_date) },
      { key: 'completed_at', label: 'Installation request completed', date: dateOnly(row.completed_at) },
    ];
    return entries.flatMap(({ key, label, date }) => {
      if (!date) return [];
      const status = key === 'completed_at' ? 'completed' : normalizeStatus(row.status, date);
      return [event({
        id: `installation_requests:${row.id}:${key}`,
        sourceType: 'installation',
        sourceTable: 'installation_requests',
        sourceId: String(row.id),
        title: label,
        subtitle: asset.assetName ?? text(row.equipment_name),
        description: text(row.installation_reason),
        startDate: date,
        allDay: true,
        status,
        priority: text(row.priority),
        criticality: asset.criticality,
        departmentName: asset.departmentName ?? departmentFrom(row),
        assetId: asset.assetId,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        assignedToName: text(assigned?.full_name),
        href: installationRequestCalendarHref(String(row.id)),
        actionLabel: openActionLabel('installation', status),
        canMutate: canMutate(scope),
        metadata: { vendor: text(row.vendor), sourceDate: key, assignedProfileId: text(row.assigned_to) },
      })];
    });
  });

  const recordEvents = ((records.data ?? []) as RawRow[]).flatMap((row) => {
    const asset = assetFrom(row);
    const entries = [
      { key: 'installation_date', label: 'Installation completed', date: dateOnly(row.installation_date) },
      { key: 'commissioning_date', label: 'Commissioning completed', date: dateOnly(row.commissioning_date) },
      { key: 'go_live_date', label: 'Equipment go-live', date: dateOnly(row.go_live_date) },
    ];
    return entries.flatMap(({ key, label, date }) => {
      if (!date) return [];
      return [event({
        id: `installation_records:${row.id}:${key}`,
        sourceType: 'installation',
        sourceTable: 'installation_records',
        sourceId: String(row.id),
        title: label,
        subtitle: asset.assetName,
        description: text(row.notes),
        startDate: date,
        allDay: true,
        status: 'completed',
        criticality: asset.criticality,
        departmentName: asset.departmentName,
        assetId: asset.assetId,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        assignedToName: text(row.installed_by),
        href: installationRecordCalendarHref(String(row.id), asset.assetId),
        actionLabel: 'Open installation record context',
        canMutate: canMutate(scope),
        metadata: { sourceDate: key },
      })];
    });
  });

  return [...requestEvents, ...recordEvents];
}

async function fetchProcurementCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const { data, error } = await supabase
    .from('procurement_requests')
    .select(`
      id, request_number, title, justification, status, priority, requested_by, department_id, expected_delivery_date, created_at,
      departments(id, name, code),
      profiles!procurement_requests_requested_by_fkey(id, full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  return ((data ?? []) as RawRow[]).flatMap((row) => {
    const items: CalendarEvent[] = [];
    const created = dateOnly(row.created_at);
    const expected = dateOnly(row.expected_delivery_date);
    if (created) {
      const status = normalizeStatus(row.status, created);
      items.push(event({
        id: `procurement_requests:${row.id}:created`,
        sourceType: 'procurement',
        sourceTable: 'procurement_requests',
        sourceId: String(row.id),
        title: text(row.title) ?? text(row.request_number) ?? 'Procurement request',
        subtitle: text(row.request_number),
        description: text(row.justification),
        startDate: created,
        allDay: true,
        status,
        priority: text(row.priority),
        departmentName: departmentFrom(row),
        assignedToName: profileName(row),
        href: procurementCalendarHref(String(row.id)),
        actionLabel: openActionLabel('procurement', status),
        canMutate: canMutate(scope),
        metadata: { sourceDate: 'created_at' },
      }));
    }
    if (expected) {
      const rawStatus = text(row.status) ?? 'requested';
      const status: CalendarEventStatus = isPastDate(expected) && !TERMINAL_STATUSES.includes(rawStatus) && rawStatus !== 'delivered'
        ? 'delayed'
        : normalizeStatus(rawStatus, expected);
      items.push(event({
        id: `procurement_requests:${row.id}:expected_delivery`,
        sourceType: 'procurement',
        sourceTable: 'procurement_requests',
        sourceId: String(row.id),
        title: `${text(row.title) ?? 'Procurement'} expected delivery`,
        subtitle: text(row.request_number),
        description: text(row.justification),
        startDate: expected,
        allDay: true,
        status,
        priority: text(row.priority),
        departmentName: departmentFrom(row),
        assignedToName: profileName(row),
        href: procurementCalendarHref(String(row.id)),
        actionLabel: openActionLabel('procurement', status),
        canMutate: canMutate(scope),
        metadata: { sourceDate: 'expected_delivery_date' },
      }));
    }
    return items;
  });
}

async function fetchDisposalCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const [requests, disposed] = await Promise.all([
    supabase
      .from('disposal_requests')
      .select(`
        id, request_number, asset_id, requested_by, reason, disposal_method_proposed, status, approved_at, notes, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
        requested_by_profile:profiles!disposal_requests_requested_by_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('disposed_assets')
      .select(`
        id, asset_id, disposal_request_id, disposal_date, disposal_method, disposal_value, disposed_by, notes, created_at,
        equipment_assets(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level))
      `)
      .order('disposal_date', { ascending: false })
      .limit(1000),
  ]);
  if (requests.error) throw new Error(requests.error.message);
  if (disposed.error) throw new Error(disposed.error.message);

  const requestEvents = ((requests.data ?? []) as RawRow[]).flatMap((row) => {
    const asset = assetFrom(row);
    const entries = [
      { key: 'created_at', label: 'Disposal review requested', date: dateOnly(row.created_at), status: normalizeStatus(row.status, dateOnly(row.created_at)) },
      { key: 'approved_at', label: 'Disposal approved', date: dateOnly(row.approved_at), status: 'approved' as CalendarEventStatus },
    ];
    return entries.flatMap(({ key, label, date, status }) => {
      if (!date) return [];
      return [event({
        id: `disposal_requests:${row.id}:${key}`,
        sourceType: 'disposal',
        sourceTable: 'disposal_requests',
        sourceId: String(row.id),
        title: label,
        subtitle: asset.assetName ?? text(row.request_number),
        description: text(row.reason) ?? text(row.notes),
        startDate: date,
        allDay: true,
        status,
        criticality: asset.criticality,
        departmentName: asset.departmentName,
        assetId: asset.assetId,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        assignedToName: profileName(row, 'requested_by_profile'),
        href: disposalCalendarHref(String(row.id)),
        actionLabel: openActionLabel('disposal', status),
        canMutate: canMutate(scope),
        metadata: { method: text(row.disposal_method_proposed), sourceDate: key },
      })];
    });
  });

  const disposedEvents = ((disposed.data ?? []) as RawRow[]).flatMap((row) => {
    const date = dateOnly(row.disposal_date);
    if (!date) return [];
    const asset = assetFrom(row);
    return [event({
      id: `disposed_assets:${row.id}:disposal_date`,
      sourceType: 'disposal',
      sourceTable: 'disposed_assets',
      sourceId: String(row.id),
      title: 'Asset disposed',
      subtitle: asset.assetName,
      description: text(row.notes),
      startDate: date,
      allDay: true,
      status: 'completed',
      criticality: asset.criticality,
      departmentName: asset.departmentName,
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      assignedToName: text(row.disposed_by),
      href: disposedAssetCalendarHref(String(row.id), text(row.disposal_request_id)),
      actionLabel: 'Open disposal context',
      canMutate: canMutate(scope),
      metadata: { method: text(row.disposal_method) },
    })];
  });

  return [...requestEvents, ...disposedEvents];
}

async function fetchDocumentCalendarEvents(supabase: Awaited<ReturnType<typeof createClient>>, scope: HospitalCalendarScope) {
  const { data, error } = await supabase
    .from('specification_requests')
    .select(`
      id, request_number, requested_by, department_id, asset_id, title, purpose, required_by, priority, status, assigned_to, completed_at, created_at,
      equipment_assets:equipment_assets!specification_requests_asset_id_fkey(id, asset_code, name, department_id, departments(id, name), equipment_categories(id, name, criticality_level)),
      departments(id, name, code),
      assigned_to_profile:profiles!specification_requests_assigned_to_fkey(id, full_name, email)
    `)
    .not('required_by', 'is', null)
    .order('required_by', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  return ((data ?? []) as RawRow[]).flatMap((row) => {
    const date = dateOnly(row.required_by);
    if (!date) return [];
    const asset = assetFrom(row);
    const assigned = firstRelation(row.assigned_to_profile as RawRelation);
    const status = normalizeStatus(row.status, date);
    return [event({
      id: `specification_requests:${row.id}:required_by`,
      sourceType: 'document',
      sourceTable: 'specification_requests',
      sourceId: String(row.id),
      title: text(row.title) ?? 'Specification request required',
      subtitle: text(row.request_number) ?? asset.assetName,
      description: text(row.purpose),
      startDate: date,
      endDate: dateOnly(row.completed_at),
      allDay: true,
      status,
      priority: text(row.priority),
      criticality: asset.criticality,
      departmentName: asset.departmentName ?? departmentFrom(row),
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      assignedToName: text(assigned?.full_name),
      href: documentCalendarHref({ requestId: String(row.id), assetId: asset.assetId }),
      actionLabel: openActionLabel('document', status),
      canMutate: canMutate(scope),
      metadata: { sourceDate: 'required_by', assignedProfileId: text(row.assigned_to) },
    })];
  });
}

function buildScope(profile: CalendarProfile, departmentName: string | null): HospitalCalendarScope {
  const roleNames = profile.roleNames?.length ? profile.roleNames : ['viewer'];
  const primaryRoleOrder: RoleName[] = ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'store_user', 'department_user', 'viewer'];
  const primaryRole = primaryRoleOrder.find((role) => roleNames.includes(role)) ?? roleNames[0] ?? 'viewer';
  return {
    profileId: profile.id,
    departmentId: profile.department_id ?? null,
    departmentName,
    roleNames,
    primaryRole,
    canMutate: !roleNames.includes('viewer') && roleNames.some((role) => role !== 'viewer'),
    canSeeAll: roleNames.some((role) => ['developer', 'admin', 'bme_head', 'viewer'].includes(role)),
  };
}

export async function fetchHospitalCalendarEvents(profile: CalendarProfile): Promise<HospitalCalendarData> {
  const supabase = await createClient();
  const warnings: CalendarSourceWarning[] = [];
  let departmentName: string | null = null;

  if (profile.department_id) {
    const department = await supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle();
    departmentName = text((department.data as RawRow | null)?.name);
  }

  const scope = buildScope(profile, departmentName);
  const eventGroups = await Promise.all([
    source(warnings, { source: 'pm', label: 'Preventive maintenance' }, () => fetchPMCalendarEvents(supabase, scope)),
    source(warnings, { source: 'calibration', label: 'Calibration' }, () => fetchCalibrationCalendarEvents(supabase, scope)),
    source(warnings, { source: 'work_orders', label: 'Work orders' }, () => fetchWorkOrderCalendarEvents(supabase, scope)),
    source(warnings, { source: 'maintenance_requests', label: 'Maintenance requests' }, () => fetchMaintenanceRequestCalendarEvents(supabase, scope)),
    source(warnings, { source: 'training', label: 'Training' }, () => fetchTrainingCalendarEvents(supabase, scope)),
    source(warnings, { source: 'installation', label: 'Installation', hint: SOURCE_HINTS.installation }, () => fetchInstallationCalendarEvents(supabase, scope)),
    source(warnings, { source: 'procurement', label: 'Procurement' }, () => fetchProcurementCalendarEvents(supabase, scope)),
    source(warnings, { source: 'disposal', label: 'Disposal' }, () => fetchDisposalCalendarEvents(supabase, scope)),
    source(warnings, { source: 'specification', label: 'Specification', hint: SOURCE_HINTS.specification }, () => fetchDocumentCalendarEvents(supabase, scope)),
  ]);

  return {
    events: sortCalendarEvents(eventGroups.flat()),
    warnings,
    scope,
  };
}
