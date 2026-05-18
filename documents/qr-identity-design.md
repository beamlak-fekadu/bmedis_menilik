# QR Identity Design — Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 6

Last updated: 2026-05-15 (Phase 6 — QR Scan Logging and Evidence)
Migrations: 00045_equipment_qr_identity.sql
Branch: QR

## Purpose

Establish a stable, secure, database-backed QR identity for every BMEDIS
equipment asset, and provide BME Head / Admin / Developer the tools to
generate, preview, download, print, and track per-asset QR labels.

Phase 1 built the *identity foundation* (token, label lifecycle metadata,
scan audit table). Phase 2 adds *label generation and management* (image
generation, label preview, single + bulk download/print, lifecycle bulk
actions, and a dedicated `/equipment/qr-labels` route). Phase 3 delivered
the online scan landing route. Phase 4 turns that landing page into a
role-specific, evidence-backed QR experience. Phase 5 expands operational QR
coverage management across Equipment, Developer Lab, QR Label Sheet, and
Reports. Phase 6 makes QR scan activity visible, deduplicated, auditable, and
exportable. The planned six-phase QR implementation is now complete.

## Core principle

> QR code identifies the asset. It does NOT grant permission.

The token is a *lookup key* attached to a physical asset. Whoever scans it is
still subject to BMEDIS authentication and the RBAC capability matrix. A
revoked token or an unauthenticated session must not be able to view
sensitive operational data just because the URL was scanned.

The mental model is:

```
QR token   → resolves asset identity
Auth/session → resolves user/profile/role
Role capabilities → decide visible data and allowed actions
```

## Token strategy (Option 2 — random)

- Random URL-safe string with prefix `qra_` (e.g. `qra_5C1m…vQ`).
- Generated server-side using Node `crypto.randomBytes` (CSPRNG). Never
  `Math.random`. Never client-side.
- ~144 bits of entropy by default (24 random bytes → base64url).
- Unique per asset, stable once issued, regenerable on damage/compromise.
- Does not reveal `id` (UUID) or `asset_code`.
- The token is not a secret authorisation token, but it is unguessable
  enough that scan attempts against random strings will not match an asset.

Future URL shape (Phase 3): `/qr/a/<qr_token>`. The route must reject
revoked tokens (`qr_label_status = 'revoked'`).

## Schema additions (migration 00045)

### `equipment_assets`

| Column | Type | Notes |
|---|---|---|
| `qr_token` | `text` | Nullable. Unique when not null (partial index). |
| `qr_generated_at` | `timestamptz` | When the current token was issued. |
| `qr_label_status` | `text NOT NULL DEFAULT 'not_generated'` | CHECK constraint enforces enum. |
| `qr_label_printed_at` | `timestamptz` | Last "printed" mark. |
| `qr_label_attached_at` | `timestamptz` | Last "attached" mark. |
| `qr_label_replaced_at` | `timestamptz` | Last time a prior token was retired. |
| `qr_token_regenerated_at` | `timestamptz` | Last rotation timestamp. |

Label lifecycle enum: `not_generated | generated | printed | attached | needs_replacement | revoked`.

Indexes:
- `idx_equipment_assets_qr_token_unique` — partial unique on `qr_token` where not null.
- `idx_equipment_assets_qr_label_status`.
- `idx_equipment_assets_qr_generated_at`.

Existing rows default to `qr_label_status = 'not_generated'` and `qr_token = NULL`.
The migration does *not* auto-generate tokens; that is the bulk action exposed
in Developer Lab.

### `equipment_qr_scans`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | `gen_random_uuid()`. |
| `asset_id` | `uuid NOT NULL` | FK → `equipment_assets(id) ON DELETE CASCADE`. |
| `scanned_by` | `uuid` | FK → `profiles(id) ON DELETE SET NULL`. Nullable. |
| `role_name` | `text` | Snapshot of the scanner's effective role. |
| `scanned_at` | `timestamptz` | Default `now()`. |
| `scan_source` | `text` | CHECK: `web | mobile | pwa | unknown`. Default `web`. |
| `user_agent` | `text` | Optional. |
| `online_status` | `text` | CHECK: `online | offline_queued | synced_later | unknown`. Default `online`. |
| `action_taken` | `text` | Free-form role-aware action label. |
| `metadata` | `jsonb` | Free-form payload. Never store credentials. |
| `created_at` | `timestamptz` | Default `now()`. |

Indexes: `asset_id`, `scanned_by`, `scanned_at DESC`, `role_name`, `online_status`.

### RLS

