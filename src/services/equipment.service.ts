import { createClient } from '@/lib/supabase/client';
import type { EquipmentAsset } from '@/types/domain';
import { logAuditEvent } from './audit.service';

export interface EquipmentFilters {
  department_id?: string;
  category_id?: string;
  condition?: string;
  status?: string;
  search?: string;
}

const EQUIPMENT_SELECT = `
  id, asset_code, serial_number, name, model_id, category_id, department_id,
  manufacturer_id, vendor_id, supplier_id, installation_date, warranty_expiry,
  service_contract_expiry, condition, status, purchase_date, purchase_cost,
  source, notes, photo_url, created_at, updated_at,
  departments(id, name, code),
  equipment_categories(id, name, code, criticality_level),
  manufacturers(id, name, country),
  equipment_models(id, name)
`;

const EQUIPMENT_DETAIL_SELECT = `
  id, asset_code, serial_number, name, model_id, category_id, department_id,
  manufacturer_id, vendor_id, supplier_id, installation_date, warranty_expiry,
  service_contract_expiry, condition, status, purchase_date, purchase_cost,
  source, notes, photo_url, created_at, updated_at,
  departments(id, name, code),
  equipment_categories(id, name, code, criticality_level),
  manufacturers(id, name, country, contact_info),
  equipment_models(id, name, description),
  vendors(id, name, contact_person, phone, email),
  suppliers(id, name, contact_person, phone, email)
`;

export async function getEquipmentList(filters: EquipmentFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('equipment_assets')
    .select(EQUIPMENT_SELECT)
    .is('deleted_at', null);

  if (filters.department_id) query = query.eq('department_id', filters.department_id);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.condition) query = query.eq('condition', filters.condition);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,asset_code.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);

  return query.order('name', { ascending: true });
}

export async function getEquipmentById(id: string) {
  const supabase = createClient();
  return supabase
    .from('equipment_assets')
    .select(EQUIPMENT_DETAIL_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
}

export async function createEquipment(data: Omit<EquipmentAsset, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'department' | 'category' | 'manufacturer' | 'model'>) {
  const supabase = createClient();
  const normalizedAssetCode = data.asset_code.trim().toUpperCase();
  const normalizedName = data.name.trim();

  const { data: duplicateByCode } = await supabase
    .from('equipment_assets')
    .select('id')
    .eq('asset_code', normalizedAssetCode)
    .is('deleted_at', null)
    .limit(1);

  if (duplicateByCode && duplicateByCode.length > 0) {
    return {
      data: null,
      error: { message: 'Duplicate asset code detected. Please use a unique code.' },
    };
  }

  const result = await supabase
    .from('equipment_assets')
    .insert({
      ...data,
      asset_code: normalizedAssetCode,
      name: normalizedName,
    })
    .select(EQUIPMENT_SELECT)
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'equipment.create',
      entityType: 'equipment_assets',
      entityId: (result.data as Record<string, unknown> | null)?.id as string | null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}

export async function updateEquipment(id: string, data: Partial<Omit<EquipmentAsset, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'department' | 'category' | 'manufacturer' | 'model'>>) {
  const supabase = createClient();
  const oldRow = await supabase.from('equipment_assets').select(EQUIPMENT_SELECT).eq('id', id).single();
  const result = await supabase
    .from('equipment_assets')
    .update(data)
    .eq('id', id)
    .select(EQUIPMENT_SELECT)
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'equipment.update',
      entityType: 'equipment_assets',
      entityId: id,
      oldValues: (oldRow.data as Record<string, unknown> | null) ?? null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}

export async function deleteEquipment(id: string) {
  const supabase = createClient();
  const oldRow = await supabase.from('equipment_assets').select(EQUIPMENT_SELECT).eq('id', id).single();
  const result = await supabase
    .from('equipment_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'equipment.delete',
      entityType: 'equipment_assets',
      entityId: id,
      oldValues: (oldRow.data as Record<string, unknown> | null) ?? null,
      newValues: { deleted_at: true },
    });
  }

  return result;
}
