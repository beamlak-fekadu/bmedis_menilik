'use server';

import { z } from 'zod';
import { recomputeAssetAnalytics } from './analytics.actions';
import { updateEquipmentConditionAction } from './equipment.actions';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';
import { OPEN_MAINTENANCE_REQUEST_STATUSES } from '@/utils/maintenance/request-status';

const requestSchema = z.object({
  asset_id: z.string().min(1),
  requested_by: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  fault_description: z.string().trim().min(10),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'approved', 'assigned', 'in_progress', 'completed', 'rejected', 'canceled']).optional(),
  notes: z.string().optional().nullable(),
  // Stored for audit: what condition the requester observed at time of request creation.
  // functional_issue = equipment works but has a problem (no condition change to equipment_assets).
  // needs_repair / non_functional = synced to equipment_assets.condition.
  reported_condition: z.enum(['functional_issue', 'needs_repair', 'non_functional']).optional().nullable(),
  reported_condition_source: z.string().optional().nullable(),
});

const workOrderSchema = z.object({
  request_id: z.string().optional().nullable(),
  asset_id: z.string().min(1),
  assigned_to: z.string().optional().nullable(),
  status: z.enum(['open', 'assigned', 'in_progress', 'on_hold', 'completed', 'canceled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  work_type: z.enum(['corrective', 'preventive', 'inspection', 'calibration', 'installation']),
  root_cause: z.string().optional().nullable(),
  action_taken: z.string().optional().nullable(),
  external_vendor: z.boolean().optional(),
  external_vendor_name: z.string().optional().nullable(),
  closure_notes: z.string().optional().nullable(),
  estimated_hours: z.coerce.number().optional().nullable(),
  actual_hours: z.coerce.number().optional().nullable(),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  // Completion outcome fields (migration 00039)
  completion_outcome: z.enum(['resolved', 'partially_resolved', 'not_resolved', 'awaiting_parts_or_vendor']).optional().nullable(),
  final_equipment_condition: z.enum(['functional', 'needs_repair', 'non_functional', 'under_maintenance']).optional().nullable(),
});

const eventSchema = z.object({
  work_order_id: z.string().optional().nullable(),
  asset_id: z.string().min(1),
  event_type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']),
  failure_date: z.string().optional().nullable(),
  downtime_start: z.string().optional().nullable(),
  downtime_end: z.string().optional().nullable(),
  repair_duration_hours: z.coerce.number().optional().nullable(),
  action_taken: z.string().optional().nullable(),
  failure_code_id: z.string().optional().nullable(),
  action_code_id: z.string().optional().nullable(),
  service_cost: z.coerce.number().optional().nullable(),
  completed_by: z.string().optional().nullable(),
  completion_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const maintenancePaths = ['/maintenance', '/work-orders', '/calendar', '/command', '/reports/maintenance', '/equipment'];

// Completion outcome → default final equipment condition
function outcomeToCondition(outcome: string): 'functional' | 'needs_repair' | 'non_functional' | 'under_maintenance' {
  switch (outcome) {
    case 'resolved': return 'functional';
    case 'partially_resolved': return 'needs_repair';
    case 'not_resolved': return 'non_functional';
    case 'awaiting_parts_or_vendor': return 'under_maintenance';
    default: return 'functional';
  }
}

function normalizeWorkOrder(payload: Record<string, unknown>) {
  const parsed = workOrderSchema.parse(payload);
  return {
    ...parsed,
    request_id: nullIfEmpty(parsed.request_id),
    assigned_to: nullIfEmpty(parsed.assigned_to),
    root_cause: nullIfEmpty(parsed.root_cause),
    action_taken: nullIfEmpty(parsed.action_taken),
    external_vendor: parsed.external_vendor ?? false,
    external_vendor_name: nullIfEmpty(parsed.external_vendor_name),
    closure_notes: nullIfEmpty(parsed.closure_notes),
    estimated_hours: parsed.estimated_hours ?? null,
    actual_hours: parsed.actual_hours ?? null,
    started_at: nullIfEmpty(parsed.started_at),
    completed_at: nullIfEmpty(parsed.completed_at),
    completion_outcome: parsed.completion_outcome ?? null,
    final_equipment_condition: parsed.final_equipment_condition ?? null,
  };
}

function normalizePartialWorkOrder(payload: Record<string, unknown>) {
  const parsed = workOrderSchema.partial().parse(payload);
  return {
    ...parsed,
    request_id: parsed.request_id === undefined ? undefined : nullIfEmpty(parsed.request_id),
    assigned_to: parsed.assigned_to === undefined ? undefined : nullIfEmpty(parsed.assigned_to),
    root_cause: parsed.root_cause === undefined ? undefined : nullIfEmpty(parsed.root_cause),
    action_taken: parsed.action_taken === undefined ? undefined : nullIfEmpty(parsed.action_taken),
    external_vendor_name: parsed.external_vendor_name === undefined ? undefined : nullIfEmpty(parsed.external_vendor_name),
    closure_notes: parsed.closure_notes === undefined ? undefined : nullIfEmpty(parsed.closure_notes),
    estimated_hours: parsed.estimated_hours === undefined ? undefined : parsed.estimated_hours ?? null,
    actual_hours: parsed.actual_hours === undefined ? undefined : parsed.actual_hours ?? null,
    started_at: parsed.started_at === undefined ? undefined : nullIfEmpty(parsed.started_at),
    completed_at: parsed.completed_at === undefined ? undefined : nullIfEmpty(parsed.completed_at),
  };
}

export async function createMaintenanceRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician', 'department_head', 'department_user']);
    if (error || !profile) return { success: false, error };
    const parsed = requestSchema.parse(payload);

    // Duplicate prevention: one active corrective request per asset at a time.
    // Closed statuses (completed/rejected/canceled) do not block new requests.
    const { data: existing } = await supabase
      .from('maintenance_requests')
      .select('id, request_number, status')
      .eq('asset_id', parsed.asset_id)
      .in('status', [...OPEN_MAINTENANCE_REQUEST_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: 'This equipment already has an open corrective maintenance request.',
        data: {
          reason: 'duplicate_open_request',
          existingRequestId: existing.id,
          existingRequestNumber: existing.request_number,
          existingRequestStatus: existing.status,
        },
      };
    }

    const data = {
      ...parsed,
      request_number: `MR-${Date.now().toString(36).toUpperCase()}`,
      requested_by: nullIfEmpty(parsed.requested_by) ?? profile.id,
      department_id: nullIfEmpty(parsed.department_id) ?? profile.department_id,
      notes: nullIfEmpty(parsed.notes),
      status: parsed.status ?? 'pending',
      reported_condition: parsed.reported_condition ?? null,
      reported_condition_source: nullIfEmpty(parsed.reported_condition_source),
    };

    const result = await supabase.from('maintenance_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({
      supabase, profileId: profile.id, action: 'maintenance_request.create',
      entityType: 'maintenance_requests', entityId: (result.data as { id?: string }).id ?? null,
      newValues: result.data as Record<string, unknown>,
    });

    // Sync equipment condition from reported_condition.
    // functional_issue = equipment still functional, no condition change needed.
    // needs_repair / non_functional = sync to equipment_assets.condition.
    if (parsed.reported_condition === 'needs_repair' || parsed.reported_condition === 'non_functional') {
      await updateEquipmentConditionAction(parsed.asset_id, parsed.reported_condition).catch(() => undefined);
    }

    revalidateMany([...maintenancePaths, `/equipment/${parsed.asset_id}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create maintenance request');
  }
}

export async function updateRequestStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician', 'department_head', 'department_user']);
    if (error || !profile) return { success: false, error };
    const parsedStatus = z.enum(['pending', 'approved', 'assigned', 'in_progress', 'completed', 'rejected', 'canceled']).parse(status);
    const oldRow = await supabase.from('maintenance_requests').select('*').eq('id', id).maybeSingle();
    const updateData: Record<string, unknown> = { status: parsedStatus };
    if (parsedStatus === 'completed') updateData.resolved_at = new Date().toISOString();
    const result = await supabase.from('maintenance_requests').update(updateData as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'maintenance_request.status_update', entityType: 'maintenance_requests', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany([...maintenancePaths, `/maintenance/requests/${id}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update maintenance request');
  }
}

export async function createWorkOrderAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const data = { ...normalizeWorkOrder(payload), work_order_number: `WO-${Date.now().toString(36).toUpperCase()}`, status: (payload.status as string | undefined) ?? 'open' };
    const result = await supabase.from('work_orders').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'work_order.create', entityType: 'work_orders', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(maintenancePaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create work order');
  }
}

export async function updateWorkOrderAction(id: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };

    // Parse completion fields separately (not in normalizePartialWorkOrder to keep schema stable)
    const completionOutcome = payload.completion_outcome as string | undefined;
    const finalEquipmentCondition = payload.final_equipment_condition as string | undefined;

    const data = normalizePartialWorkOrder(payload);
    const updatePayload: Record<string, unknown> = { ...data };
    if (completionOutcome !== undefined) updatePayload.completion_outcome = completionOutcome || null;
    if (finalEquipmentCondition !== undefined) updatePayload.final_equipment_condition = finalEquipmentCondition || null;

    const oldRow = await supabase.from('work_orders').select('*').eq('id', id).maybeSingle();
    const result = await supabase.from('work_orders').update(updatePayload as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: data.status ? 'work_order.status_update' : 'work_order.update', entityType: 'work_orders', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });

    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    if (assetId) {
      if (data.status === 'in_progress') {
        // Starting work: set equipment to under_maintenance
        await updateEquipmentConditionAction(assetId, 'under_maintenance').catch(() => undefined);
      } else if (data.status === 'completed') {
        // Completion: use explicit final_equipment_condition if provided, else derive from outcome
        const conditionToSet = (finalEquipmentCondition as 'functional' | 'needs_repair' | 'non_functional' | 'under_maintenance' | undefined)
          ?? (completionOutcome ? outcomeToCondition(completionOutcome) : 'functional');
        await updateEquipmentConditionAction(assetId, conditionToSet).catch(() => undefined);
        await recomputeAssetAnalytics(assetId).catch(() => undefined);
      }
      // on_hold: do not change condition — equipment remains under_maintenance or needs_repair
    }

    revalidateMany([...maintenancePaths, `/maintenance/work-orders/${id}`, ...(assetId ? [`/equipment/${assetId}`] : [])]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update work order');
  }
}

