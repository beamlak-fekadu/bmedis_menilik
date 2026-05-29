'use server';

import { z } from 'zod';
import { getActionContextForCapability, logServerAuditEvent, refreshDecisionSupportSnapshotsBestEffort, revalidateMany, actionError, nullIfEmpty, interpretMissingMutationResult, type ActionResult } from './_shared';
import { createNotificationEvent } from '@/services/notifications/notification-engine';

const sparePaths = ['/spare-parts', '/logistics', '/command'];

type SpareActionClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;
type PartNeedContext = {
  id: string;
  work_order_id: string;
  spare_part_id: string;
  quantity_needed: number;
  declared_by: string | null;
  status: string;
};

function workOrderPriorityToNotificationPriority(priority: string | null | undefined): 'critical' | 'high' | 'medium' {
  if (priority === 'critical') return 'critical';
  if (priority === 'high') return 'high';
  return 'medium';
}

async function loadPartIssueContext(
  supabase: SpareActionClient,
  input: { partId: string; workOrderId?: string | null; needId?: string | null },
) {
  let need: PartNeedContext | null = null;

  if (input.needId) {
    const { data } = await supabase
      .from('work_order_parts_needed')
      .select('id, work_order_id, spare_part_id, quantity_needed, declared_by, status')
      .eq('id', input.needId)
      .maybeSingle();
    need = data as PartNeedContext | null;
  }

  const linkedWorkOrderId = input.workOrderId ?? need?.work_order_id ?? null;
  if (!need && linkedWorkOrderId) {
    const { data } = await supabase
      .from('work_order_parts_needed')
      .select('id, work_order_id, spare_part_id, quantity_needed, declared_by, status')
      .eq('work_order_id', linkedWorkOrderId)
      .eq('spare_part_id', input.partId)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    need = data as PartNeedContext | null;
  }

  const [partRow, workOrderRow] = await Promise.all([
    supabase
      .from('spare_parts')
      .select('id, part_code, name, current_stock, reorder_level')
      .eq('id', input.partId)
      .maybeSingle(),
    linkedWorkOrderId
      ? supabase
          .from('work_orders')
          .select('id, work_order_number, priority, assigned_to, asset_id')
          .eq('id', linkedWorkOrderId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const part = partRow.data as {
    id?: string;
    part_code?: string | null;
    name?: string | null;
    current_stock?: number | null;
    reorder_level?: number | null;
  } | null;
  const workOrder = workOrderRow.data as {
    id?: string;
    work_order_number?: string | null;
    priority?: string | null;
    assigned_to?: string | null;
    asset_id?: string | null;
  } | null;

  let assetSummary: { asset_name: string | null; asset_code: string | null; department_id: string | null } = {
    asset_name: null,
    asset_code: null,
    department_id: null,
  };
  if (workOrder?.asset_id) {
    const { data } = await supabase
      .from('equipment_assets')
      .select('name, asset_code, department_id')
      .eq('id', workOrder.asset_id)
      .maybeSingle();
    const asset = data as { name?: string | null; asset_code?: string | null; department_id?: string | null } | null;
    assetSummary = {
      asset_name: asset?.name ?? null,
      asset_code: asset?.asset_code ?? null,
      department_id: asset?.department_id ?? null,
    };
  }

  const requesterId = need?.declared_by ?? workOrder?.assigned_to ?? null;
  let requesterName: string | null = null;
  if (requesterId) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', requesterId)
      .maybeSingle();
    requesterName = ((data as { full_name?: string | null } | null)?.full_name ?? null);
  }

  return {
    need,
    part,
    workOrder,
    requesterId,
    requesterName,
    ...assetSummary,
  };
}

export async function createSparePartAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('spare_parts.manage');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      part_code: z.string().trim().min(1),
      name: z.string().trim().min(1),
      description: z.string().optional().nullable(),
      category: z.string().optional().nullable(),
      unit: z.string().optional().nullable(),
      reorder_level: z.coerce.number().int().min(0).optional(),
      current_stock: z.coerce.number().int().min(0).optional(),
      unit_cost: z.coerce.number().min(0).optional().nullable(),
      compatible_categories: z.unknown().optional().nullable(),
      is_active: z.boolean().optional(),
    }).parse(payload);
    const data = { ...parsed, part_code: parsed.part_code.toUpperCase(), description: nullIfEmpty(parsed.description), category: nullIfEmpty(parsed.category), unit: nullIfEmpty(parsed.unit), reorder_level: parsed.reorder_level ?? 0, current_stock: parsed.current_stock ?? 0, unit_cost: parsed.unit_cost ?? null, compatible_categories: parsed.compatible_categories ?? null, is_active: parsed.is_active ?? true };
    const result = await supabase.from('spare_parts').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'spare_part.create', entityType: 'spare_parts', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(sparePaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create spare part');
  }
}

