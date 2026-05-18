# BMEDIS RBAC Audit — V4_Theme

Date: 2026-05-14
Branch: V4_Theme
Source of truth: [src/lib/rbac.ts](../src/lib/rbac.ts)

## Status: server actions now use capability-based authorization

`src/lib/rbac.ts` defines `CAPABILITY_MATRIX` keyed by `RoleName` with capability
sets covering navigation, equipment, maintenance, PM, calibration, stock,
procurement, training, disposal, alerts, reports, administration, and
developer-only tools. It exports `hasCapability(roles, capability)`,
`hasAnyCapability`, and `capabilitiesFor(role)`.

### Shared helpers in `src/actions/_shared.ts`

- `getActionContext(allowedRoles: RoleName[])` — legacy role-array gate. Kept
  for backwards-compatibility for the few callers that don't fit the matrix.
- `getActionContextForCapability(capability: Capability)` — preferred. Allows
  the caller iff `hasCapability(roles, capability)` is true. Developer always
  passes; viewer fails every mutation capability.
- `getActionContextForAnyCapability(capabilities: Capability[])` — variant for
  endpoints that legitimately cover multiple capabilities (e.g. work-order
  start/complete are the same endpoint).

### UI wiring (unchanged in this pass)

- [src/hooks/useRole.ts](../src/hooks/useRole.ts) — `can(capability)` /
  `canAny`. Legacy boolean helpers delegate to `hasCapability`.
- [src/constants/index.ts](../src/constants/index.ts) — `NAV_SECTIONS` items
  declare a `capability` field.
- [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx) —
  filter prefers `hasCapability(userRoles, item.capability)`.

## Server actions migrated to capability checks

| File | Action | Capability |
| --- | --- | --- |
| equipment.actions.ts | createEquipmentAction | equipment.create |
| equipment.actions.ts | updateEquipmentAction | equipment.edit |
| equipment.actions.ts | softDeleteEquipmentAction | equipment.delete |
| maintenance.actions.ts | createMaintenanceRequestAction | maintenance.request.create |
| maintenance.actions.ts | updateRequestStatusAction | maintenance.request.approve OR maintenance.request.create |
| maintenance.actions.ts | createWorkOrderAction | work_order.create |
| maintenance.actions.ts | updateWorkOrderAction | work_order.start OR work_order.complete OR work_order.add_event |
| maintenance.actions.ts | assignWorkOrder / reassignWorkOrder | work_order.assign |
| maintenance.actions.ts | createMaintenanceEventAction | work_order.add_event |
| pm.actions.ts | createPMPlanAction | pm.plan.create |
| pm.actions.ts | updateScheduleStatusAction | pm.complete |
| pm.actions.ts | createPMCompletionAction | pm.complete |
| pm.actions.ts | assignPMScheduleAction | pm.assign |
| pm.actions.ts | startPMScheduleAction | pm.complete |
| pm.actions.ts | deferOrSkipPMScheduleAction | pm.complete |
| pm.actions.ts | updatePMPlanStatusAction | pm.plan.create |
| pm.actions.ts | pausePMPlanAction | pm.plan.create |
| pm.actions.ts | resumePMPlanAction | pm.plan.create |
| pm.actions.ts | generateNextPMScheduleAction | pm.plan.create |
| calibration.actions.ts | createCalibrationRequestAction | calibration.request.create |
| calibration.actions.ts | updateCalibrationRequestStatusAction | calibration.request.approve OR calibration.schedule |
| calibration.actions.ts | createCalibrationRecordAction | calibration.record_result |
| disposal.actions.ts | createDisposalRequestAction | disposal.request.create |
| disposal.actions.ts | updateDisposalRequestStatusAction | disposal.approve |
| disposal.actions.ts | createDisposedAssetAction | disposal.record |
| procurement.actions.ts | createProcurementRequestAction | procurement.request |
| procurement.actions.ts | updateProcurementStatusAction | procurement.status_update |
| spare-parts.actions.ts | createSparePartAction | spare_parts.manage |
| spare-parts.actions.ts | updateSparePartAction | spare_parts.manage |
| spare-parts.actions.ts | createStockReceiptAction | stock.receive |
| spare-parts.actions.ts | createStockIssueAction | stock.issue |
| training.actions.ts | createTrainingRequestAction | training.request.create |
| training.actions.ts | createTrainingSessionAction | training.schedule |
| training.actions.ts | createStaffTrainingRecordAction | training.record_attendance |
| alerts.actions.ts | acknowledgeAlertFlagAction | alerts.acknowledge |
| users.actions.ts | updateProfileAction | users.manage |
| users.actions.ts | assignRoleAction | roles.manage |
| users.actions.ts | removeRoleAction | roles.manage |
| reports.actions.ts | prepareReportSnapshotAction | reports.view |
| developer-lab.actions.ts | refreshFmeaRiskScoresAction | developer.refresh_snapshots |
| developer-lab.actions.ts | refreshDecisionSupportSnapshotsAction | developer.refresh_snapshots |
| developer-lab.actions.ts | recomputeAllAnalyticsDeveloperAction | developer.diagnostics |
| offline-sync.actions.ts | syncOfflineWorkOrderActionsAction | work_order.start OR work_order.complete OR work_order.add_event |

