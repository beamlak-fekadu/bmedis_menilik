// Edge Function: calculate-equipment-scores
//
// On-demand reliability + risk scoring for a single asset. Mirrors the
// pure formulas in src/utils/analytics/formulas.ts so the dashboard and
// the edge function stay numerically identical.
//
// Auth model: the request's Authorization header is forwarded to Supabase
// so RLS still applies. Service role is NOT used here — a viewer who can
// SELECT the asset can also score it; anyone else gets an empty result.
//
// Inputs (POST JSON):
//   { equipment_id: string, observation_days?: number = 365 }
//
// Output:
//   {
//     equipment_id, observation_window_days,
//     mtbf_hours, mttr_hours, availability_ratio,
//     failure_count, repair_count,
//     total_downtime_hours, total_operational_hours,
//     pmc_percent, pm_completed_count, pm_scheduled_count,
//     calibration: { last_result, last_calibration_date, next_due_date } | null,
//     rpn: { severity, occurrence, detectability, value, risk_level } | null,
//     computed_at
//   }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';

// ===========================================================================
// Ported from src/utils/analytics/formulas.ts (pure functions, no I/O)
// ===========================================================================

function computeRPN(severity: number, occurrence: number, detectability: number): number {
  if (
    severity < 1 || severity > 10 ||
    occurrence < 1 || occurrence > 10 ||
    detectability < 1 || detectability > 10
  ) {
    throw new Error('S, O, D values must be between 1 and 10');
  }
  return severity * occurrence * detectability;
}

function classifyRiskLevel(rpn: number): 'low' | 'medium' | 'high' | 'critical' {
  if (rpn >= 500) return 'critical';
  if (rpn >= 200) return 'high';
  if (rpn >= 80) return 'medium';
  return 'low';
}

function computeAvailability(mtbf: number, mttr: number): number | null {
  if (mtbf < 0 || mttr < 0) return null;
  const denominator = mtbf + mttr;
  if (denominator === 0) return null;
  return mtbf / denominator;
}

function computeMTBF(totalOperationalHours: number, failureCount: number): number | null {
  if (failureCount <= 0) return null;
  if (totalOperationalHours < 0) return null;
  return totalOperationalHours / failureCount;
}

function computeMTTR(totalMaintenanceHours: number, repairCount: number): number | null {
  if (repairCount <= 0) return null;
  if (totalMaintenanceHours < 0) return null;
  return totalMaintenanceHours / repairCount;
}

function computePMC(completedCount: number, scheduledCount: number): number | null {
  if (scheduledCount <= 0) return null;
  return (completedCount / scheduledCount) * 100;
}

// ===========================================================================
// HTTP handler
// ===========================================================================

