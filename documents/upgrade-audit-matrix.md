# MEMIS 2.0 Upgrade Audit Matrix

This matrix maps current implementation to MEMIS 2.0-aligned target coverage and identifies primary ownership files for implementation.

## Module Coverage

| Domain | Current Coverage | Gap Summary | Primary Files |
|---|---|---|---|
| Dashboard | Present as single mixed dashboard | Needs explicit Analytical Dashboard and Work Order Dashboard split | `src/app/(dashboard)/page.tsx`, `src/services/dashboard.service.ts` |
| Work Orders | Requests + work orders + status transitions implemented | Missing forwarding/escalation chain and helpdesk-centric queue | `src/app/(dashboard)/maintenance/page.tsx`, `src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx`, `src/services/maintenance.service.ts` |
| Equipment | Inventory list/detail/create/edit and asset context available | Needs stronger route naming compatibility (`/equipment` aliases) and readiness overlays | `src/app/(dashboard)/inventory/**`, `src/services/equipment.service.ts` |
| Requests | Maintenance/training/calibration/disposal requests implemented in module pages | No centralized request hub with all MEMIS request types | `src/services/maintenance.service.ts`, `src/services/training.service.ts`, `src/services/calibration.service.ts`, `src/services/disposal.service.ts` |
| Logistics | Spare parts catalog, receipts, issues, low stock implemented | Needs logistics-centered IA language (receive/request/approval/issue/bin card) | `src/app/(dashboard)/spare-parts/page.tsx`, `src/services/spare-parts.service.ts` |
| Procurement | Basic report references only | Missing dedicated procurement tracking module and statuses dashboard | `src/app/(dashboard)/reports/**`, `src/services/reports.service.ts` |
| Training | Requests, sessions, attendee records implemented | Needs equipment competency/readiness cross-linking in decision support | `src/app/(dashboard)/training/page.tsx`, `src/services/training.service.ts` |
| Reports | Multi-domain reports available | Needs report-center framing and expanded types | `src/app/(dashboard)/reports/page.tsx`, `src/services/reports.service.ts` |
| Settings / Lookups | Reference tables implemented for multiple core entities | Needs MEMIS 2.0 reason/status/admin/facility lookup expansion | `src/app/(dashboard)/settings/page.tsx`, `src/services/settings.service.ts` |
| Security / Users / Roles | Role assignment and activation flow implemented | Needs clearer Security module entry and role-menu mapping transparency | `src/app/(dashboard)/users/page.tsx`, `src/services/users.service.ts` |
| Helpdesk | Alert acknowledgement present | Missing dedicated escalation intake, forwarding, and unresolved tracking board | `src/app/(dashboard)/alerts/page.tsx`, `src/services/analytics.service.ts` |
| Decision Support | Reliability/risk/pmc/performance/replacement analytics present | Missing unified triage center with explainable health/readiness + workload lens | `src/app/(dashboard)/analytics/**`, `src/app/(dashboard)/replacement/page.tsx`, `src/utils/analytics/**` |
| Offline Technician | Not implemented | Needs local draft/queue/pending sync model for work-order actions | `src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx` |
| Data Quality Guardrails | Basic required UI checks exist in forms | Needs structured validation, duplicate protection, and terminology normalization | `src/services/*`, `src/app/(dashboard)/**`, `supabase/migrations/*.sql` |

## Known Route/UX Inconsistencies

- Missing route targets referenced in UI:
  - `/maintenance/requests/new`
  - `/pm/plans/new`
- Route naming mismatch in links:
  - `/inventory` currently canonical but several links expect `/equipment/...`.
- Dashboard landing ambiguity:
  - `src/app/page.tsx` redirect behavior conflicts with dashboard navigation expectations.

## Implementation Priority

1. Shell/design system/token modernization and MEMIS-aligned navigation.
2. Dashboard split (Analytical + Work Order) using existing analytics/services.
3. Module hubs for Requests/Logistics/Procurement/Helpdesk and route compatibility fixes.
4. Decision Support Center with triage/health/readiness/escalation/workload.
5. Offline queue and data-quality guardrails with additive database migration.
