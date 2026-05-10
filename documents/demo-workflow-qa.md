# BMERMS Demo Workflow QA

Last updated: 2026-05-07

Scope: app hardening and demo readiness with seed data. Real Yekatit-12 production data migration is intentionally excluded.

## Core Demo Workflow

| Step | Action | Expected result | Status |
|---:|---|---|---|
| 1 | Log in as the linked developer/admin demo user | Dashboard shell loads and role-gated navigation appears | Not manually run in this pass |
| 2 | Open `/command` | Command Center cards, triage, readiness, risk, replacement, exact row actions, and shared-count drilldowns render from operational sources | Build verified |
| 3 | Open `/equipment` | Equipment list renders active seeded assets | Build verified |
| 4 | Create or select a seeded asset | Equipment mutation uses `createEquipmentAction` / server auth | Code verified |
| 5 | Create a maintenance request | Request is written by `createMaintenanceRequestAction`, audited, and relevant paths are revalidated | Code verified |
| 6 | Create or assign a work order | Work order is written by `createWorkOrderAction` / `updateWorkOrderAction` | Code verified |
| 7 | Move work order through status lifecycle | Status changes are server-authorized and audited | Code verified |
| 8 | Add a maintenance event | Event is written by `createMaintenanceEventAction` and triggers asset analytics recompute | Code verified |
| 9 | Complete work order | Completion triggers `recomputeAssetAnalytics` | Code verified |
| 10 | Refresh analytics/Command Center | Existing command refresh action recomputes all analytics | Existing behavior retained |
| 11 | Confirm flags/triage update | Triage and alerts paths revalidate after acknowledgments and recompute | Code verified |
| 12 | Acknowledge alert or triage | Alert acknowledge uses `acknowledgeAlertFlagAction`; triage uses existing server action | Code verified |
| 13 | Acknowledge Risk Watch signal | Risk Watch acknowledgement stores item key + signal hash so unchanged reviewed signals hide and changed signals reappear | Code verified |
| 13 | Export report PDF/CSV | Empty datasets now return "No rows to export" instead of downloading blank exports | Code verified |
| 14 | Open audit log | Operational server actions write profile-id audit rows | Code verified |
| 15 | Demo with seed data if real data is unavailable | Seed behavior is acceptable; recurring failure currently has one seeded asset above threshold | Documented |

## Module QA Matrix

| Module | Route | Primary role | Read | Write | Empty/error behavior | Audit/revalidation | Demo status |
|---|---|---|---|---|---|---|---|
| Command Center | `/command` | all roles | Shared typed fetchers | Refresh/ack/exact record links/prefilled flows | Empty cards | Revalidates command routes | Build verified |
| Hospital Calendar | `/calendar` | all roles | Normalized internal event fetcher | Opens exact/contextual source records | Empty period/filter state and source warnings | Source actions revalidate calendar | Code verified |
| Triage queue | `/command/triage` | ops roles | Client read view | Existing command actions | Empty table | Revalidates command/health | Build verified |
| Equipment | `/equipment` | admin/technician | Client service reads | Server actions | Existing UI | Equipment/report/command revalidation | Code verified |
| Maintenance requests | `/maintenance`, `/maintenance/requests/*` | admin/technician/department_user | Client service reads | Server actions | Existing UI | Maintenance/report/command revalidation | Code verified |
| Requests Hub | `/requests`, `/requests/[type]/[id]` | all operational/request roles + viewer | Shared normalized server fetcher | Type-specific links into module actions | Empty categories show 0/not configured | N/A | Code verified |
| Work orders | `/work-orders`, `/maintenance/work-orders/*` | admin/technician | Client service reads | Server actions | Existing UI | Maintenance/report/command revalidation | Code verified |
| Preventive maintenance | `/pm`, `/pm/*` | admin/technician | Client service reads | Evidence-based server actions | Control-center cards/tabs with empty states | PM/equipment/command/risk revalidation | Code verified |
| Calibration | `/calibration` | admin/technician | Client service reads | Server actions | Existing UI | Calibration/report/command revalidation | Code verified |
| Spare parts | `/spare-parts` | admin/technician/store_user | Client service reads | Server actions | Existing UI | Spare/logistics/command revalidation | Code verified |
| Logistics | `/logistics` | admin/technician/store_user | Live summary cards | Links to spare/procurement | Summary defaults to zero | N/A | Build verified |
| Procurement | `/procurement` | admin/store_user/technician | Client service reads | Server action create/status | Existing UI | Procurement/logistics/command revalidation | Code verified |
| Training | `/training` | admin/technician/department_user | Client service reads | Server actions | Existing UI | Training/report revalidation | Code verified |
| Disposal | `/disposal` | admin/technician | Client service reads | Server actions | Existing UI | Disposal/replacement/report revalidation | Code verified |
| Replacement | `/replacement` | admin/technician/viewer | Client service reads | No DB writes | Empty chart/table | N/A | Polished |
| Alerts | `/alerts` | admin/technician | Client service reads | Server action acknowledge | Empty tabs | Alerts/command/helpdesk revalidation | Code verified |
| Helpdesk | `/helpdesk` | ops roles | Live alert queue | Server action acknowledge | Empty queue | Alerts/command/helpdesk revalidation | Polished |
| Documents | `/documents` | admin/technician | Client service reads | Server action upload/delete | Existing UI | Docs/equipment revalidation | Code verified |
| Reports | `/reports/[type]` | reporting roles | Client service reads | Export only | No rows toast | N/A | Build verified |
| Users | `/users` | admin | Client service reads | Server actions | Existing UI | Users/settings/audit revalidation | Code verified |
| Settings | `/settings` | admin | Client service reads | Server actions | Existing UI | Settings/audit revalidation | Code verified |
| Security | `/security` | admin | Server live summary | Links only | Empty audit text | N/A | Server-protected |
| Chatbot | `/chatbot` | all roles | Client chat session reads | Existing chat service/API | Existing UI | Chatbot test suite | 111 tests passing |
| Installation | `/installation` | admin/technician | Client service reads | Server action create | Existing UI | Installation/equipment/command revalidation | Code verified |