interface RequestBody {
  equipment_id?: string;
  observation_days?: number;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(
      { status: 'error', error: 'Method not allowed. Use POST.' },
      { status: 405 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ status: 'error', error: 'Invalid JSON body.' }, { status: 400 });
  }

  const equipmentId = body.equipment_id?.trim();
  if (!equipmentId) {
    return jsonResponse(
      { status: 'error', error: 'equipment_id is required.' },
      { status: 400 },
    );
  }
  const observationDays =
    Number.isFinite(body.observation_days) && (body.observation_days as number) > 0
      ? Math.min(Math.floor(body.observation_days as number), 365 * 5)
      : 365;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(
      { status: 'error', error: 'SUPABASE_URL or SUPABASE_ANON_KEY missing in function environment.' },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - observationDays);
  const windowStartIso = windowStart.toISOString();

  // ------------------ Parallel data fetches (RLS still applies) -----------
  // Failure / repair / downtime semantics mirror fn_compute_mtbf and
  // fn_compute_mttr in supabase/migrations/00011_views_functions.sql:
  //   * failure   = maintenance_events row with non-null failure_date in window
  //   * repair    = maintenance_events row with repair_duration_hours, filtered
  //                 by completion_date in window
  //   * downtime  = SUM(downtime_logs.duration_hours) in window
  // event_type ('corrective' | 'preventive' | 'inspection' | 'emergency') is
  // intentionally NOT a filter here.
  const [assetRes, failuresRes, repairsRes, downtimeRes, pmRes, calibRes, riskRes] =
    await Promise.all([
      supabase.from('equipment_assets').select('id').eq('id', equipmentId).maybeSingle(),
      supabase
        .from('maintenance_events')
        .select('id', { count: 'exact', head: true })
        .eq('asset_id', equipmentId)
        .gte('failure_date', windowStartIso)
        .not('failure_date', 'is', null),
      supabase
        .from('maintenance_events')
        .select('repair_duration_hours')
        .eq('asset_id', equipmentId)
        .gte('completion_date', windowStartIso)
        .not('repair_duration_hours', 'is', null),
      supabase
        .from('downtime_logs')
        .select('duration_hours')
        .eq('asset_id', equipmentId)
        .gte('start_time', windowStartIso),
      supabase
        .from('pm_schedules')
        .select('status, scheduled_date')
        .eq('asset_id', equipmentId)
        .gte('scheduled_date', windowStartIso),
      supabase
        .from('calibration_records')
        .select('result, calibration_date, next_due_date')
        .eq('asset_id', equipmentId)
        .order('calibration_date', { ascending: false })
        .limit(1),
      supabase
        .from('equipment_risk_scores')
        .select('severity, occurrence, detectability')
        .eq('asset_id', equipmentId)
        .order('assessed_at', { ascending: false, nullsFirst: false })
        .limit(1),
    ]);

  if (assetRes.error) {
    return jsonResponse(
      { status: 'error', error: `Asset lookup failed: ${assetRes.error.message}` },
      { status: 500 },
    );
  }
  if (!assetRes.data) {
    return jsonResponse(
      { status: 'error', error: 'Asset not found or not visible to caller.' },
      { status: 404 },
    );
  }

  // ------------------ Reliability metrics ---------------------------------
  const failureCount = failuresRes.count ?? 0;
  const repairs = (repairsRes.data ?? []) as Array<{ repair_duration_hours: number | null }>;
  let repairCount = 0;
  let totalRepairHours = 0;
  for (const row of repairs) {
    const hours = Number(row.repair_duration_hours);
    if (Number.isFinite(hours) && hours > 0) {
      totalRepairHours += hours;
      repairCount += 1;
    }
  }
  const downtimeRows = (downtimeRes.data ?? []) as Array<{ duration_hours: number | null }>;
  let totalDowntimeHours = 0;
  for (const row of downtimeRows) {
    const hours = Number(row.duration_hours);
    if (Number.isFinite(hours) && hours > 0) totalDowntimeHours += hours;
  }

  const totalOperationalHours = Math.max(observationDays * 24 - totalDowntimeHours, 0);
  const mtbf = computeMTBF(totalOperationalHours, failureCount);
  const mttr = computeMTTR(totalRepairHours, repairCount);
  const availability = mtbf !== null && mttr !== null ? computeAvailability(mtbf, mttr) : null;

  // ------------------ PMC -------------------------------------------------
  const pm = (pmRes.data ?? []) as Array<{ status: string | null }>;
  const pmScheduled = pm.length;
  const pmCompleted = pm.filter((row) => row.status === 'completed').length;
  const pmc = computePMC(pmCompleted, pmScheduled);

  // ------------------ Calibration ----------------------------------------
  const calibration = (calibRes.data ?? [])[0]
    ? {
        last_result: ((calibRes.data ?? [])[0] as Record<string, unknown>).result as string | null,
        last_calibration_date:
          ((calibRes.data ?? [])[0] as Record<string, unknown>).calibration_date as string | null,
        next_due_date:
          ((calibRes.data ?? [])[0] as Record<string, unknown>).next_due_date as string | null,
      }
    : null;

  // ------------------ RPN ------------------------------------------------
  let rpnOut: {
    severity: number;
    occurrence: number;
    detectability: number;
    value: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  } | null = null;
  const risk = (riskRes.data ?? [])[0] as
    | { severity: number; occurrence: number; detectability: number }
    | undefined;
  if (risk) {
    try {
      const value = computeRPN(risk.severity, risk.occurrence, risk.detectability);
      rpnOut = {
        severity: risk.severity,
        occurrence: risk.occurrence,
        detectability: risk.detectability,
        value,
        risk_level: classifyRiskLevel(value),
      };
    } catch {
      rpnOut = null;
    }
  }

  return jsonResponse({
    status: 'ok',
    equipment_id: equipmentId,
    observation_window_days: observationDays,
    mtbf_hours: mtbf,
    mttr_hours: mttr,
    availability_ratio: availability,
    failure_count: failureCount,
    repair_count: repairCount,
    total_downtime_hours: Number(totalDowntimeHours.toFixed(2)),
    total_operational_hours: Number(totalOperationalHours.toFixed(2)),
    pmc_percent: pmc,
    pm_completed_count: pmCompleted,
    pm_scheduled_count: pmScheduled,
    calibration,
    rpn: rpnOut,
    computed_at: new Date().toISOString(),
  });
});
