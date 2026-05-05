-- Migration 00027: Audit remediation — one-time full analytics backfill
-- Invokes public.recompute_all_equipment_analytics() which (per 00023):
--   - Recomputes per-asset reliability + PMC window for all active assets
--   - Ensures baseline risk scores where missing
--   - Runs compute_replacement_priority_scores_all() (80 system rows, weights_profile_id NULL)
--   - Refreshes decision-support snapshots (triage, health, readiness, workload)
-- Idempotent: safe to re-run; recomputes current window and replaces open triage rows.
-- Runtime: on the order of seconds for ~80 assets (thesis scale).

SELECT public.recompute_all_equipment_analytics();