export async function updateSparePartAction(id: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('spare_parts.manage');
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('spare_parts').select('*').eq('id', id).maybeSingle();
    // SHAPE-01: maybeSingle handles RLS-filtered rows cleanly.
    const result = await supabase.from('spare_parts').update(payload as never).eq('id', id).select('*').maybeSingle();
    if (result.error) return { success: false, error: result.error.message };
    if (!result.data) {
      return interpretMissingMutationResult({
        entity: 'spare part',
        entityId: id,
        profileId: profile.id,
      });
    }
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'spare_part.update', entityType: 'spare_parts', entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany(sparePaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update spare part');
  }
}

export async function createStockReceiptAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('stock.receive');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      part_id: z.string().min(1),
      quantity: z.coerce.number().int().min(1),
      received_by: z.string().optional().nullable(),
      received_date: z.string().min(1),
      supplier_id: z.string().optional().nullable(),
      invoice_ref: z.string().optional().nullable(),
      unit_cost: z.coerce.number().optional().nullable(),
      notes: z.string().optional().nullable(),
      // R21: optional linkage to the procurement request whose delivery this
      // receipt records. record_stock_receipt RPC persists it on the row.
      procurement_id: z.string().uuid().optional().nullable(),
    }).parse(payload);

    // R8: transactional path via record_stock_receipt RPC. Inserts the
    // stock_receipts row AND updates spare_parts.current_stock inside a
    // single SQL function with row-level locking — no more two-step race.
    const rpc = await (supabase.rpc as never as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{
      data: Array<{ receipt_id: string; part_id: string; new_current_stock: number; reorder_level: number; crossed_up?: boolean }> | null;
      error: { message: string } | null;
    }>)('record_stock_receipt', {
      p_part_id: parsed.part_id,
      p_quantity: parsed.quantity,
      p_received_by: nullIfEmpty(parsed.received_by) ?? profile.id,
      p_received_date: parsed.received_date,
      p_supplier_id: nullIfEmpty(parsed.supplier_id),
      p_invoice_ref: nullIfEmpty(parsed.invoice_ref),
      p_unit_cost: parsed.unit_cost ?? null,
      p_notes: nullIfEmpty(parsed.notes),
      p_procurement_id: nullIfEmpty(parsed.procurement_id),
    });

    if (rpc.error) return { success: false, error: rpc.error.message };
    const rpcRow = rpc.data?.[0];
    if (!rpcRow) return { success: false, error: 'Stock receipt RPC returned no row' };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'stock_receipt.create',
      entityType: 'stock_receipts',
      entityId: rpcRow.receipt_id,
      newValues: {
        part_id: rpcRow.part_id,
        quantity: parsed.quantity,
        new_current_stock: rpcRow.new_current_stock,
        procurement_id: nullIfEmpty(parsed.procurement_id) ?? null,
      },
    });
    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: 'stock_receipt.create',
      entityType: 'stock_receipts',
      entityId: rpcRow.receipt_id,
    }).catch(() => undefined);

    // R9: emit spare_part.restocked exactly once per crossing back up
    // above the reorder level. Migration 00065 returns crossed_up from
    // the RPC; pre-migration databases return undefined, which is
    // treated as no-crossing (honest fallback).
    if (rpcRow.crossed_up) {
      try {
        const { data: partRow } = await supabase
          .from('spare_parts')
          .select('name')
          .eq('id', rpcRow.part_id)
          .maybeSingle();
        const partName = (partRow as { name?: string | null } | null)?.name ?? null;
        const { emitNotificationEvent } = await import('@/services/notifications/notification-engine');
        await emitNotificationEvent({
          event_type: 'spare_part.restocked',
          source_table: 'spare_parts',
          source_id: rpcRow.part_id,
          priority: 'low',
          payload: {
            part_id: rpcRow.part_id,
            part_name: partName,
            on_hand: rpcRow.new_current_stock,
            reorder_level: rpcRow.reorder_level,
          },
        });
      } catch (e) {
        console.error('[notifications] spare_part.restocked emit failed:', e);
      }
    }

    revalidateMany(sparePaths);
    return {
      success: true,
      data: {
        id: rpcRow.receipt_id,
        part_id: rpcRow.part_id,
        new_current_stock: rpcRow.new_current_stock,
        reorder_level: rpcRow.reorder_level,
        crossed_up: rpcRow.crossed_up ?? false,
      },
    };
  } catch (err) {
    return actionError(err, 'Failed to create stock receipt');
  }
}