`equipment_qr_scans`:
- **SELECT** — developer / admin / bme_head, OR the scanner reading their own
  rows (`scanned_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())`).
- **INSERT** — any authenticated user. Writes are funnelled through the
  application service layer (`logQrScan`) so capability checks still apply
  at the action boundary. May be tightened in Phase 6.
- **UPDATE / DELETE** — no policy granted.

QR columns on `equipment_assets` inherit the existing equipment RLS (read
allowed to authenticated users; writes only via the equipment-manage policy
plus capability-gated server actions).

## Service layer (`src/services/qr.service.ts`)

Server-only. Imported only from server actions, server components, and the
Developer Lab page.

- `getAssetQrIdentity(assetId)` — read columns.
- `getAssetByQrToken(token)` — Phase 3 helper; rejects revoked tokens and
  rejects malformed tokens via `isValidQrTokenFormat`.
- `ensureAssetQrToken(assetId)` — generate-if-missing, idempotent.
- `regenerateAssetQrToken(assetId)` — rotate token, reset printed/attached
  timestamps, stamp `qr_label_replaced_at` when a prior token existed.
- `markQrLabelPrinted / markQrLabelAttached / markQrLabelNeedsReplacement`
  — lifecycle transitions, require an existing token.
- `revokeAssetQrToken(assetId)` — soft revoke. Keeps `qr_token` value but
  sets status to `revoked`. Future `/qr/a/[token]` route must refuse it.
  This preserves audit history and lets stale-label scans be diagnosed
  rather than silently 404-ing.
- `bulkGenerateMissingQrTokens()` — covers active, non-deleted assets that
  do not yet have a `qr_token`. Handles collisions via retry.
- `logQrScan(params)` — used by Phase 6 scan logging. Logs are written
  defensively; failures must never block the scan landing page.
- `getQrCoverageStats()` — counts for Developer Lab, Equipment QR Coverage,
  and QR Label Sheet. Sourced entirely from real rows in `equipment_assets`
  and `equipment_qr_scans`.

Collisions are retried up to 5 times. Failure throws and the action returns
a structured error.

## Token utility (`src/utils/qr/token.ts`)

- `generateQrToken(byteLength = 24)` — `qra_` + base64url(randomBytes).
- `isValidQrTokenFormat(token)` — `^qra_[A-Za-z0-9_-]{16,}$`.
- `normalizeQrToken(token)` — trim + validate.
- `maskQrToken(token)` — admin UI helper. Shows prefix + last 4 only so
  the full token never lands in logs or screenshots verbatim.

## Server actions (`src/actions/qr.actions.ts`)

All actions are gated to capability `equipment.edit` via
`getActionContextForCapability`. In the current matrix that resolves to
**developer**, **admin** (legacy), and **bme_head**.

| Action | Audit action key |
|---|---|
| `ensureAssetQrTokenAction(assetId)` | `qr.token.generate` |
| `regenerateAssetQrTokenAction(assetId, reason?)` | `qr.token.regenerate` |
| `markQrLabelPrintedAction(assetId)` | `qr.label.printed` |
| `markQrLabelAttachedAction(assetId)` | `qr.label.attached` |
| `markQrLabelNeedsReplacementAction(assetId)` | `qr.label.needs_replacement` |
| `revokeQrTokenAction(assetId)` | `qr.token.revoke` |
| `bulkGenerateMissingQrTokensAction()` | `qr.token.bulk_generate` |

Each action revalidates `/equipment`, `/inventory`, `/developer-lab`,
`/command`, `/equipment/qr-labels`, `/equipment/qr-coverage`, and the
per-asset detail paths. Each writes an `audit_logs` row via
`logServerAuditEvent` so QR administration is traceable.

## UI surface

### Phase 1

- **Developer Lab** — `QrCoverageSection` shows real counts (total / without
  token / generated / printed / attached / needs replacement / revoked /
  scans recorded) and a *Generate missing tokens* action.
- **Equipment detail** — `QrIdentityPanel` is added between the metric grid
  and the risk-watch banner.
  - Developer / Admin / BME Head: full panel with token mask, generated /
    printed / attached / replaced / regenerated timestamps, and admin
    actions (Generate, Regenerate with confirm, Mark Printed, Mark Attached,
    Needs Replacement, Revoke with confirm).
  - Other roles: read-only one-line label-status badge.

### Phase 2 (this update)

