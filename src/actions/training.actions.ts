'use server';

import { z } from 'zod';
import { getActionContext, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const trainingPaths = ['/training', '/calendar', '/reports/training'];

export async function createTrainingRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician', 'department_head', 'department_user']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().optional().nullable(),
      requested_by: z.string().optional().nullable(),
      department_id: z.string().optional().nullable(),
      training_type: z.enum(['equipment_operation', 'maintenance', 'safety', 'calibration', 'refresher', 'other']),
      description: z.string().trim().min(10),
      status: z.string().optional(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, request_number: `TR-${Date.now().toString(36).toUpperCase()}`, asset_id: nullIfEmpty(parsed.asset_id), requested_by: nullIfEmpty(parsed.requested_by) ?? profile.id, department_id: nullIfEmpty(parsed.department_id) ?? profile.department_id, status: parsed.status ?? 'pending', notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('training_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'training_request.create', entityType: 'training_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(trainingPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create training request');
  }
}

export async function createTrainingSessionAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      title: z.string().trim().min(3),
      asset_id: z.string().optional().nullable(),
      category_id: z.string().optional().nullable(),
      trainer: z.string().trim().min(1),
      training_date: z.string().min(1),
      duration_hours: z.coerce.number().optional().nullable(),
      location: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      max_participants: z.coerce.number().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, asset_id: nullIfEmpty(parsed.asset_id), category_id: nullIfEmpty(parsed.category_id), duration_hours: parsed.duration_hours ?? null, location: nullIfEmpty(parsed.location), description: nullIfEmpty(parsed.description), max_participants: parsed.max_participants ?? null };
    const result = await supabase.from('training_sessions').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'training_session.create', entityType: 'training_sessions', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(trainingPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create training session');
  }
}

export async function createStaffTrainingRecordAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContext(['admin', 'bme_head', 'technician']);
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      session_id: z.string().min(1),
      staff_user_id: z.string().optional().nullable(),
      staff_name: z.string().trim().min(1),
      status: z.enum(['registered', 'attended', 'absent', 'certified']),
      certification_date: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, staff_user_id: nullIfEmpty(parsed.staff_user_id), certification_date: nullIfEmpty(parsed.certification_date), notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('staff_training_records').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'staff_training_record.create', entityType: 'staff_training_records', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    revalidateMany(trainingPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create staff training record');
  }
}
