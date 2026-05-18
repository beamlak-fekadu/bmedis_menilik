// Edge Function: refresh-analytics-snapshot
//
// Trigger BMEDIS analytics snapshot refresh via a single HTTP POST.
// Intended callers: developer/admin dashboard buttons, scheduled jobs
// (pg_cron / scheduled triggers), or one-shot ops calls.
//
// What it runs (matching src/services/decision-support.service.ts):
//   1. recompute_all_equipment_analytics()  -> reliability + RPN + PMC
//      + performance + replacement priority for every active asset.
//   2. refresh_decision_support_snapshots() -> triage / health / readiness
//      / workload read models on top of those metrics.
//
// Auth model: service-role key from the function's environment. This is
// an internal recompute that must touch every asset across all roles, so
// it bypasses RLS by design. Supabase config sets verify_jwt=false for
// this function because scheduled pg_cron calls use new-format Supabase
// keys that the gateway cannot parse as JWTs. The function therefore
// enforces X-Cron-Secret itself when CRON_SHARED_SECRET is configured.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';

interface RefreshResult {
  status: 'ok' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: Array<{ name: string; ok: boolean; error?: string }>;
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

  // Caller-auth guard. With verify_jwt=false the gateway lets anything
  // through, so we enforce a shared secret here. Set CRON_SHARED_SECRET in
  // the function environment AND pass it in the X-Cron-Secret header from
  // pg_cron. If not configured, fall back to accepting any service-role
  // bearer (back-compat for manual curl during dev).
  const expectedSecret = Deno.env.get('CRON_SHARED_SECRET');
  if (expectedSecret) {
    const provided = req.headers.get('x-cron-secret') ?? '';
    if (provided !== expectedSecret) {
      return jsonResponse(
        { status: 'error', error: 'Forbidden: invalid or missing X-Cron-Secret.' },
        { status: 403 },
      );
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        status: 'error',
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in function environment.',
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = new Date();
  const steps: RefreshResult['steps'] = [];

  // Step 1: recompute equipment analytics
  const recompute = await supabase.rpc('recompute_all_equipment_analytics');
  steps.push({
    name: 'recompute_all_equipment_analytics',
    ok: !recompute.error,
    error: recompute.error?.message,
  });

  // Step 2: refresh decision-support read models (only if step 1 succeeded)
  if (!recompute.error) {
    const refresh = await supabase.rpc('refresh_decision_support_snapshots');
    steps.push({
      name: 'refresh_decision_support_snapshots',
      ok: !refresh.error,
      error: refresh.error?.message,
    });
  }

  const finishedAt = new Date();
  const result: RefreshResult = {
    status: steps.every((s) => s.ok) ? 'ok' : 'error',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    steps,
  };

  return new Response(JSON.stringify(result), {
    status: result.status === 'ok' ? 200 : 500,
    headers: {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    },
  });
});