- **Equipment detail `QrIdentityPanel`** now embeds:
  - A `QrLabelPreview` rendering the actual printable sticker (BMEDIS
    header, asset code, name, department, QR image, scan instruction,
    "Login required" footer) once a token exists.
  - The QR URL path (`/qr/a/<qr_token>`) displayed with the honest hint
    *"The QR URL will become active in Phase 3."* No link is rendered to
    the unimplemented route.
  - **Download PNG** — composes the sticker on an offscreen canvas via
    `renderQrLabelToDataUrl` (using a hidden `QRCodeCanvas` ref as the QR
    image source) and triggers a `bmedis-qr-<asset_code>-<name>.png`
    download. No automatic *Mark Printed*.
  - **Print Label** — opens `/equipment/qr-labels?assets=<id>&print=1` in a
    new tab; the bulk client recognises `print=1` and calls
    `window.print()` after mount. No automatic *Mark Printed*.
  - Status-aware banners: revoked tokens disable print/download and prompt
    regeneration; needs-replacement tokens warn but still allow printing a
    replacement label with the current token.
- **New route `/equipment/qr-labels`** — server-gated to `admin` /
  `bme_head` (developer always passes via `requireRole`).
  - Coverage cards mirror the Developer Lab section.
  - Filter chips: All, Generated, Printed, Attached, Needs Replacement,
    Revoked, Missing Token.
  - Search box (asset code / name / department).
  - Selectable table; non-tokenized rows are not selectable.
  - Actions: Print (selected or all visible), Generate Missing, Mark
    Selected Printed, Mark Selected Attached, Flag Selected for
    Replacement.
  - Print preview grid below the controls so users can verify what will
    be sent to the printer; `no-print` and existing print CSS hide the
    rest of the dashboard.
  - Honest amber notice: printing does NOT auto-mark printed; Phase 3
    routing pending; offline scan logging out of scope.
- **Developer Lab QR Coverage** — gains direct entry points:
  *Open QR Label Sheet*, *Print Generated (n)*, *Print Needs Replacement
  (n)*, alongside the existing Generate Missing Tokens action.
- **Equipment list** — *not* modified in Phase 2. The dedicated label
  sheet route plus the per-asset panel covers all label workflows without
  disturbing the role-tailored equipment list.

## Role impact

- No new role created.
- Capability matrix unchanged; QR admin reuses `equipment.edit`.
- Viewer, store_user, technician, department_user, department_head:
  unaffected. They cannot reach the QR admin actions because the matrix
  excludes them.

## Security model

- QR token is not a session token. Auth + RBAC still gate every read/write.
- Token generation is server-only (`crypto.randomBytes`).
- Tokens are never exposed in client component code.
- Scan logs are protected by RLS (admins + self).
- `maskQrToken` is used in admin UIs so the full token never appears in
  logs or screenshots in plain text.
- Revoked tokens are kept (not deleted) so stale scans are diagnosable.
- No `service_role` key usage on the client.

## Phase 3 — Online QR Landing Page

### Route

- `src/app/qr/a/[token]/page.tsx` — server component, intentionally outside
  `(dashboard)` so scanned QR codes do not load the full dashboard shell
  before authentication.
- `force-dynamic` + `revalidate = 0` — every scan reflects current asset
  state and writes a fresh scan row (no `next/cache` deduplication).
- Middleware: `/qr` added to `PUBLIC_PATHS` in
  `src/lib/supabase/middleware.ts` so unauthenticated users reach the route
  and see the friendly login-required screen, rather than being silently
  redirected to `/login`.

### State machine

```
isValidQrTokenFormat(token) === false
    → QrInvalidState variant="invalid"

resolveQrLandingAsset(token) → { status: 'not_found' }
    → QrInvalidState variant="not_found"

resolveQrLandingAsset(token) → { status: 'revoked' }
    → QrInvalidState variant="revoked"     (no asset details rendered)

resolution ok, no profile
    → QrLoginRequired with returnTo=/qr/a/<token>

resolution ok, profile exists
    → QrAssetLandingPage (role-aware)
```

`resolveQrLandingAsset` (added to `src/services/qr.service.ts`) returns a
discriminated union — invalid / not_found / revoked / ok — so the route
never conflates "we have no asset for this token" with "the token format is
malformed." Revoked rows return no asset payload, only the
`qr_label_replaced_at` timestamp.

### Login return flow

- `src/app/(auth)/login/page.tsx` reads `?returnTo=` from the URL and
  pushes the user there after a successful `signIn`. The path is filtered
  by `safeReturnPath(...)` which rejects anything that is not a single
  leading-slash internal path (`//evil`, `/\evil`, `http://...` etc).
