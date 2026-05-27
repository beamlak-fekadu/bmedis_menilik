# R35 — Manual Browser Validation Checklist

Final pre-evaluation sign-off. Every box must be checked on the **deployed
`system_fix` Vercel preview** using **real demo accounts** before the
biomedical engineering team performs validation. Code-level checks (tsc,
lint, build, unit tests) do not substitute for these — they catch syntax,
not runtime browser/integration behavior.

## Pre-flight

- [ ] All migrations through `00065_stock_receipt_crossed_up.sql` applied on
      the linked Supabase project. Verify in Developer Lab → "Last refresh"
      and migration history view.
- [ ] `npx supabase gen types typescript --linked > src/types/database.ts`
      run after the last migration; commit pushed; Vercel preview rebuilt.
- [ ] Developer Lab → **Demo role integrity** shows 7/7 OK.
- [ ] Developer Lab → **Validation fixtures** has zero `missing` warnings
      (R34 readiness panel).

## Service worker, PWA, offline

- [ ] Open BMEDIS in a fresh incognito window, log in once, refresh — page
      still loads with the service worker registered (DevTools → Application
      → Service Workers).
- [ ] Go offline (DevTools Network → Offline), refresh a previously-visited
      cached page → app shell renders, cached read data is visible with a
      "stale" notice.
- [ ] Queue a maintenance request offline → it appears in the local queue
      (Developer Lab → Offline Diagnostics). Reconnect → request lands in
      `maintenance_requests` and the queue row marks synced.
- [ ] No claim of "Background Sync" anywhere in the UI (R13).

## QR scan, mobile

- [ ] Generate a QR token for a test asset → print preview opens → mark
      printed → mark attached. QR Coverage page reflects each transition.
- [ ] Scan the printed QR with a phone (back camera): land on
      `/qr/a/<token>`. Log in. Page shows role-aware actions for the active
      profile (Department Head sees dept-scoped content, technician sees
      maintenance options, etc.).
- [ ] Revoke a token, scan as logged-out user: shows safe revoked state,
      NO asset details. As logged-in admin: a `qr.revoked_scanned`
      notification arrives in the Notification Center within ~10s (R16).
- [ ] Scan the SAME asset twice within 5 minutes → only one row in
      `equipment_qr_scans` (R31 dedup).

## Notifications + Telegram

