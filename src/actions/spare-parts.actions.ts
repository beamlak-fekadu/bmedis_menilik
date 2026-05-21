'use server';

import { z } from 'zod';
import { getActionContextForCapability, logServerAuditEvent, refreshDecisionSupportSnapshotsBestEffort, revalidateMany, actionError, nullIfEmpty, interpretMissingMutationResult, type ActionResult } from './_shared';

const sparePaths = ['/spare-parts', '/logistics', '/command'];

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
    }).parse(payload);

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
      p_department_id: nullIfEmpty(parsed.department_id),
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
      },
    });
    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: 'stock_issue.create',
      entityType: 'stock_issues',
      entityId: rpcRow.issue_id,
    }).catch(() => undefined);

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

    revalidateMany(sparePaths);
    return {
      success: true,
      data: {
        id: rpcRow.issue_id,
        part_id: rpcRow.part_id,
        new_current_stock: rpcRow.new_current_stock,
        reorder_level: rpcRow.reorder_level,
        crossed_reorder: rpcRow.crossed_reorder,
        crossed_zero: rpcRow.crossed_zero,
      },
    };
  } catch (err) {
    return actionError(err, 'Failed to create stock issue');
  }
}
