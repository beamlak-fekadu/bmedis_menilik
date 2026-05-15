'use server';

import { z } from 'zod';
import { recomputeAssetAnalytics } from './analytics.actions';
import { getActionContextForCapability, getActionContextForAnyCapability, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, type ActionResult } from './_shared';

const calibrationPaths = ['/calibration', '/calendar', '/command', '/reports/calibration'];

export async function updateCalibrationRequestStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    // Status update covers approve/reject/schedule transitions; allow approve
    // or schedule capability (technicians schedule, BME Head/admin approve).
    const { supabase, profile, error } = await getActionContextForAnyCapability([
      'calibration.request.approve',
      'calibration.schedule',
    ]);
    if (error || !profile) return { success: false, error };
    const parsedStatus = z.enum(['pending', 'approved', 'in_progress', 'completed', 'rejected', 'canceled']).parse(status);
    const oldRow = await supabase.from('calibration_requests').select('*').eq('id', id).maybeSingle();
    const result = await supabase
      .from('calibration_requests')
      .update({ status: parsedStatus } as never)
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'calibration_request.status_update',
      entityType: 'calibration_requests',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: result.data as Record<string, unknown>,
    });
    const assetId = (result.data as Record<string, unknown>).asset_id as string | undefined;
    revalidateMany([...calibrationPaths, `/calibration/requests/${id}`, ...(assetId ? [`/equipment/${assetId}`] : [])]);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to update calibration request');
  }
}

export async function createCalibrationRequestAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('calibration.request.create');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      requested_by: z.string().optional().nullable(),
      calibration_type_id: z.string().optional().nullable(),
      urgency: z.enum(['low', 'medium', 'high', 'critical']),
      status: z.string().optional(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, request_number: `CAL-${Date.now().toString(36).toUpperCase()}`, requested_by: nullIfEmpty(parsed.requested_by) ?? profile.id, calibration_type_id: nullIfEmpty(parsed.calibration_type_id), status: parsed.status ?? 'pending', notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('calibration_requests').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'calibration_request.create', entityType: 'calibration_requests', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    await recomputeAssetAnalytics(parsed.asset_id).catch(() => undefined);
    revalidateMany(calibrationPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create calibration request');
  }
}

export async function createCalibrationRecordAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('calibration.record_result');
    if (error || !profile) return { success: false, error };
    const parsed = z.object({
      asset_id: z.string().min(1),
      calibration_type_id: z.string().optional().nullable(),
      calibrated_by: z.string().optional().nullable(),
      calibration_date: z.string().min(1),
      next_due_date: z.string().optional().nullable(),
      result: z.enum(['pass', 'fail', 'adjusted']),
      certificate_path: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(payload);
    const data = { ...parsed, calibration_type_id: nullIfEmpty(parsed.calibration_type_id), calibrated_by: nullIfEmpty(parsed.calibrated_by), next_due_date: nullIfEmpty(parsed.next_due_date), certificate_path: nullIfEmpty(parsed.certificate_path), notes: nullIfEmpty(parsed.notes) };
    const result = await supabase.from('calibration_records').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };
    await logServerAuditEvent({ supabase, profileId: profile.id, action: 'calibration_record.create', entityType: 'calibration_records', entityId: (result.data as { id?: string }).id ?? null, newValues: result.data as Record<string, unknown> });
    await recomputeAssetAnalytics(parsed.asset_id).catch(() => undefined);
    revalidateMany(calibrationPaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to create calibration record');
  }
}