async function setWorkOrderAssignee(id: string, technicianProfileId: string, action: 'assign' | 'reassign'): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head']);
    if (error || !profile) return { success: false, error };
    const parsedId = z.string().min(1).parse(technicianProfileId);

    const technician = await supabase
      .from('profiles')
      .select('id, full_name, is_active, user_roles!inner(roles!inner(name))')
      .eq('id', parsedId)
      .eq('is_active', true)
      .eq('user_roles.roles.name', 'technician')
      .maybeSingle();
    if (technician.error) return { success: false, error: technician.error.message };
    if (!technician.data) return { success: false, error: 'Selected user is not an active technician' };

    const oldRow = await supabase.from('work_orders').select('*').eq('id', id).maybeSingle();
    const currentStatus = (oldRow.data as { status?: string } | null)?.status;
    if (currentStatus === 'completed' || currentStatus === 'canceled') {
      return { success: false, error: 'Terminal work orders cannot be reassigned' };
    }

    const updateData: Record<string, unknown> = { assigned_to: parsedId };
    if (currentStatus === 'open' || !currentStatus) updateData.status = 'assigned';

    const result = await supabase.from('work_orders').update(updateData as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: `work_order.${action}`,
      entityType: 'work_orders',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: result.data as Record<string, unknown>,
      details: { technician_profile_id: parsedId },
    });

    revalidateMany([...maintenancePaths, `/maintenance/work-orders/${id}`]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, action === 'assign' ? 'Failed to assign work order' : 'Failed to reassign work order');
  }
}

export async function assignWorkOrder(workOrderId: string, technicianProfileId: string): Promise<ActionResult> {
  return setWorkOrderAssignee(workOrderId, technicianProfileId, 'assign');
}

export async function reassignWorkOrder(workOrderId: string, technicianProfileId: string): Promise<ActionResult> {
  return setWorkOrderAssignee(workOrderId, technicianProfileId, 'reassign');
}

export async function createMaintenanceEventAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = eventSchema.parse(payload);
    const data = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, nullIfEmpty(value) ?? value]));
    const result = await supabase.from('maintenance_events').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'maintenance_event.create', entityType: 'maintenance_events', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    await recomputeAssetAnalytics(parsed.asset_id).catch(() => undefined);
    revalidateMany(maintenancePaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create maintenance event');
  }
}