- `src/lib/supabase/middleware.ts` mirrors the same check when an
  already-authenticated user lands on `/login?returnTo=...` — instead of
  always bouncing to `/`, it honours a safe returnTo path. External
  redirects are rejected.
- Existing login behaviour without `returnTo` is unchanged (still `→ /`).

### Authenticated landing — `QrAssetLandingPage`

Common top section (all authenticated, non-restricted callers):

- BMEDIS QR Scan header with logo + signed-in user + primary role badge.
- Asset code (large), asset name, condition badge, department, category +
  criticality, QR label status, QR generated date.
- Mandatory note: *"QR identifies the asset. Access and actions depend on
  your role."*

Role-aware action cards in Phase 3 were navigation only — no new workflows,
no broken links:

- **Developer / Admin / BME Head**: Open Asset Profile (primary), Create
  Maintenance Request, Review Maintenance Workflow, PM Compliance,
  Calibration Evidence, Reports. Developer additionally gets Developer Lab
  and QR Label Sheet.
- **Technician**: Open Asset Profile, View Assigned Work, Create
  Corrective Request (prefilled).
- **Store user**: Stock & Maintenance Blockers, Procurement Pipeline,
  Logistics Workflow. No maintenance-execution actions, no asset profile
  link (store roles are not granted equipment.* capabilities).
- **Department head / user (same department)**: Open Asset Profile, Create
  Maintenance Request, Create Calibration Request, Request Training, Track
  Existing Requests. All prefilled with `asset_id` and `source=qr-scan`.
- **Department head / user (different department)**: limited-access
  banner; no operational data shown.
- **Department head / user (no department on profile)**: missing-department
  banner; admin contact prompt.
- **Viewer**: Open Asset Profile, View Evidence (`#evidence` anchor),
  Reports.

Evidence summary cards (live, best-effort, real data only):

- Open requests (`maintenance_requests` filtered by open statuses).
- Open work orders (with `Latest: <status>` sub-line where available).
- PM (active) with `n overdue` sub when overdue PM exists.
- Calibration state: overdue / due_soon / current / no_history /
  unavailable — computed from the most recent `calibration_records.
  next_due_date`.

If any of the underlying queries fails (RLS denial, network), the
corresponding card shows "Not available" and a small amber notice lists
which lookups failed. The route never crashes on partial data.

### Department scope rule

For `department_head` and `department_user`:

- `profile.department_id` missing → restricted state, "your profile is
  not linked to a department".
- `profile.department_id !== asset.department_id` → restricted state,
  "this asset is not linked to your department". No further asset details
  are rendered on this branch.
- The asset card and evidence summary are only rendered when the
  department matches.
- The page never falls back to all-hospital data and never hardcodes ICU
  or Radiology.

### Scan logging (Phase 3)

Logging is **enabled** (Option A in the brief):

- On every successful authenticated resolution, the route calls
  `logQrScan({ assetId, scannedBy, roleName, scanSource: 'web',
  onlineStatus: 'online', userAgent, actionTaken: 'open_qr_landing',
  metadata: { route: 'qr.landing.v1' } })` from Phase 1.
- The call is wrapped in `try / catch`. Failures are logged to the server
  console and ignored — the page still renders.
- Unauthenticated, invalid, not-found, and revoked branches **do not**
  write a scan row.
- Refreshing the landing page intentionally writes another row in
  Phase 3. Phase 6 will introduce dedup/throttling and the scan log UI.

### Equipment detail panel link

`QrIdentityPanel` (`src/app/(dashboard)/equipment/[id]/QrIdentityPanel.tsx`)
adds, alongside the existing Phase 2 controls:

- **Open QR Page** — opens `/qr/a/<token>` in a new tab. Disabled when the
  token is missing or revoked.
- **Copy URL** — copies the fully-qualified `buildAssetQrUrl(token)` to
  the clipboard via `navigator.clipboard`.

Both controls remain restricted to developer / admin / bme_head (the
existing capability gate on the panel is unchanged).

### Security model — Phase 3 specifics

- QR token is identity only. Auth + RBAC still gate the rendered
  content. The token never appears in a server response for the
  unauthenticated or revoked branch.
- `resolveQrLandingAsset` runs on the standard authenticated/anonymous
  Supabase server client — never the service role. RLS continues to
  protect cross-role reads.
- `returnTo` is sanitised twice (login client + middleware) and rejects
  protocol-relative and absolute URLs.
- Scan logging fails closed: a failed insert never blocks the page.
- The route is excluded from the dashboard sidebar and the redirect
  table — it is only reachable by URL (i.e. by scanning a label).

### Phase 3 — limitations

