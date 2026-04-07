import { createClient } from '@/lib/supabase/client';
import type { TrainingSession, StaffTrainingRecord, TrainingRequest } from '@/types/database';

export interface TrainingSessionFilters {
  category_id?: string;
  asset_id?: string;
  date_from?: string;
  date_to?: string;
}

const SESSION_SELECT = `
  id, title, asset_id, category_id, trainer, training_date,
  duration_hours, location, description, max_participants, created_at, updated_at,
  equipment_assets(id, asset_code, name),
  equipment_categories(id, name)
`;

export async function getTrainingSessions(filters: TrainingSessionFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from('training_sessions')
    .select(SESSION_SELECT);

  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.asset_id) query = query.eq('asset_id', filters.asset_id);
  if (filters.date_from) query = query.gte('training_date', filters.date_from);
  if (filters.date_to) query = query.lte('training_date', filters.date_to);

  return query.order('training_date', { ascending: false });
}

export async function createTrainingSession(data: Omit<TrainingSession, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = createClient();
  return supabase
    .from('training_sessions')
    .insert(data)
    .select(SESSION_SELECT)
    .single();
}

export async function getStaffTrainingRecords(sessionId: string) {
  const supabase = createClient();
  return supabase
    .from('staff_training_records')
    .select('id, session_id, staff_user_id, staff_name, status, certification_date, notes, created_at')
    .eq('session_id', sessionId)
    .order('staff_name', { ascending: true });
}

export async function createStaffTrainingRecord(data: Omit<StaffTrainingRecord, 'id' | 'created_at'>) {
  const supabase = createClient();
  return supabase
    .from('staff_training_records')
    .insert(data)
    .select('id, session_id, staff_user_id, staff_name, status, certification_date, notes, created_at')
    .single();
}

export async function getTrainingRequests() {
  const supabase = createClient();
  return supabase
    .from('training_requests')
    .select(`
      id, request_number, asset_id, requested_by, department_id, training_type,
      description, status, notes, created_at, updated_at,
      equipment_assets(id, asset_code, name),
      departments(id, name)
    `)
    .order('created_at', { ascending: false });
}

export async function createTrainingRequest(data: Omit<TrainingRequest, 'id' | 'request_number' | 'created_at' | 'updated_at'>) {
  const supabase = createClient();
  const requestNumber = `TR-${Date.now().toString(36).toUpperCase()}`;
  return supabase
    .from('training_requests')
    .insert({ ...data, request_number: requestNumber })
    .select(`
      id, request_number, asset_id, requested_by, department_id, training_type,
      description, status, notes, created_at, updated_at
    `)
    .single();
}
