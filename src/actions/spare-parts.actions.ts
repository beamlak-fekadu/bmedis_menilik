'use server';

import { z } from 'zod';
import { getActionContextForCapability, logServerAuditEvent, refreshDecisionSupportSnapshotsBestEffort, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

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
    const result = await supabase.from('spare_parts').update(payload as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
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
    }).parse(payload);
    const data = { ...parsed, received_by: nullIfEmpty(parsed.received_by) ?? profile.id, supplier_id: nullIfEmpty(parsed.supplier_id), invoice_ref: nullIfEmpty(parsed.invoice_ref), unit_cost: parsed.unit_cost ?? null, notes: nullIfEmpty(parsed.notes) };
    const receipt = await supabase.from('stock_receipts').insert(data as never).select('*').single();
    if (receipt.error) return { success: false, error: receipt.error.message };
    const part = await supabase.from('spare_parts').select('current_stock').eq('id', parsed.part_id).single();
    if (part.data) await supabase.from('spare_parts').update({ current_stock: Number(part.data.current_stock ?? 0) + parsed.quantity } as never).eq('id', parsed.part_id);
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'stock_receipt.create', entityType: 'stock_receipts', entityId: (receipt.data as { id?: string }).id ?? null, newValues: receipt.data as Record<string, unknown> });
    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: 'stock_receipt.create',
      entityType: 'stock_receipts',
      entityId: (receipt.data as { id?: string }).id ?? null,
    }).catch(() => undefined);
    revalidateMany(sparePaths);
    return { success: true, data: receipt.data };
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
    const part = await supabase.from('spare_parts').select('current_stock').eq('id', parsed.part_id).single();
    if (!part.data) return { success: false, error: 'Spare part not found' };
    if (Number(part.data.current_stock ?? 0) < parsed.quantity) return { success: false, error: 'Insufficient stock' };
    const data = { ...parsed, issued_by: nullIfEmpty(parsed.issued_by) ?? profile.id, issued_to_event_id: nullIfEmpty(parsed.issued_to_event_id), department_id: nullIfEmpty(parsed.department_id), notes: nullIfEmpty(parsed.notes) };
    const issue = await supabase.from('stock_issues').insert(data as never).select('*').single();
    if (issue.error) return { success: false, error: issue.error.message };
    await supabase.from('spare_parts').update({ current_stock: Number(part.data.current_stock ?? 0) - parsed.quantity } as never).eq('id', parsed.part_id);
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'stock_issue.create', entityType: 'stock_issues', entityId: (issue.data as { id?: string }).id ?? null, newValues: issue.data as Record<string, unknown> });
    await refreshDecisionSupportSnapshotsBestEffort({
      supabase,
      profileId: profile.id,
      reason: 'stock_issue.create',
      entityType: 'stock_issues',
      entityId: (issue.data as { id?: string }).id ?? null,
    }).catch(() => undefined);
    revalidateMany(sparePaths);
    return { success: true, data: issue.data };
  } catch (err) {
    return actionError(err, 'Failed to create stock issue');
  }
}