- Refreshing the landing page writes a duplicate scan row (no
  client-side dedup in Phase 3).
- The action cards are navigation only. Phase 4 replaces the simple
  landing with role-specific sections and safe links to existing
  workflows.
- Evidence cards intentionally do not include full scan history or
  deduplicated scan evidence; that remains Phase 6.
- The QR scan page does not yet attempt offline behaviour; it is online
  only and labels itself as such in the footer.

## Phase 4 — Full Role-Specific QR Experience

Phase 4 upgrades the authenticated `/qr/a/[token]` page so a scanned asset
answers: *"I am physically standing in front of this asset. Based on my
role, what can I safely see or do right now?"*

### New service

- `src/services/qr-context.service.ts` is server-only and uses the normal
  Supabase server client/RLS. It never uses `service_role`.
- `getQrRoleCategory(roleNames)` maps existing roles into QR rendering
  categories: developer, bme_head (admin behaves operationally as BME
  Head), technician, department_head, department_user, store_user, viewer,
  unknown. No database roles are added.
- `getQrRoleContext({ asset, profile, client })` loads real rows only and
  records per-section query health. Query failures return unavailable /
  empty sections instead of crashing the route.
- Source tables/views documented in code comments:
  `maintenance_requests`, `work_orders`, `pm_schedules`,
  `calibration_records`, `maintenance_events`, `stock_issues` joined
  through `maintenance_events`, `specification_requests` joined to
  `procurement_requests`, `recommendation_flags`, `equipment_risk_scores`,
  and `replacement_priority_scores`.

### Page structure

The common authenticated, non-restricted page includes:

- Header: BMEDIS QR Scan, signed-in user, job title/role, online QR note,
  and the mandatory security note that QR identifies the asset while role
  controls access/actions.
- Asset identity card: asset code, name, department, category, condition,
  criticality, QR label status, and QR generation timestamp.
- Role-specific primary action cards. Actions are safe links to existing
  routes or exact records; Phase 4 does not create new inline mutations.
- Evidence tabs:
  - Current Status
  - Requests & Work
  - PM & Calibration
  - Parts / Blockers
  - History
  - QR Info (developer/admin category only)
- Footer: online QR experience; offline/PWA logging remains out of scope.

### Role action rules

- **Developer** sees the full context plus QR/debug data: masked token,
  token-format status, label lifecycle timestamps, route path/base URL,
  resolved role category, context query health, Developer Lab, QR Label
  Sheet, asset profile, maintenance, reports, and Copy QR URL. No
  service-role details or secrets are exposed.
- **BME Head/Admin** sees operational decision context: current condition,
  open requests, open work orders, assigned technician, PM/calibration
  state, recent history, risk/RPN if available, replacement band if
  available, stock blockers if available, and QR label status. Primary
  action priority is critical/high request → open work order → condition
  repair flow → PM overdue → calibration overdue → asset profile.
- **Technician** sees assigned-to-me work first, other open work second,
  quick field actions, safe history, and PM/calibration status. Maintenance
  event logging appears only when an assigned work order exists and links
  to the existing work-order event route.
- **Department Head** sees department-scoped asset readiness/request
  context only when `profile.department_id === asset.department_id`.
  Actions include maintenance request, calibration request, training
  request, request tracking, evidence/profile, and department work status.
- **Department User** sees a simpler request-focused page when in scope:
  Report Equipment Problem, Request Calibration, Request Training, Track
  Existing Request, basic asset profile/history, my requests, all
  department requests for the asset, and PM/calibration alerts.
- **Store User** sees stock/blocker/procurement context: on-hold work as
  blocker evidence, directly linked stock issues, stock recommendation
  flags, and procurement links only where the current schema has a direct
  asset bridge. No fuzzy matching is performed. Store actions never expose
  maintenance execution, assignment, completion, or procurement approval.
- **Viewer** sees a read-only management summary: asset identity, open
  issue summary, last maintenance/work evidence where available,
  risk/replacement evidence if available, asset summary, evidence, and
  reports. No mutation actions are shown.

### Department scope behavior

For `department_head` and `department_user`:

- Missing `profile.department_id` returns a restricted state.
- Department mismatch returns a restricted state.
- Restricted states do not render asset identity details, request actions,
  work/order details, or all-hospital fallbacks.
- Matching department is required before role context queries load
  operational rows for department-scoped roles.

### Data integrity and security

- No fake rows, generated narrative summaries, hardcoded IDs, or invented
  blockers.