export async function createStockIssueAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('stock.issue');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      part_id: z.string().min(1),
      quantity: z.coerce.number().int().min(1),
      issued_to_event_id: z.string().optional().nullable(),
      issued_by: z.string().optional().nullable(),
      issue_date: z.string().min(1),
      department_id: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      work_order_id: z.string().optional().nullable(),
      need_id: z.string().optional().nullable(),
    }).parse(payload);
    const parsedWorkOrderId = parsed.work_order_id?.trim() || null;
    const parsedNeedId = parsed.need_id?.trim() || null;
    const parsedDepartmentId = parsed.department_id?.trim() || null;

    const issueContext = await loadPartIssueContext(supabase, {
      partId: parsed.part_id,
      workOrderId: parsedWorkOrderId,
      needId: parsedNeedId,
    });
    if (parsedNeedId && !issueContext.need) {
      return { success: false, error: 'Linked part need was not found; stock was not issued.' };
    }
    if (issueContext.need && issueContext.need.spare_part_id !== parsed.part_id) {
      return { success: false, error: 'Linked part need does not match the selected spare part; stock was not issued.' };
    }
    if (parsedNeedId && issueContext.need && issueContext.need.status !== 'open') {
      return { success: false, error: `Part need is already ${issueContext.need.status}; stock was not issued again.` };
    }

    // R8: transactional path via record_stock_issue RPC. Insufficient-stock
    // is enforced inside the same lock as the insert+update — concurrent
    // issues serialize on the spare_parts row.
    const rpc = await (supabase.rpc as never as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{
      data: Array<{
        issue_id: string;
        part_id: string;
        new_current_stock: number;
        reorder_level: number;
        crossed_reorder: boolean;
        crossed_zero: boolean;
      }> | null;
      error: { message: string; code?: string } | null;
    }>)('record_stock_issue', {
      p_part_id: parsed.part_id,
      p_quantity: parsed.quantity,
      p_issued_by: nullIfEmpty(parsed.issued_by) ?? profile.id,
      p_issue_date: parsed.issue_date,
      p_issued_to_event_id: nullIfEmpty(parsed.issued_to_event_id),
      p_department_id: parsedDepartmentId,
      p_notes: nullIfEmpty(parsed.notes),
    });

    if (rpc.error) {
      // R8: friendly error mapping for insufficient stock — the RPC raises
      // with ERRCODE='check_violation' so the actor sees a clean message.
      const msg = rpc.error.message ?? 'Stock issue RPC failed';
      if (msg.startsWith('Insufficient stock')) {
        return { success: false, error: msg };
      }
      return { success: false, error: msg };
    }
    const rpcRow = rpc.data?.[0];
    if (!rpcRow) return { success: false, error: 'Stock issue RPC returned no row' };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'stock_issue.create',
      entityType: 'stock_issues',
      entityId: rpcRow.issue_id,
      newValues: {
        part_id: rpcRow.part_id,
        quantity: parsed.quantity,
        new_current_stock: rpcRow.new_current_stock,
        crossed_reorder: rpcRow.crossed_reorder,
        crossed_zero: rpcRow.crossed_zero,
        work_order_id: parsedWorkOrderId ?? issueContext.workOrder?.id ?? null,
        need_id: parsedNeedId ?? issueContext.need?.id ?? null,
      },
    });
    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: 'stock_issue.create',
      entityType: 'stock_issues',
      entityId: rpcRow.issue_id,
    }).catch(() => undefined);

    let partNeedStatusWarning: string | null = null;
    const linkedNeed = issueContext.need;
    if (linkedNeed?.id && linkedNeed.status === 'open') {
      const update = await supabase
        .from('work_order_parts_needed')
        .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() } as never)
        .eq('id', linkedNeed.id)
        .eq('status', 'open')
        .select('*')
        .maybeSingle();
      if (update.error || !update.data) {
        partNeedStatusWarning = update.error?.message ?? 'Part need was not marked fulfilled.';
        await logServerAuditEvent({
          supabase,
          profileId: profile.id,
          action: 'stock_issue.part_need_fulfill_failed',
          entityType: 'work_order_parts_needed',
          entityId: linkedNeed.id,
          details: { stock_issue_id: rpcRow.issue_id, error: partNeedStatusWarning },
        });
      } else {
        await logServerAuditEvent({
          supabase,
          profileId: profile.id,
          action: 'stock_issue.part_need_fulfilled',
          entityType: 'work_order_parts_needed',
          entityId: linkedNeed.id,
          oldValues: linkedNeed as Record<string, unknown>,
          newValues: update.data as Record<string, unknown>,
          details: { stock_issue_id: rpcRow.issue_id },
        });
      }
    }

    if (issueContext.requesterId) {
      try {
        const workOrderId = issueContext.workOrder?.id ?? parsedWorkOrderId ?? issueContext.need?.work_order_id ?? null;
        await createNotificationEvent({
          event_type: 'work_order.part_issued',
          source_table: 'stock_issues',
          source_id: rpcRow.issue_id,
          asset_id: issueContext.workOrder?.asset_id ?? null,
          department_id: parsedDepartmentId ?? issueContext.department_id,
          priority: workOrderPriorityToNotificationPriority(issueContext.workOrder?.priority ?? null),
          dedupe_key: issueContext.need?.id
            ? `work_order.part_issued:${issueContext.need.id}`
            : `work_order.part_issued:${rpcRow.issue_id}`,
          payload: {
            issue_id: rpcRow.issue_id,
            need_id: issueContext.need?.id ?? parsedNeedId,
            work_order_id: workOrderId,
            work_order_number: issueContext.workOrder?.work_order_number ?? null,
            part_id: rpcRow.part_id,
            part_code: issueContext.part?.part_code ?? null,
            part_name: issueContext.part?.name ?? null,
            quantity_issued: parsed.quantity,
            quantity_needed: issueContext.need?.quantity_needed ?? null,
            requested_by: issueContext.requesterId,
            declared_by: issueContext.need?.declared_by ?? null,
            requester_name: issueContext.requesterName,
            assigned_to: issueContext.workOrder?.assigned_to ?? null,
            asset_name: issueContext.asset_name,
            asset_code: issueContext.asset_code,
            new_current_stock: rpcRow.new_current_stock,
            reorder_level: rpcRow.reorder_level,
          },
        });
      } catch (e) {
        console.error('[notifications] work_order.part_issued emit failed:', e);
      }
    }

    // R9: emit threshold-crossing events directly from the RPC's
    // authoritative post-update values. No scheduled scan needed for the
    // common case — this fires the instant a Store User issues stock that
    // crosses zero or the reorder level. Dedupe is handled by the
    // notification engine (10-min cooldown by recipient + event + source).
    if (rpcRow.crossed_zero || rpcRow.crossed_reorder) {
      try {
        // Load part name for the notification payload.
        const { data: partRow } = await supabase
          .from('spare_parts')
          .select('name')
          .eq('id', rpcRow.part_id)
          .maybeSingle();
        const partName = (partRow as { name?: string | null } | null)?.name ?? null;
        const { emitNotificationEvent } = await import('@/services/notifications/notification-engine');
        if (rpcRow.crossed_zero) {
          await emitNotificationEvent({
            event_type: 'spare_part.stockout',
            source_table: 'spare_parts',
            source_id: rpcRow.part_id,
            priority: 'high',
            payload: {
              part_id: rpcRow.part_id,
              part_name: partName,
              on_hand: rpcRow.new_current_stock,
              reorder_level: rpcRow.reorder_level,
            },
          });
        } else if (rpcRow.crossed_reorder) {
          await emitNotificationEvent({
            event_type: 'spare_part.low_stock',
            source_table: 'spare_parts',
            source_id: rpcRow.part_id,
            priority: 'medium',
            payload: {
              part_id: rpcRow.part_id,
              part_name: partName,
              on_hand: rpcRow.new_current_stock,
              reorder_level: rpcRow.reorder_level,
            },
          });
        }
      } catch (e) {
        console.error('[notifications] stock threshold-crossing emit failed:', e);
      }
    }

    const linkedWorkOrderId = issueContext.workOrder?.id ?? parsedWorkOrderId ?? issueContext.need?.work_order_id ?? null;
    revalidateMany([
      ...sparePaths,
      ...(linkedWorkOrderId ? [`/maintenance/work-orders/${linkedWorkOrderId}`, '/work-orders'] : []),
    ]);
    return {
      success: true,
      data: {
        id: rpcRow.issue_id,
        part_id: rpcRow.part_id,
        new_current_stock: rpcRow.new_current_stock,
        reorder_level: rpcRow.reorder_level,
        crossed_reorder: rpcRow.crossed_reorder,
        crossed_zero: rpcRow.crossed_zero,
        work_order_id: linkedWorkOrderId,
        need_id: issueContext.need?.id ?? parsedNeedId,
        ...(partNeedStatusWarning ? { part_need_status_warning: partNeedStatusWarning } : {}),
      },
    };
  } catch (err) {
    return actionError(err, 'Failed to create stock issue');
  }
}
