# BMEDIS Coding-Closure Status — V4_Theme

Date: 2026-05-14
Branch: V4_Theme

This document records what the most recent coding-only closure pass actually
shipped, what still needs browser/live validation, and what remains optional.
It exists so a future reviewer can tell at a glance which work is
code-complete vs. unverified.

---

## 1. Completed in this coding-only pass

### Server-action RBAC migration

- `src/lib/rbac.ts` is the single source of truth for capabilities.
- `src/actions/_shared.ts` adds two new helpers:
  - `getActionContextForCapability(capability)` — preferred gate.
  - `getActionContextForAnyCapability(capabilities[])` — for endpoints that
    legitimately cover multiple capabilities (e.g., work-order start/complete).
  - `getActionContext(allowedRoles[])` is retained for the four files that
    don't have an obvious matrix entry yet.
- The following action files now authorize via capability:
  `equipment.actions.ts`, `maintenance.actions.ts`, `pm.actions.ts`,
  `calibration.actions.ts`, `procurement.actions.ts`, `disposal.actions.ts`,
  `spare-parts.actions.ts`, `training.actions.ts`, `alerts.actions.ts`,
  `users.actions.ts`, `reports.actions.ts`, `developer-lab.actions.ts`,
  `offline-sync.actions.ts`.
- Migration table per action is recorded in
  [documents/rbac-audit.md](rbac-audit.md).

### RLS audit SQL document

- New file: [documents/rbac-rls-audit.sql](rbac-rls-audit.sql).
- Copy-pastable into the Supabase SQL Editor; no live credentials needed at
  authoring time.
- Sections: per-table policy list, admin-vs-bme_head parity, technician /
  viewer / store_user / department-role scope, profile/role integrity, demo
  auth linkage, and assignment integrity.

### PDF export static hardening

- `src/utils/export.ts` now accepts `chartSummaries?: PdfChartSummary[]` and
  `chartExportNote?: string` in `ExportPdfOptions`.
- When chart images cannot be captured, the PDF renders a "Visual Analytics"
  fallback section that names the expected charts and surfaces the note.
- `src/app/(dashboard)/reports/[type]/page.tsx` now passes both, and warns the
  user via toast when captures came back empty
  ("Charts were not captured. Exporting snapshot summary and evidence table
  only.").
- Each chart wrapper continues to carry `data-chart-title` for capture.

### Equipment condition-transition evidence

- `src/services/maintenance.service.ts`: `getOpenRequestsForAsset`,
  `getOpenWorkOrdersForAsset`, and `getLastCompletedWorkOrderForAsset` now
  include the `request_number` / `work_order_number` columns so detail pages
  can reference exact records by their human ID.
- `src/app/(dashboard)/equipment/[id]/page.tsx` adds a narrative
  "Condition trace" line under the Maintenance Status card that explains the
  current condition from real data only — no invented previous state.
  Fallback text: "No condition-transition evidence has been recorded yet."
- The existing Condition Trace cards on maintenance request and work-order
  detail pages were left intact (they already cover reported_condition,
  current WO state, final condition, and exact related-record links).

### Technician dropdown hardening

- `src/services/users.service.ts`: `getActiveTechnicians` is the canonical
  fetcher across Work Orders (new + detail) and PM schedules. Comments
  document inclusion rules (technician + bme_head, active only) and the
  exclusion of `developer`. The SELECT keeps `job_title` so dropdowns can
  surface role context.
- New exported constant `ASSIGNABLE_TECHNICIANS_EMPTY_STATE` — every callsite
  now renders the same copy: "No assignable technicians found. Check Settings
  → Staff & Access." The previous mention of "Users & Roles" was stale.
- The "New Work Order" page now also surfaces the empty-state warning.

### Action button style sweep

- `src/components/ui/action-styles.ts` already enumerates the canonical tones
  (brand / danger / warning / warningSubtle / success / neutral / developer).
- Per prior cleanup notes, operational pages already
  use these exact color choices inline. This pass intentionally did NOT do a
  broad import-rewrite across pages, because the visual outcome is the same
  and the diff blast radius is large. The constant remains available for
  future migration.

### Documentation

- [documents/rbac-audit.md](rbac-audit.md) — refreshed with the migration
  matrix and a list of actions still on the legacy gate.
- [documents/rbac-rls-audit.sql](rbac-rls-audit.sql) — new.
- [documents/coding-closure-status.md](coding-closure-status.md) — this file.

---

## 2. Still requires browser / manual validation

Coding changes were validated with `npx tsc --noEmit`, `npm run lint`,
`npm run build`, and `git diff --check`. The following items remain
unverified because they require a real browser or visual review:

- **PDF visual inspection** — open an exported PDF in a real viewer to
  confirm chart images render at acceptable resolution, page breaks land
  correctly, KPI cards are legible, and dark-mode-rendered chart colors are
  readable on white PDF background.
- **PDF dark-mode chart readability** — Chart.js datasets pick text colors
  from the live page's theme. When dark mode is active, captured PNGs may use
  light text on transparent background; visual check is the only way to
  confirm.
- **Light / dark contrast visual QA** — full-page sweep of the V4_Theme
  refresh.
- **Seven-role login matrix** — sign in as developer, bme_head, admin,
  technician, store_user, department_head, department_user, viewer.
  Confirm:
  - sidebar matches `CAPABILITY_MATRIX.nav.*`
  - mutation buttons hidden where capability is absent
  - server actions reject when capability is absent (HTTP-level not just UI)
  - restricted routes redirect to access-denied
- **Technician dropdown live check** — confirm Work Order and PM assignment
  dropdowns populate with the expected technicians under a non-developer
  session (i.e. RLS on `user_roles` / `roles` permits the embedded join).
- **Condition-transition narrative** — confirm the new narrative line on
  the Equipment detail page reads naturally across the four data-shape
  branches (last completed WO / open WO / open request / events only / none).
- **Notification / browser-API behaviors** — none added this pass; nothing
  to verify.

---

## 3. Still requires live Supabase

The following items cannot be coded around — they need credentialed access
to the linked Supabase project:

- Running [documents/rbac-rls-audit.sql](rbac-rls-audit.sql) and reconciling
  any non-zero result rows.
- Verifying that profiles with `user_id IS NULL` are intentional (assignable
  staff without login) vs. accidental gaps.
- Confirming that `auth.users` exists for every demo email and is linked
  back to its `profiles.user_id`.
- Running `compute_replacement_priority_scores_all()` and
  `refresh_decision_support_snapshots()` against live data and confirming
  views populate.
- Policy parity checks: per section 2 of the audit SQL, every policy that
  grants `admin` should also grant `bme_head`.

---

## 4. Remaining optional / future work

- Extend `CAPABILITY_MATRIX` to cover the four "Not migrated yet" action
  files (installation, documents, settings reference data, equipment
  condition update). Suggested capabilities are listed in
  [documents/rbac-audit.md](rbac-audit.md).
- Replace remaining `primaryRole === 'viewer'` cosmetic checks with
  `!can('write-capability')` equivalents in spare-parts, disposal,
  calibration, training, and procurement pages.
- Department-limited reports: scope the report fetchers by the caller's
  `department_id` for `department_head` / `department_user`.
- Settings CRUD for all reference tables (currently only the schema-allowed
  list is mutable; UI doesn't yet cover every table).
- Audit before/after diff viewer for the `audit_logs` page.
- Optional adoption of `actionButtonClass` across operational pages — pure
  refactor, no behavior change.

---

## 5. Verification commands run

```bash
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Results are captured in the final response of this session, not in this
document, so they reflect the most recent run rather than a stale snapshot.
