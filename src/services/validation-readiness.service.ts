// R34 (Phase 6): Validation dataset readiness check.
//
// Before evaluators sit down with BMEDIS, every workflow needs at least one
// row of data exercising it — otherwise correctly-wired features look broken
// because no rows surface. This service reports the presence/absence of each
// validation fixture so developers can spot empty paths BEFORE the demo.
//
// Each probe is read-only and uses the server Supabase client; it does NOT
// fabricate or seed data. If a fixture is missing, the developer creates one
// (manually or via the seed file) — this service only OBSERVES.

import type { SupabaseClient } from '@supabase/supabase-js';

export type FixtureStatus = 'present' | 'missing' | 'unknown';

export interface FixtureProbe {
  key: string;
  label: string;
  description: string;
  status: FixtureStatus;
  count: number | null;
  error: string | null;
  fixHint: string;
}

async function probe(
  label: string,
  key: string,
  description: string,
  fixHint: string,
  q: Promise<{ count: number | null; error: { message: string } | null }>,
): Promise<FixtureProbe> {
  try {
    const { count, error } = await q;
    if (error) {
      return { key, label, description, fixHint, status: 'unknown', count: null, error: error.message };
    }
    return {
      key,
      label,
      description,
      fixHint,
      status: (count ?? 0) > 0 ? 'present' : 'missing',
      count: count ?? 0,
      error: null,
    };
  } catch (err) {
    return {
      key,
      label,
      description,
      fixHint,
      status: 'unknown',
      count: null,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

export async function getValidationFixtureReadiness(
  supabase: SupabaseClient,
): Promise<FixtureProbe[]> {
  // Cutoffs used by the scheduled scanner (R1) so the readiness signal
  // matches what the notification scanner actually picks up.
  const agingCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const results = await Promise.all([
    probe(
      'Overdue PM schedule',
      'overdue_pm',
      'At least one row in v_overdue_pm.',
      'Create a PM schedule with scheduled_date in the past on /pm.',
      supabase.from('v_overdue_pm').select('*', { count: 'exact', head: true }) as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Aging work order (>14d open)',
      'aging_work_order',
      'At least one open work order older than the 14-day scanner cutoff.',
      'Open a corrective work order, then backdate created_at or leave one open for 2 weeks.',
      supabase
        .from('v_open_work_orders')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', agingCutoff) as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Spare part at zero stock',
      'stockout_part',
      'A spare_parts row with current_stock <= 0 and reorder_level > 0.',
      'Issue stock until current_stock reaches zero for one part.',
      supabase
        .from('spare_parts')
        .select('*', { count: 'exact', head: true })
        .lte('current_stock', 0)
        .gt('reorder_level', 0) as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Failed or adjusted calibration result',
      'failed_calibration',
      'A calibration_records row with result in (fail, adjusted).',
      'Record a failed calibration on /calibration.',
      supabase
        .from('calibration_records')
        .select('*', { count: 'exact', head: true })
        .in('result', ['fail', 'adjusted']) as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Procurement past expected_delivery_date',
      'delayed_procurement',
      'A procurement_requests row with expected_delivery_date in the past and status not delivered/canceled.',
      'Create a procurement request with expected_delivery_date set to last month.',
      supabase
        .from('procurement_requests')
        .select('*', { count: 'exact', head: true })
        .lt('expected_delivery_date', today)
        .not('status', 'in', '(delivered,canceled)') as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Equipment asset with attached QR label',
      'attached_qr_token',
      'An equipment_assets row with qr_label_status = attached.',
      'Generate, print, and mark a QR label attached on /equipment/qr-labels.',
      supabase
        .from('equipment_assets')
        .select('*', { count: 'exact', head: true })
        .eq('qr_label_status', 'attached') as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Equipment asset with revoked QR token',
      'revoked_qr_token',
      'An equipment_assets row with qr_label_status = revoked (test the public scan path).',
      "Revoke one asset's QR token on /equipment/[id]; scan it once to test R16 emission.",
      supabase
        .from('equipment_assets')
        .select('*', { count: 'exact', head: true })
        .eq('qr_label_status', 'revoked') as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'High-RPI replacement candidate',
      'high_rpi_replacement',
      'A replacement_priority_scores row with rpi >= 0.55 (review band).',
      'Run analytics refresh from Developer Lab. Seeded asset failure history determines RPI.',
      supabase
        .from('replacement_priority_scores')
        .select('*', { count: 'exact', head: true })
        .gte('rpi', 0.55) as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
    probe(
      'Offline sync event row',
      'offline_sync_event',
      'At least one offline_sync_events row for evidence reports.',
      'Queue any offline-capable action while the browser is offline, then reconnect.',
      supabase
        .from('offline_sync_events')
        .select('*', { count: 'exact', head: true }) as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
    ),
  ]);

  return results;
}
