'use server';

import { revalidatePath } from 'next/cache';
import { getActionContextForCapability, logServerAuditEvent, actionError, type ActionResult } from './_shared';

export async function prepareReportSnapshotAction(reportType: string): Promise<ActionResult<{ generatedAt: string; refreshStatus: string }>> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('reports.view');
    if (error || !profile) return { success: false, error };

    const generatedAt = new Date().toISOString();
    const refresh = await supabase.rpc('refresh_decision_support_snapshots');
    const refreshStatus = refresh.error ? `warning: ${refresh.error.message}` : 'refreshed';

    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'report.generate_snapshot',
      entityType: 'reports',
      entityId: reportType,
      details: { report_type: reportType, generated_at: generatedAt, refresh_status: refreshStatus },
    });

    revalidatePath('/reports');
    revalidatePath(`/reports/${reportType}`);
    return { success: true, data: { generatedAt, refreshStatus } };
  } catch (err) {
    return actionError(err, 'Failed to prepare report snapshot') as ActionResult<{ generatedAt: string; refreshStatus: string }>;
  }
}

// R33: audit-only action invoked from the client when a user actually
// triggers a download (PDF or CSV). The file itself is generated client-
// side; this action exists purely to record who exported what and when so
// governance/security has a trail.
export async function recordReportExportAction(input: {
  reportType: string;
  format: 'pdf' | 'csv';
  rowCount: number;
}): Promise<ActionResult> {
  try {
    const { supabase, profile, error } = await getActionContextForCapability('reports.export');
    if (error || !profile) return { success: false, error };
    if (!['pdf', 'csv'].includes(input.format)) {
      return { success: false, error: 'Invalid export format' };
    }
    await logServerAuditEvent({
      supabase,
      profileId: profile.id,
      action: 'report.exported',
      entityType: 'reports',
      entityId: input.reportType,
      details: {
        report_type: input.reportType,
        format: input.format,
        row_count: Number.isFinite(input.rowCount) ? input.rowCount : 0,
      },
    });
    return { success: true };
  } catch (err) {
    return actionError(err, 'Failed to record report export');
  }
}
