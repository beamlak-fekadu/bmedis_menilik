'use server';

// QR identity server actions (Phase 1).
//
// All QR administration actions are gated to the equipment.edit capability,
// which in the CAPABILITY_MATRIX currently resolves to:
//   developer, admin (legacy), bme_head
// This intentionally mirrors who can already manage equipment metadata. QR
// admin is not a separate authorization plane from equipment admin.
//
// QR scanning, scan logging UI, and role-aware scan experiences are not in
// scope here; those land in later phases.

import { z } from 'zod';
import {
  getActionContextForCapability,
  logServerAuditEvent,
  revalidateMany,
  actionError,
  type ActionResult,
} from './_shared';
import {
  ensureAssetQrToken,
  regenerateAssetQrToken,
  markQrLabelPrinted,
  markQrLabelAttached,
  markQrLabelNeedsReplacement,
  revokeAssetQrToken,
  bulkGenerateMissingQrTokens,
  bulkMarkQrLabelsPrinted,
  bulkMarkQrLabelsAttached,
  bulkMarkQrLabelsNeedsReplacement,
  getAssetQrScanSummary,
  type EnsureQrTokenResult,
  type BulkGenerateResult,
  type BulkLabelUpdateResult,
} from '@/services/qr.service';
import type { AssetQrScanSummary } from '@/types/qr';

const assetIdSchema = z.string().uuid({ message: 'Invalid asset id' });
const reasonSchema = z.string().trim().max(500).optional().nullable();

const qrRevalidatePaths = ['/equipment', '/inventory', '/developer-lab', '/command', '/equipment/qr-labels', '/equipment/qr-coverage'];

function pathsForAsset(assetId: string) {
  return [...qrRevalidatePaths, `/equipment/${assetId}`, `/inventory/${assetId}`];
}

function failure<T>(message: string): ActionResult<T> {
  return { success: false, error: message };
}

function actionFailureFrom<T>(err: unknown, fallback: string): ActionResult<T> {
  if (typeof err === 'string') return failure<T>(err);
  if (err && typeof err === 'object' && 'message' in err) {
    return failure<T>(String((err as { message: unknown }).message));
  }
  return failure<T>(fallback);
}

export async function ensureAssetQrTokenAction(
  assetId: string,
): Promise<ActionResult<EnsureQrTokenResult>> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    const result = await ensureAssetQrToken(parsedId, supabase);

    if (result.created) {
      await logServerAuditEvent({
        supabase,
        profileId: profile.id,
        action: 'qr.token.generate',
        entityType: 'equipment_assets',
        entityId: parsedId,
        details: { status: 'generated' },
      });
    }

    revalidateMany(pathsForAsset(parsedId));
    return { success: true, data: result };
  } catch (err) {
    return actionFailureFrom<EnsureQrTokenResult>(err, 'Failed to generate QR token');
  }
}

export async function regenerateAssetQrTokenAction(
  assetId: string,
  reason?: string | null,
): Promise<ActionResult<EnsureQrTokenResult>> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const parsedReason = reasonSchema.parse(reason ?? null);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    const result = await regenerateAssetQrToken(parsedId, supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'qr.token.regenerate',
      entityType: 'equipment_assets',
      entityId: parsedId,
      details: { reason: parsedReason ?? null },
    });

    revalidateMany(pathsForAsset(parsedId));
    return { success: true, data: result };
  } catch (err) {
    return actionFailureFrom<EnsureQrTokenResult>(err, 'Failed to regenerate QR token');
  }
}

export async function markQrLabelPrintedAction(assetId: string): Promise<ActionResult> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    await markQrLabelPrinted(parsedId, supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'qr.label.printed',
      entityType: 'equipment_assets',
      entityId: parsedId,
    });

    revalidateMany(pathsForAsset(parsedId));
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to mark QR label printed');
  }
}

export async function markQrLabelAttachedAction(assetId: string): Promise<ActionResult> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    await markQrLabelAttached(parsedId, supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'qr.label.attached',
      entityType: 'equipment_assets',
      entityId: parsedId,
    });

    revalidateMany(pathsForAsset(parsedId));
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to mark QR label attached');
  }
}

export async function markQrLabelNeedsReplacementAction(
  assetId: string,
): Promise<ActionResult> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    await markQrLabelNeedsReplacement(parsedId, supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'qr.label.needs_replacement',
      entityType: 'equipment_assets',
      entityId: parsedId,
    });

    revalidateMany(pathsForAsset(parsedId));
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to flag QR label for replacement');
  }
}

export async function revokeQrTokenAction(assetId: string): Promise<ActionResult> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    await revokeAssetQrToken(parsedId, supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'qr.token.revoke',
      entityType: 'equipment_assets',
      entityId: parsedId,
    });

    revalidateMany(pathsForAsset(parsedId));
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to revoke QR token');
  }
}

const assetIdArraySchema = z
  .array(z.string().uuid({ message: 'Invalid asset id in selection' }))
  .min(1, 'Select at least one asset');

async function runBulkLabelAction(
  assetIds: string[],
  auditAction: string,
  handler: (ids: string[], supabase: Parameters<typeof bulkMarkQrLabelsPrinted>[1]) => Promise<BulkLabelUpdateResult>,
): Promise<ActionResult<BulkLabelUpdateResult>> {
  try {
    const parsed = assetIdArraySchema.parse(assetIds);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    const result = await handler(parsed, supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: auditAction,
      entityType: 'equipment_assets',
      details: { count: parsed.length, ...result },
    });

    revalidateMany([...qrRevalidatePaths, '/equipment/qr-labels']);
    return { success: true, data: result };
  } catch (err) {
    return actionFailureFrom<BulkLabelUpdateResult>(err, 'Bulk label update failed');
  }
}

export async function markQrLabelsPrintedBulkAction(assetIds: string[]) {
  return runBulkLabelAction(assetIds, 'qr.label.printed.bulk', bulkMarkQrLabelsPrinted);
}

export async function markQrLabelsAttachedBulkAction(assetIds: string[]) {
  return runBulkLabelAction(assetIds, 'qr.label.attached.bulk', bulkMarkQrLabelsAttached);
}

export async function markQrLabelsNeedsReplacementBulkAction(assetIds: string[]) {
  return runBulkLabelAction(assetIds, 'qr.label.needs_replacement.bulk', bulkMarkQrLabelsNeedsReplacement);
}

export async function bulkGenerateMissingQrTokensAction(): Promise<
  ActionResult<BulkGenerateResult>
> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    const result = await bulkGenerateMissingQrTokens(supabase);

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'qr.token.bulk_generate',
      entityType: 'equipment_assets',
      details: result as unknown as Record<string, unknown>,
    });

    revalidateMany(qrRevalidatePaths);
    return { success: true, data: result };
  } catch (err) {
    return actionFailureFrom<BulkGenerateResult>(err, 'Failed to bulk generate QR tokens');
  }
}

export async function getAssetQrScanSummaryAction(
  assetId: string,
): Promise<ActionResult<AssetQrScanSummary>> {
  try {
    const parsedId = assetIdSchema.parse(assetId);
    const { supabase, profile, error } = await getActionContextForCapability('equipment.edit');
    if (error || !profile) return { success: false, error };

    const result = await getAssetQrScanSummary(parsedId, supabase);
    return { success: true, data: result };
  } catch (err) {
    return actionFailureFrom<AssetQrScanSummary>(err, 'Failed to load QR scan evidence');
  }
}
