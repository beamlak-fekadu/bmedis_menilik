import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from './audit.service';

type ReferenceTable =
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

const ALLOWED_TABLES: ReadonlySet<string> = new Set<ReferenceTable>([
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

function assertTable(table: string): asserts table is ReferenceTable {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table "${table}" is not an allowed reference table`);
  }
}

export async function getAll(table: ReferenceTable) {
  assertTable(table);
  const supabase = createClient();
  return supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false });
}

export async function getById(table: ReferenceTable, id: string) {
  assertTable(table);
  const supabase = createClient();
  return supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();
}

export async function create(table: ReferenceTable, data: Record<string, unknown>) {
  assertTable(table);
  const supabase = createClient();
  const result = await supabase
    .from(table)
    .insert(data)
    .select('*')
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'reference.create',
      entityType: table,
      entityId: (result.data as Record<string, unknown> | null)?.id as string | null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}

export async function update(table: ReferenceTable, id: string, data: Record<string, unknown>) {
  assertTable(table);
  const supabase = createClient();
  const oldRow = await supabase.from(table).select('*').eq('id', id).single();
  const result = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select('*')
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'reference.update',
      entityType: table,
      entityId: id,
      oldValues: (oldRow.data as Record<string, unknown> | null) ?? null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}

export async function remove(table: ReferenceTable, id: string) {
  assertTable(table);
  const supabase = createClient();
  const oldRow = await supabase.from(table).select('*').eq('id', id).single();
  const result = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (!result.error) {
    await logAuditEvent({
      action: 'reference.delete',
      entityType: table,
      entityId: id,
      oldValues: (oldRow.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}
