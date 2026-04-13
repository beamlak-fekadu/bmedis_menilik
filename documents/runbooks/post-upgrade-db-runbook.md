# Post-Upgrade DB Runbook

## Scope

Activate post-upgrade database changes and baseline data for decision-support modules.

## Required SQL artifacts

- `supabase/migrations/00013_memis2_decision_support_and_guardrails.sql`
- `supabase/migrations/00014_memis2_rls_and_refresh.sql`
- `supabase/seed/11_post_upgrade_baseline.sql`

## Execution order

1. Apply migrations in sequence:
   - `00013`
   - `00014`
2. Run existing seed set (`seed/seed.sql`) which now includes `11_post_upgrade_baseline.sql`.
3. Verify refresh function:
   - `SELECT refresh_decision_support_snapshots(CURRENT_DATE);`

## Verification queries

```sql
SELECT COUNT(*) FROM procurement_requests;
SELECT COUNT(*) FROM equipment_health_snapshots WHERE snapshot_date = CURRENT_DATE;
SELECT COUNT(*) FROM clinical_readiness_snapshots WHERE snapshot_date = CURRENT_DATE;
SELECT COUNT(*) FROM triage_action_queue WHERE status = 'open';
SELECT COUNT(*) FROM workload_capacity_snapshots WHERE snapshot_date = CURRENT_DATE;
```

## RLS verification checks

Confirm policies exist for:
- `procurement_requests`
- `memis_lookup_values`
- `equipment_health_snapshots`
- `clinical_readiness_snapshots`
- `triage_action_queue`
- `offline_sync_events`

## Failure handling

- If `refresh_decision_support_snapshots` fails, verify dependent analytics tables have data:
  - `equipment_reliability_metrics`
  - `equipment_risk_scores`
  - `pm_compliance_metrics`
  - `replacement_priority_scores`
- If procurement writes fail, verify authenticated role policy eligibility (`admin`, `technician`, `store_user`, `department_user`).