- Stock evidence is direct only: stock issues must link through
  `maintenance_events.asset_id`; procurement must link through
  `specification_requests.procurement_request_id`; stock flags must be real
  `recommendation_flags`.
- No unauthenticated asset details; invalid/not-found/revoked behavior from
  Phase 3 is unchanged.
- Revoked tokens still render no asset metadata.
- QR token is never treated as permission.
- Viewer receives no mutation actions; Store receives no maintenance
  execution actions; Department User receives no BME workflow controls.

### Scan logging in Phase 4

- Phase 3 scan logging remains enabled.
- Metadata route label is updated to `qr.landing.v2` and includes the
  resolved role category.
- Phase 4 does not add scan history UI, deduplication, action-click
  logging, or schema changes.

### Phase 4 — limitations

- Phase 5 coverage expansion is now delivered.
- No Phase 6 scan history, dedup, analytics dashboard, or scan log UI.
- No offline/PWA/service worker/IndexedDB/offline queue work.
- No new migration; the next migration remains 00046 if needed later.

## Phase 5 — QR Coverage Expansion

Phase 5 answers: *"Which hospital assets are physically ready to be scanned,
and which still need QR labels generated, printed, attached, replaced, or
revoked?"*

### Readiness states

Readiness is derived only from `equipment_assets` QR lifecycle columns:

| Readiness | Rule |
|---|---|
| Ready to Scan | `qr_token` exists, `qr_label_status = 'attached'`, and status is not revoked. |
| Needs Label Generation | `qr_token IS NULL` or `qr_label_status = 'not_generated'`. |
| Needs Printing | `qr_token` exists and `qr_label_status = 'generated'`. |
| Needs Attachment | `qr_label_status = 'printed'`. |
| Needs Replacement | `qr_label_status = 'needs_replacement'`. |
| Invalid / Revoked | `qr_label_status = 'revoked'`. |

These are physical label-readiness states only. They do not imply Phase 6
scan-history coverage or deduplicated field evidence.

### Equipment list

- Developer / Admin / BME Head see QR summary cards, QR status filter, QR
  status badge column, row selection, and a QR bulk action toolbar.
- QR status labels on the list: No Token, Generated, Printed, Attached,
  Needs Replacement, Revoked.
- Row actions link to the exact asset QR panel (`/equipment/[id]#qr-identity`),
  print the selected label through `/equipment/qr-labels`, and reuse existing
  server actions for Generate, Mark Printed, Mark Attached, Needs Replacement,
  Regenerate, and Revoke.
- Viewer, Store, Technician, Department Head, and Department User tailored
  equipment views do not receive QR admin controls.

### QR coverage drilldown

- New route: `/equipment/qr-coverage`.
- Access: developer / admin / bme_head only (`requireRole(['admin',
  'bme_head'])`; developer passes through the existing helper).
- Coverage cards: Total Active Assets, Assets Without QR Token, Generated
  Labels, Printed Labels, Attached Labels, Needs Replacement, Revoked, and
  Scan Records Existing.
- Tables: Missing QR Tokens, Generated Not Printed, Printed Not Attached,
  Needs Replacement, Revoked Labels, Recently Regenerated.
- Columns: asset code, asset name, department, category, criticality, QR
  status/readiness, generated/printed/attached timestamps, last lifecycle
  update, and next action.
- Bulk actions reuse Phase 1/2 actions: Generate Missing Tokens, Print
  Selected Labels, Mark Selected Printed, Mark Selected Attached, and Mark
  Selected Needs Replacement. Bulk revoke/regenerate is intentionally not
  added in Phase 5.

### Developer Lab and labels

- Developer Lab QR Coverage now links to `/equipment/qr-coverage` in addition
  to QR Label Sheet, Print Generated, and Print Needs Replacement.
- Developer Lab phase banner now states: Phase 1 identity complete, Phase 2
  labels complete, Phase 3 landing route complete, Phase 4 role-specific
  experience complete, Phase 5 coverage expansion current, and Phase 6 scan
  logging/evidence next.
- `/equipment/qr-labels` links back to QR Coverage for operational handoff.

### Report / export entry point

- Reports adds a Developer/Admin/BME Head-only "QR Coverage Evidence Report"
  at `/reports/qr-coverage`.
- The report uses existing report/PDF export infrastructure and reads
  `equipment_assets` QR fields. It does not create scan history, scan trends,
  or deduplicated scan analytics.

### Phase 5 — limitations

- Scan history, scan evidence, and page-render deduplication are now delivered
  in Phase 6. Action-click tracking remains out of scope.
