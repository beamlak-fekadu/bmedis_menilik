'use server';

import { z } from 'zod';
import { recomputeAssetAnalytics } from './analytics.actions';
import { getActionContextForCapability, logServerAuditEvent, revalidateMany, actionError, nullIfEmpty, interpretMissingMutationResult, type ActionResult } from './_shared';
import { ensureAssetQrToken } from '@/services/qr.service';

const equipmentSchema = z.object({
  asset_code: z.string().trim().min(1),
  serial_number: z.string().optional().nullable(),
  name: z.string().trim().min(1),
  category_id: z.string().min(1),
  department_id: z.string().min(1),
  manufacturer_id: z.string().optional().nullable(),
  model_id: z.string().optional().nullable(),
  vendor_id: z.string().optional().nullable(),
  supplier_id: z.string().optional().nullable(),
  installation_date: z.string().optional().nullable(),
  warranty_expiry: z.string().optional().nullable(),
  service_contract_expiry: z.string().optional().nullable(),
  condition: z.enum(['functional', 'needs_repair', 'non_functional', 'under_maintenance', 'decommissioned']),
  status: z.enum(['active', 'inactive', 'disposed', 'in_storage']).default('active'),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.coerce.number().nullable().optional(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
});

const equipmentRevalidatePaths = ['/equipment', '/inventory', '/command', '/reports/equipment'];

function normalizeEquipment(payload: Record<string, unknown>) {
  const parsed = equipmentSchema.parse(payload);
  return {
    ...parsed,
    asset_code: parsed.asset_code.trim().toUpperCase(),
    name: parsed.name.trim(),
    serial_number: nullIfEmpty(parsed.serial_number),
    manufacturer_id: nullIfEmpty(parsed.manufacturer_id),
    model_id: nullIfEmpty(parsed.model_id),
    vendor_id: nullIfEmpty(parsed.vendor_id),
    supplier_id: nullIfEmpty(parsed.supplier_id),
    installation_date: nullIfEmpty(parsed.installation_date),
    warranty_expiry: nullIfEmpty(parsed.warranty_expiry),
    service_contract_expiry: nullIfEmpty(parsed.service_contract_expiry),
    purchase_date: nullIfEmpty(parsed.purchase_date),
    purchase_cost: parsed.purchase_cost ?? null,
    source: nullIfEmpty(parsed.source),
    notes: nullIfEmpty(parsed.notes),
    photo_url: nullIfEmpty(parsed.photo_url),
  };
}

export async function createEquipmentAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('equipment.create');
    if (error || !profile) return { success: false, error };
    const data = normalizeEquipment(payload);

    const { data: duplicate } = await supabase
      .from('equipment_assets')
      .select('id')
      .eq('asset_code', data.asset_code)
      .is('deleted_at', null)
      .limit(1);
    if (duplicate && duplicate.length > 0) return { success: false, error: 'Duplicate asset code detected. Please use a unique code.' };

    const result = await supabase.from('equipment_assets').insert(data as never).select('*').single();
    if (result.error) return { success: false, error: result.error.message };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'equipment.create',
      entityType: 'equipment_assets',
      entityId: (result.data as { id?: string }).id ?? null,
      newValues: result.data as Record<string, unknown>,
    });
    const assetId = (result.data as { id?: string }).id;

    // R7: auto-generate the QR token on creation so newly registered
    // equipment has an identity immediately and QR coverage stays tight.
    // Printing/attaching the physical label remains an explicit admin step
    // (qr_label_status='generated'). Token-gen failure does not roll back
    // the asset insert — it's surfaced as a warning so the user can retry
    // via the Equipment Detail QR Identity panel.
    let qrTokenGenerationWarning: string | null = null;
    if (assetId) {
      try {
        const ensure = await ensureAssetQrToken(assetId, supabase);
        await logServerAuditEvent({
          supabase,
          profileId: profile.id,
          action: ensure.created
            ? 'qr.token.generated.auto'
            : 'qr.token.already_present_on_create',
          entityType: 'equipment_assets',
          entityId: assetId,
          details: { source: 'createEquipmentAction', token_was_created: ensure.created },
        });
      } catch (qrErr) {
        qrTokenGenerationWarning = qrErr instanceof Error ? qrErr.message : 'QR token generation failed';
        await logServerAuditEvent({
          supabase,
          profileId: profile.id,
          action: 'qr.token.auto_generation_failed',
          entityType: 'equipment_assets',
          entityId: assetId,
          details: { source: 'createEquipmentAction', error: qrTokenGenerationWarning },
        });
      }
    }

    // ANALYTICS-01: surface refresh failure (was silently swallowed).
    if (assetId) {
      try {
        await recomputeAssetAnalytics(assetId);
      } catch (refreshErr) {
        const message = refreshErr instanceof Error ? refreshErr.message : 'unknown';
        console.warn(`[analytics-01] equipment analytics refresh failed for ${assetId}: ${message}`);
        await logServerAuditEvent({
          supabase, profileId: profile.id,
          action: 'equipment.analytics_refresh_failed',
          entityType: 'equipment_assets', entityId: assetId,
          details: { error: message, source: 'create' },
        });
      }
    }
    revalidateMany(equipmentRevalidatePaths);
    return {
      success: true,
      data: qrTokenGenerationWarning
        ? { ...(result.data as Record<string, unknown>), qr_token_generation_warning: qrTokenGenerationWarning }
        : result.data,
    };
  } catch (err) {
    return actionError(err, 'Failed to create equipment');
  }
}