## Not migrated yet — left on `getActionContext(roles[])`

These actions have no obvious one-to-one capability in the matrix yet. They
remain on the legacy role-array gate (which still goes through `_shared.ts`,
just without a `Capability` value). Migration would require adding a new
capability to the matrix; deferred to a follow-up rather than guessed.

| File | Action(s) | Reason |
| --- | --- | --- |
| equipment.actions.ts | updateEquipmentConditionAction | Internal side effect of maintenance/PM flows. Authorized to admin/bme_head/technician/department_head/department_user. Matrix has no `equipment.condition_update`; would conflate with `equipment.edit` (which excludes department roles). |
| installation.actions.ts | createInstallationRequestAction, updateInstallationRequestStatusAction, createInstallationRecordAction | Matrix has no `installation.*` capabilities. Workflow is intake (broad) → record (technician). Suggested follow-up: add `installation.request.create`, `installation.record`. |
| documents.actions.ts | createSpecificationRequestAction, updateSpecificationRequestStatusAction, uploadDocumentAction, deleteDocumentAction | Matrix has no `documents.*` or `specification.*` capabilities. Suggested follow-up: add `documents.upload`, `documents.delete`, `specification.request.create`, `specification.request.approve`. |
| settings.actions.ts | createReferenceRowAction, updateReferenceRowAction, removeReferenceRowAction | Matrix's `users.manage` and `roles.manage` cover staff/role admin but not generic reference-table admin. Suggested follow-up: add `settings.reference.manage` and migrate. |

## Remaining literal-role usages in UI (cosmetic / data-filter)

| Pattern | Files | Notes |
| --- | --- | --- |
| `primaryRole === 'viewer'` for "Read-only / View access" badge | spare-parts, disposal, calibration, training, procurement | Cosmetic only; safe. |
| `primaryRole === 'technician'` for triage scoping | command/page.tsx, command/triage/page.tsx, TriageCenterTabs | Data filter, not a permission. |
| `primaryRole === 'department_user'` / `'store_user'` for default landing tab | CommandCenterInteractive, TriageCenterTabs, command/page.tsx | Data filter. |
| `match: (roles) => roles.includes(...)` | settings/page.tsx (role demo matcher) | Settings explicitly demonstrates role matching. |

These are not security-critical — server actions enforce the real boundary —
but a future cleanup pass could move them onto `can('capability')` for
consistency.

## Database / RLS

Not audited live this session — no Supabase credentials in the runtime
environment. A reviewable, copy-pastable audit script lives at
[documents/rbac-rls-audit.sql](rbac-rls-audit.sql). Run it against the linked
Supabase project to verify:

- per-table policy lists for every operational table
- policies that grant `admin` but not `bme_head` (parity gap)
- policies that grant `viewer` an INSERT/UPDATE/DELETE (read-only gap)
- profile/role integrity and demo auth linkage
- store-user / department-role scope

Until those queries are run, RLS posture remains **not verified**.

## Recommendations (priority order)

1. **Extend the capability matrix** with `installation.*`, `documents.*`,
   `specification.*`, `settings.reference.manage`, and `equipment.condition_update`,
   then migrate the four "Not migrated yet" files.
2. **Run the RLS audit SQL** in `documents/rbac-rls-audit.sql` and reconcile
   any policy that grants more than the capability matrix says it should.
3. **Replace remaining `primaryRole === 'viewer'` badge sites** with
   `can('write-capability')` checks (cosmetic; do not bundle with #1).
4. **Browser QA per role** — sign in as developer, bme_head, viewer,
   technician, store_user, department_head, department_user. Confirm:
   - sidebar matches `CAPABILITY_MATRIX` nav.* sets
   - mutation buttons are hidden where capability is absent
   - restricted routes redirect to access-denied