## Seed Behavior Notes

- Recurring-failure flags keep the thesis threshold of `failureCount >= 4`. In the seeded period, currently one asset crosses that threshold. Assets with 2-3 events are below threshold and will appear after additional failures are logged.
- Supabase Storage bucket required for document workflows: create bucket `equipment-documents`, allow authenticated upload/read/delete according to project RLS/storage policy, and ensure environment variables point to the active Supabase project.
- Offline sync is intentionally scoped to work-order status updates and maintenance event logs. There is no background service worker; users sync manually from the work-order detail page.

## Command Center Action Semantics

1. Exact record rule: row-level actions must open exact records when records exist.
2. Prefilled creation rule: if no record exists, open a prefilled creation flow with context.
3. Informational signal rule: informational signals use acknowledge/snooze or convert-to-workflow.
4. Count consistency rule: summary card, triage tab, drilldown, Work Queue & Assignment, and critical action count must share the same fetcher/source for the same metric.
5. State-aware action labels: Assign for unassigned work, Reassign for assigned work, View Progress for in-progress work, Resolve Blocker for on-hold work.
6. Future triage categories: new triage categories must define record IDs, exact routes, and prefilled fallback flows before being shown in the Command Center.
7. BME Head principle: the system recommends/explains; the BME Head decides.

## Requests Hub Semantics

1. Requests Hub is the central intake/tracking front door, not a replacement for operational modules.
2. Categories are corrective maintenance, calibration, training, procurement, disposal, installation, and specification/document support.
3. The unified request table uses one normalized data source for cards, filters, and counts.
4. Existing request rows open exact records where available; categories without dedicated module detail pages use `/requests/[type]/[id]`.
5. New request actions route to type-specific creation or module modal flows with `source=requests-hub`.
6. Viewer is read-only; BME Head/developer/admin see all hospital request activity; department roles are scoped to own/department rows where context exists.
7. Installation requests use `installation_requests`; installation records remain completion evidence and are not request counts.
8. Specification requests use `specification_requests`; specification documents remain output/evidence and are not request counts.
9. Disposal counts formal disposal requests only; replacement candidates are linked evidence, not disposal requests.

## Hospital Operations Calendar Semantics

1. `/calendar` is fully internal and is not Google Calendar integration.
2. Events are normalized from real BMERMS date fields across PM, calibration, maintenance, training, installation, procurement, disposal, and dated specification requests.
3. Source workflow tables remain the source of truth; internal sync means route revalidation/refresh after source actions.
4. Exact records open exact routes where available. Contextual module routes are reserved for sources without detail pages.
5. Viewer is read-only. External Google Calendar sync is intentionally deferred because it requires OAuth, token storage, duplicate prevention, and conflict handling.

## Preventive Maintenance Semantics

1. PM Plan is the recurring PM rule/program; PM Schedule is one generated task; PM Completion is the evidence that work was performed.
2. PM Compliance = completed scheduled PM tasks ÷ total scheduled PM tasks. Skipped/deferred PM is tracked separately and does not count as completed.
3. Completion evidence records result, checklist, notes/findings, technician, completion date, and final equipment condition.
4. PM issue findings can create/open corrective maintenance requests with duplicate prevention.
5. PM completion updates `/pm`, Equipment detail, Command Center overdue PM, and FMEA detectability through the existing analytics refresh path.
6. Existing PM schedule actions open exact `/pm/schedules/[id]` records. Viewer remains read-only.

## PM Count and Action Semantics

1. PM Schedule Records = all generated `pm_schedules` rows, including historical completed/skipped/deferred rows and active unfinished rows.
2. Active PM Tasks = unfinished PM tasks requiring action: scheduled, in progress, overdue, or deferred.
3. PM Plan status is different from asset criticality. Active/Paused is plan generation state; criticality is equipment risk/context.
4. `Needs next task` means no unfinished upcoming task exists for that plan, not that there is no history.
5. Generate Next Task creates the next schedule only when no unfinished task exists; otherwise it opens the existing unfinished task.
6. Pause Plan disables future generation but does not delete history or alter existing task completion state. Resume Plan re-enables generation.
7. History opens exact `/pm/plans/[id]/history` with schedule/evidence drilldown and exact schedule links.
8. Compliance = completed scheduled tasks ÷ total scheduled tasks × 100; skipped/deferred remain separate.

## Verification Results

- `npm run lint`: pass, 0 warnings.
- `npm run test:chatbot`: pass, 111 tests.
- `npm run build`: pass when run with network access for Google-hosted Next fonts.
- Remaining non-blocking warning: Next.js 16 reports the `middleware` file convention is deprecated in favor of `proxy`; migration is deferred to avoid changing Supabase session refresh behavior during this hardening pass.
