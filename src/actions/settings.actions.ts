'use server';

import { getActionContext, logServerAuditEvent, revalidateMany, actionError, type ActionResult } from './_shared';

export type ReferenceTable =
  | 'departments'
  | 'equipment_categories'
  | 'manufacturers'
  | 'equipment_models'
  | 'vendors'
  | 'suppliers'
  | 'failure_codes'
  | 'maintenance_action_codes'
  | 'calibration_types'
  | 'pm_templates'
  | 'scoring_weights'
  | 'memis_lookup_values';

const ALLOWED_TABLES = new Set<string>([
  'departments',
  'equipment_categories',
  'manufacturers',
  'equipment_models',
  'vendors',
  'suppliers',
  'failure_codes',
  'maintenance_action_codes',
  'calibration_types',
  'pm_templates',
  'scoring_weights',
  'memis_lookup_values',
]);

const settingsPaths = ['/settings', '/audit'];

function assertTable(table: string): asserts table is ReferenceTable {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table "${table}" is not an allowed reference table`);
}

export async function createReferenceRowAction(table: ReferenceTable, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    assertTable(table);
    const { supabase, profile, error } = await getActionContext(['admin']);
    if (error || !profile) return { success: false, error };
    const result = await supabase.from(table).insert(payload as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'reference.create', entityType: table, entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(settingsPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create reference row');
  }
}

export async function updateReferenceRowAction(table: ReferenceTable, id: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    assertTable(table);
    const { supabase, profile, error } = await getActionContext(['admin']);
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    const result = await supabase.from(table).update(payload as never).eq('id', id).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'reference.update', entityType: table, entityId: id, oldValues: oldRow.data as Record<string, unknown> | null, newValues: result.data as Record<string, unknown> });
    revalidateMany(settingsPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update reference row');
  }
}

export async function removeReferenceRowAction(table: ReferenceTable, id: string): Promise<ActionResult> {
  try {
    assertTable(table);
    const { supabase, profile, error } = await getActionContext(['admin']);
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    const result = await supabase.from(table).delete().eq('id', id);
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'reference.delete', entityType: table, entityId: id, oldValues: oldRow.data as Record<string, unknown> | null });
    revalidateMany(settingsPaths);
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to remove reference row');
  }
}