- No offline/PWA/service worker/IndexedDB/offline queue.
- No fake scan data, hardcoded QR counts, or generated token values.
- No automatic Mark Printed or Mark Attached after printing.

## Phase 6 — QR Scan Logging and Evidence

Phase 6 answers:

- Which assets are being scanned?
- Who scanned them?
- Which role scanned them?
- When were they scanned?
- Which attached QR labels have never been scanned?
- Which assets and departments show QR field activity?

### Deduplication

- Constant: `QR_SCAN_DEDUP_WINDOW_MINUTES = 5`.
- Dedup applies only to `action_taken = 'open_qr_landing'`.
- Before inserting a page-render scan, `logQrScan` checks whether the same
  profile scanned the same asset with `open_qr_landing` in the last five
  minutes.
- If a matching row exists, no new row is inserted and the existing scan id is
  returned to the caller.
- Dedup failures fail open: scan logging remains best-effort and never blocks
  QR page rendering.
- Existing historical duplicates are not deleted or rewritten.

### Scan evidence services

`src/services/qr.service.ts` now also exports:

- `getQrScanHistory(filters)` — admin scan table rows with asset/profile
  display fields and no raw user-agent exposure.
- `getAssetQrScanSummary(assetId)` and `getRecentAssetQrScans(assetId)` —
  equipment-detail scan evidence.
- `getQrScanCoverageStats()` — Developer Lab cards/tables: total scans,
  scans last 7 days, attached assets never scanned, most scanned asset, scans
  by role, scans by department, recent scans, and revoked/needs-replacement
  scan risks.
- `getAssetsNeverScanned()`, `getAttachedAssetsNeverScanned()`,
  `getMostScannedAssets(limit)`, `getQrScansByRole()`,
  `getQrScansByDepartment()`, and `getQrAssetScanMetrics()`.
- `shouldLogQrScan(...)` — the app-level dedup decision helper.

### UI surfaces

- Reusable table: `src/components/qr/QrScanHistoryTable.tsx`.
- Equipment detail `QrIdentityPanel`: Developer/Admin/BME Head see a
  collapsible QR Scan Evidence section with total scans, last scanned by,
  roles observed, recent scans, and a link to full scan history.
- Developer Lab QR section: adds Total QR Scans, Scans Last 7 Days, Attached
  Assets Never Scanned, Most Scanned Asset, Scans by Role, Scans by
  Department, Recent QR Scans, Attached Assets Never Scanned, and
  Revoked/Needs-Replacement Scan Risks.
- QR Coverage drilldown: adds scan-aware groups (Never Scanned, Scanned
  Recently, Attached Never Scanned, Revoked Recently Scanned) plus total
  scans, last scanned, last role, and scan count last 30 days columns.
- Full route `/equipment/qr-scans`: Developer/Admin/BME Head-only scan
  history with date, role, department, asset, online status, scan source, and
  action filters.

### Reports

- `/reports/qr-scan-evidence` adds a Developer/Admin/BME Head-only QR Scan
  Evidence Report using the existing report/PDF infrastructure.
- The report uses `equipment_qr_scans` joined to asset and profile display
  data. It does not expose raw `user_agent` in the standard table.

### Access and privacy

- Full scan evidence is visible only to developer/admin/bme_head.
- Viewer, Store, Technician, Department Head, and Department User do not see
  scan history UI in Phase 6.
- Public, invalid, revoked, and unauthenticated QR branches still expose no
  scan history and do not create scan rows.
- Scanner display uses full name, then email, then "Unknown user"; raw profile
  UUIDs are not primary UI text.

### Phase 6 — limitations

- No offline scan logging, PWA, service worker, IndexedDB, background sync,
  browser notifications, or real `synced_later` queue behavior.
- No action-click tracking. Scan rows remain QR landing/render evidence.
- No fake scan rows, hardcoded scan counts, generated adoption rates, or
  destructive duplicate cleanup.

## Phase 2 — implementation details

### QR URL helper (`src/utils/qr/url.ts`)

- `getQrBaseUrl()` — resolves the public base URL with the priority:
  `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_VERCEL_URL`
  (prefixed with `https://`) → `http://localhost:3000`. No production
  domain is hardcoded.
- `buildAssetQrPath(qrToken)` returns `/qr/a/<token>` or `null` when the
  token is missing/malformed (validated via `isValidQrTokenFormat`).
- `buildAssetQrUrl(qrToken)` returns the fully qualified URL that is
  encoded into the QR image. Returns `null` for invalid tokens so callers
  never accidentally print a `qra_invalid` QR.

### QR image generation