- [ ] Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_DEV_MONITOR_CHAT_ID` in Vercel
      env. Redeploy.
- [ ] Connect a real Telegram chat id to every demo role via
      `saveTelegramConnectionAction`.
- [ ] Send a test notification to the monitor chat → arrives within ~5s.
- [ ] Send role-specific samples (each of 6 SAMPLE_VARIANTS) → arrives in
      the real role's chat AND a copy in the monitor chat.
- [ ] Trigger a real workflow notification (record a failed calibration →
      R6 emits `calibration.failed_or_adjusted` → BME Head receives in-app
      + Telegram).
- [ ] Run Notification Rule Check from Developer Lab → per-scan results
      show counts and no column-name errors (R1 + R20). Calibration overdue
      scan is present.
- [ ] Issue stock to zero on a test part → Store User receives
      `spare_part.stockout` (R9). Issue to below reorder but above zero →
      `spare_part.low_stock`. Receive stock back above reorder →
      `spare_part.restocked` (R9 crossed_up).

## Reliability + maintenance evidence

- [ ] Pick a test asset with prior MTTR/MTBF/availability values from
      Developer Lab → Score Snapshot Timestamps.
- [ ] Create a corrective WO → start → complete WITH repair_duration_hours,
      downtime_start, downtime_end, failure_date filled in.
- [ ] Confirm `maintenance_events` row was auto-written; `downtime_logs`
      row was derived by trigger from migration 00061.
- [ ] Refresh analytics from Developer Lab; per-metric `lastRefreshAfter`
      moves for availability/mtbf/mttr/pm_compliance.
- [ ] Equipment detail page shows the new MTTR/MTBF/availability values.
- [ ] Repeat without reliability fields → completion succeeds, warning
      toast surfaces "completed without reliability evidence" (R2).

## Roles + RBAC negative

For each demo role (Viewer, Department Head, Department User, Store User,
Technician, BME Head, Admin):

- [ ] Log in → land on the appropriate home page.
- [ ] Try to open a route the role should NOT have via direct URL → see
      the server-side "Access restricted" page (R23). Pages tested:
      - `/developer-lab` (only developer)
      - `/audit` (only developer/admin/bme_head)
      - `/offline-sync` (only developer/admin/bme_head)
      - `/settings?tab=staff-access` (only developer/admin/bme_head)
      - `/equipment/qr-coverage` (only developer/admin/bme_head)
- [ ] Department roles attempting to read an out-of-department asset →
      no rows leaked through any service (R4).

## Request → WO lifecycle

- [ ] As Department User, create a maintenance request → request status =
      `pending`.
- [ ] As BME Head, create a work order from the request → request status
      flips to `assigned` (R17); requester receives a
      `maintenance_request.status_changed` notification.
- [ ] Request detail page shows the linked work order.
- [ ] As Technician, start the WO → asset condition becomes
      `under_maintenance`.
- [ ] As Technician with only `work_order.add_event` (synthetic — not in
      production matrix), confirm attempting completion is rejected by the
      per-transition gate (R18). BME Head can complete.

## Reports

- [ ] For each report under `/reports/[type]`, generate, compare against
      the matching dashboard card, and export CSV + PDF.
- [ ] Privileged reports (`/reports/offline-sync-evidence`,
      `/reports/qr-coverage`, `/reports/qr-scan-evidence`,
      `/reports/audit`) render only for the right roles.
- [ ] Report-generated-at + data-snapshot-at appear in every export.

## Copilot

- [ ] As Viewer, ask "Why is this metric zero?" on Command Center → answer
      cites source tables and a freshness state, does NOT invent values.
- [ ] As BME Head, ask "What's the most urgent action right now?" →
      explains Critical Action Score components.
- [ ] As Store User, ask "Which parts are blocking work?" → cites
      `work_order_parts_needed` declared blockers.
- [ ] Viewer cannot create any mutation draft (gated in Copilot RBAC).
- [ ] No raw JSON / generic filler in any normal-role response.

## Final integration walk-throughs

These are the end-to-end flows that exercise multiple risks together:

1. **Full repair lifecycle:** Department User request → BME Head WO →
   Technician completion with reliability evidence → analytics refresh →
   report KPI matches dashboard → notification reached requester.
2. **Stock blocker → procurement → receipt:** Technician declares part
   need → Command Center stock blocker appears → BME Head approves
   procurement → status flips to delivered → Store User receives
   `procurement.delivered_pending_receipt` deep-link → records receipt →
   stock crosses upward → `spare_part.restocked` notification → blocker
   clears.
3. **QR scan in the field:** Admin generates + prints + attaches label →
   Technician scans on phone → role-aware page renders → tech logs a
   maintenance event from the scan → analytics refresh → equipment detail
   reflects the new event.
4. **Replacement → disposal handoff (R32):** Developer Lab refreshes
   analytics → high-RPI asset surfaces on `/replacement` → BME Head opens
   `/command/drilldown/replacement/[assetId]` → launches prefilled
   disposal request → row carries `source_replacement_score_id` linking
   back to the RPI evidence.

## Sign-off

Sign-off requires every box above checked AND the chatbot test suite +
phase-tests still pass after deployment:

- [ ] `npm run test:chatbot` ✓
- [ ] `npm run test:system-fix` ✓
- [ ] `npm run build` clean on the deployed branch
- [ ] Public README and validation notes reflect the deployed state

If any box fails, do not sign off. Re-open the corresponding R# fix and
re-run the affected workflow before granting evaluation access.