export async function updateEquipmentAction(id: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };
    const data = normalizeEquipment(payload);
    const oldRow = await supabase.from('equipment_assets').select('*').eq('id', id).maybeSingle();
    // SHAPE-01: maybeSingle handles RLS-filtered rows cleanly.
    const result = await supabase.from('equipment_assets').update(data as never).eq('id', id).select('*').maybeSingle();
    if (result.error) return { success: false, error: result.error.message };
    if (!result.data) {
      return interpretMissingMutationResult({
        entity: 'equipment asset',
        entityId: id,
        profileId: profile.id,
      });
    }

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'equipment.update',
      entityType: 'equipment_assets',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: result.data as Record<string, unknown>,
    });
    // ANALYTICS-01: surface refresh failure (was silently swallowed).
    let updateAnalyticsWarning: string | null = null;
    try {
      await recomputeAssetAnalytics(id);
    } catch (refreshErr) {
      const message = refreshErr instanceof Error ? refreshErr.message : 'unknown';
      updateAnalyticsWarning = `Equipment analytics refresh failed: ${message}. Metrics may be stale until the next scheduled refresh.`;
      await logServerAuditEvent({
        supabase, profileId: profile.id,
        action: 'equipment.analytics_refresh_failed',
        entityType: 'equipment_assets', entityId: id,
        details: { error: message, source: 'update' },
      });
    }
    revalidateMany([...equipmentRevalidatePaths, `/equipment/${id}`, `/inventory/${id}`]);
    return {
      success: true,
      data: updateAnalyticsWarning
        ? { ...(result.data as Record<string, unknown>), analytics_refresh_warning: updateAnalyticsWarning }
        : result.data,
    };
  } catch (err) {
    return actionError(err, 'Failed to update equipment');
  }
}

export async function updateEquipmentConditionAction(
  assetId: string,
  condition: 'functional' | 'needs_repair' | 'non_functional' | 'under_maintenance' | 'decommissioned',
): Promise<ActionResult> {
  try {
    // R5: capability-based gate replaces the legacy role allowlist. The
    // capability matrix grants `equipment.condition.update` to bme_head/admin/
    // technician/department_head/department_user — store_user and viewer are
    // intentionally excluded.
    const { supabase, profile, error } = await getActionContextForCapability('equipment.condition.update');
    if (error || !profile) return { success: false, error };
    const parsedCondition = z.enum(['functional', 'needs_repair', 'non_functional', 'under_maintenance', 'decommissioned']).parse(condition);

    // R5: route through the SECURITY DEFINER RPC introduced in migration 00059.
    // The RPC re-validates the caller's role at the DB layer (closing the
    // app/DB authorization gap from migration 00012) and writes its own audit
    // row. On RPC failure we audit and surface the error rather than silently
    // swallowing it.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'update_equipment_condition_secure',
      { p_asset_id: assetId, p_condition: parsedCondition },
    );

    if (rpcError) {
      await logServerAuditEvent({
        supabase,
        profileId: profile.id,
        action: 'equipment.condition_update_failed',
        entityType: 'equipment_assets',
        entityId: assetId,
        newValues: { condition: parsedCondition },
        details: { error: rpcError.message },
      });
      return { success: false, error: rpcError.message };
    }

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'equipment.condition_update',
      entityType: 'equipment_assets',
      entityId: assetId,
      newValues: { condition: parsedCondition, rpc_result: rpcData },
    });
    // ANALYTICS-01: refresh is best-effort but no longer silently swallowed.
    try {
      await recomputeAssetAnalytics(assetId);
    } catch (refreshErr) {
      const message = refreshErr instanceof Error ? refreshErr.message : 'unknown';
      console.warn(`[analytics-01] equipment analytics refresh failed for ${assetId}: ${message}`);
      await logServerAuditEvent({
        supabase, profileId: profile.id,
        action: 'equipment.analytics_refresh_failed',
        entityType: 'equipment_assets', entityId: assetId,
        details: { error: message },
      });
    }
    revalidateMany([...equipmentRevalidatePaths, `/equipment/${assetId}`]);
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to update equipment condition');
  }
}

export async function softDeleteEquipmentAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('equipment.delete');
    if (error || !profile) return { success: false, error };
    const oldRow = await supabase.from('equipment_assets').select('*').eq('id', id).maybeSingle();
    const result = await supabase
      .from('equipment_assets')
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select('id')
      .single();
    if (result.error) return { success: false, error: result.error.message };

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'equipment.delete',
      entityType: 'equipment_assets',
      entityId: id,
      oldValues: oldRow.data as Record<string, unknown> | null,
      newValues: { deleted_at: true },
    });
    revalidateMany(equipmentRevalidatePaths);
    return { success: true, data: result.data };
  } catch (err) {
    return actionError(err, 'Failed to delete equipment');
  }
}