- Local — uses the already-installed `qrcode.react`. No external QR API.
- `src/components/qr/QrCodeImage.tsx` wraps `QRCodeSVG` / `QRCodeCanvas`
  with error correction **M**, a quiet-zone margin, dark-on-light colours.
- `QrLabelPreview` renders the on-screen + print sticker.
- `QrLabelPrintSheet` renders a CSS-grid sheet that reflows cleanly onto
  printed pages.
- `src/utils/qr/render.ts` composes the per-asset PNG by drawing onto an
  offscreen canvas alongside a hidden `QRCodeCanvas` ref. Provides
  `renderQrLabelToDataUrl`, `createQrLabelFileName`, `sanitizeFileName`,
  and `triggerDataUrlDownload`.

### Service additions

- `getQrLabelAssets({status?, search?, ids?})` — filtered fetch of
  active assets with their QR metadata + department + category, using
  Supabase joins; never returns synthetic rows.
- `getQrLabelAsset(assetId)` — single fetch.
- `bulkMarkQrLabelsPrinted / Attached / NeedsReplacement(ids)` — only
  update assets with `qr_token` present; reports `{ updated, skipped }`.

### Action additions (`src/actions/qr.actions.ts`)

- `markQrLabelsPrintedBulkAction(ids)` → audit `qr.label.printed.bulk`
- `markQrLabelsAttachedBulkAction(ids)` → audit `qr.label.attached.bulk`
- `markQrLabelsNeedsReplacementBulkAction(ids)` → audit
  `qr.label.needs_replacement.bulk`

All three gate on `equipment.edit` capability and revalidate
`/equipment`, `/inventory`, `/developer-lab`, `/command`, and
`/equipment/qr-labels`.

## Limitations and not-in-scope

Deliberately NOT in Phase 1:

- QR label image generation / PDF / print sheet. **(Now delivered in Phase 2.)**
- `/qr/a/[token]` public landing page. **(Now delivered in Phase 3.)**
- Role-aware scan experience. **(Now delivered in Phase 4.)**
- Scan logging UI. **(Now delivered in Phase 6.)**
- Equipment list QR status column / filter. **(Now delivered in Phase 5.)**
- Auto token generation in seed/migrations.

Deliberately NOT in Phase 2 (now delivered in Phase 3):

- `/qr/a/[token]` route — **delivered in Phase 3.**
- Any scan logging UI or scan history report.
- Role-aware scan experience. **(Now delivered in Phase 4.)**
- Automatic *Mark Printed* / *Mark Attached* on print / download —
  lifecycle is always an explicit user action.
- Offline scan logging / PWA / service worker / IndexedDB queue. These
  are **out of scope for the current six-phase QR plan**; if the project
  pursues offline behaviour later, it is a separate initiative.
- Scan history/deduplication/evidence dashboards. **(Now delivered in Phase 6.)**

## Phase plan (canonical — Phase 6 is the current end)

| Phase | Feature | Status |
|---|---|---|
| 1 | QR Identity Foundation | ✅ delivered |
| 2 | QR Label Generation and Management | ✅ delivered |
| 3 | Online QR Landing Page (`/qr/a/[token]`) | ✅ delivered |
| 4 | Role-Specific QR Experience | ✅ delivered |
| 5 | QR Coverage Expansion | ✅ delivered |
| 6 | QR Scan Logging and Evidence | ✅ delivered (final planned QR phase) |

Deliberately NOT in Phase 6:

- Offline scan logging, PWA, service worker, IndexedDB queue.
- Background sync, browser notifications, and real `synced_later` queue behavior.
- Action-click tracking and non-render workflow analytics.
- Automatic cleanup/removal of historical duplicate scan rows.
- New DB migration or schema redesign.

Offline / PWA scan workflows are intentionally **not** part of this plan.
They remain a separate future project, scoped outside the six-phase roadmap.

## Manual deployment steps

After merging Phase 1 (still required if not already applied):

```
supabase db push --linked
npx supabase gen types typescript --linked > src/types/database.ts
npx tsc --noEmit
npm run lint
```

Phase 2 adds no migrations or environment variables, so no extra DB step
is required for this release. To switch the QR encoding away from
`http://localhost:3000`, set one of:

```
NEXT_PUBLIC_APP_URL=https://your-domain
# or
NEXT_PUBLIC_SITE_URL=https://your-domain
# or rely on the Vercel default NEXT_PUBLIC_VERCEL_URL
```

After that, the Developer Lab "Generate missing tokens" button can be used
to issue tokens for all 80 existing assets. No seed data is modified.
