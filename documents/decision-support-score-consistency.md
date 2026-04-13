# Decision-Support Score Consistency Notes

This document records the scoring assumptions used by both runtime TypeScript and SQL snapshot backfill so triage and readiness results remain explainable and consistent.

## Health Score Inputs

- **Availability contribution:** 35%
- **PM compliance contribution:** 25%
- **Risk contribution (RPN penalty):** 25%
- **Condition and open-flag contribution:** 15%

### Shared threshold assumptions

- Availability baseline fallback: `0.92`
- PM compliance baseline fallback: `80%`
- RPN baseline fallback: `120`
- Max risk penalty cap: `0.35`
- Open critical/high recommendation flags penalize with max cap `0.25`
- Condition penalties:
  - `functional`: `0.00`
  - `needs_repair`: `0.15`
  - all other degraded states: `0.30`

## Triage Priority Inputs

- Active flag severity weighted sum:
  - `critical`: +45
  - `high`: +25
  - `medium`: +10
  - `low`: +4
- RPN score: `min(40, rpn / 15)`
- PM non-compliance penalty: `max(0, (80 - pmc) / 2)`
- Replacement urgency score: `max(0, 20 - rank)`

### Triage action bands

- `>= 75`: Immediate intervention and escalation
- `>= 45 and < 75`: Schedule within 24-48 hours
- `< 45`: Monitor and preventive planning

## Clinical Readiness Inputs

- Essential equipment = categories with criticality `high` or `critical`
- Readiness score per department:
  - `(essential functional active / essential total) * 100`

## Source of Truth by Layer

- **Snapshot generation SQL:** `supabase/migrations/00014_memis2_rls_and_refresh.sql` (`refresh_decision_support_snapshots`)
- **Frontend data service with fallback:** `src/services/decision-support.service.ts`
- **Manual refresh trigger UI:** `src/app/(dashboard)/decision-support/page.tsx`

If score behavior is adjusted in one layer, update both SQL function and TypeScript fallback in the same change set.
