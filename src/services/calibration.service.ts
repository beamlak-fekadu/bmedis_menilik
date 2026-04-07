import { createClient } from '@/lib/supabase/client';
import type { CalibrationRecord, CalibrationRequest } from '@/types/database';

export interface CalibrationFilters {
  asset_id?: string;
  calibration_type_id?: string;
  result?: string;
}

const RECORD_SELECT = `
  id, asset_id, calibration_type_id, calibrated_by, calibration_date,
  next_due_date, result, certificate_path, notes, created_at, updated_at,
  equipment_assets(id, asset_code, name),
  calibration_types(id, name, interval_months)
`;

const REQUEST_SELECT = `
  id, request_number, asset_id, requested_by, calibration_type_id,
  urgency, status, notes, created_at, updated_at,
  equipment_assets(id, asset_code, name),
  calibration_types(id, name, interval_months)
`;

export async function getCalibrationRecords(filters: CalibrationFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('calibration_records')
    .select(RECORD_SELECT);

  if (filters.asset_id) query = query.eq('asset_id', filters.asset_id);
  if (filters.calibration_type_id) query = query.eq('calibration_type_id', filters.calibration_type_id);
  if (filters.result) query = query.eq('result', filters.result);

  return query.order('calibration_date', { ascending: false });
}

export async function createCalibrationRecord(data: Omit<CalibrationRecord, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = createClient();
  return supabase
    .from('calibration_records')
    .insert(data)
    .select(RECORD_SELECT)
    .single();
}

export async function getCalibrationRequests() {
  const supabase = createClient();
  return supabase
    .from('calibration_requests')
    .select(REQUEST_SELECT)
    .order('created_at', { ascending: false });
}

export async function createCalibrationRequest(data: Omit<CalibrationRequest, 'id' | 'request_number' | 'created_at' | 'updated_at'>) {
  const supabase = createClient();
  const requestNumber = `CAL-${Date.now().toString(36).toUpperCase()}`;
  return supabase
    .from('calibration_requests')
    .insert({ ...data, request_number: requestNumber })
    .select(REQUEST_SELECT)
    .single();
}

export async function getUpcomingCalibrations(days: number = 30) {
  const supabase = createClient();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return supabase
    .from('calibration_records')
    .select(RECORD_SELECT)
    .not('next_due_date', 'is', null)
    .lte('next_due_date', futureDate.toISOString().split('T')[0])
    .order('next_due_date', { ascending: true });
}
