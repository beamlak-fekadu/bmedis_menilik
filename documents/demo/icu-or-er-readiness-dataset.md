# ICU / OR / ER Readiness Dataset Notes

The demo dataset combines existing baseline seed data with post-upgrade additions.

## Clinical departments covered

- ICU (`Intensive Care Unit`)
- OR (`Operating Theater`)
- ER (`Emergency Department`)

These department records originate from:
- `supabase/seed/01_reference_data.sql`

## Operational stressors represented

- Recurring maintenance requests and work orders in ICU/OR/ER:
  - `supabase/seed/04_maintenance_data.sql`
- Spare part consumption and stock pressure:
  - `supabase/seed/07_spare_parts_data.sql`
- Analytics baseline (reliability, risk, PM compliance, replacement):
  - `supabase/seed/10_analytics_data.sql`

## Post-upgrade scenario enrichments

Applied in:
- `supabase/seed/11_post_upgrade_baseline.sql`

Includes:
- Procurement pipeline for ICU/ER/OR needs:
  - ICU ventilator flow sensors (critical)
  - ER defibrillator battery kits (high)
  - OR sterilizer pressure valves (medium)
- Inspection and calibration template baselines
- Offline sync event sample
- Snapshot refresh invocation for:
  - `equipment_health_snapshots`
  - `clinical_readiness_snapshots`
  - `triage_action_queue`
  - `workload_capacity_snapshots`

## Narrative support in demo

- **ICU readiness:** demonstrate essential high-criticality availability pressure and triage urgency.
- **OR readiness:** show recurring maintenance/procurement interplay and replacement implications.
- **ER readiness:** highlight calibration and emergency response equipment continuity.
