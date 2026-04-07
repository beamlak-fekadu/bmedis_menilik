import { createClient } from '@/lib/supabase/client';

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
  | 'scoring_weights';

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
  return supabase
    .from(table)
    .insert(data)
    .select('*')
    .single();
}

export async function update(table: ReferenceTable, id: string, data: Record<string, unknown>) {
  assertTable(table);
  const supabase = createClient();
  return supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select('*')
    .single();
}

export async function remove(table: ReferenceTable, id: string) {
  assertTable(table);
  const supabase = createClient();
  return supabase
    .from(table)
    .delete()
    .eq('id', id);
}
