# Final Demo Bugfix Validation

Date: 2026-05-29

## Runtime And Branch Check

- Current repository: `/Users/beamlak/Desktop/bmedis_menilik/bmedis_menilik`
- Current branch: `main`
- Runtime finding: this repository's dev server is on `http://localhost:3001` because `http://localhost:3000` is already served by a different checkout at `/Users/beamlak/Desktop/project_v2`.
- Important implication: testing `localhost:3000` will not exercise this repository's fixes.

## 1. QR Redirect Validation

Verified with:

```bash
curl -I 'http://localhost:3001/equipment/test-asset?tab=qr'
```

Expected and observed in this repo:

- Protected equipment deep links redirect to `/login?returnTo=%2Fequipment%2Ftest-asset%3Ftab%3Dqr`.
- `returnTo` preserves the original path and query string.
- `safeReturnPath` accepts same-origin relative paths and rejects `https://evil.com`, `//evil.com`, `/\evil`, backslash paths, and trimmed/spaced values.
- Direct `/login` still falls back to `/command`.

Manual browser validation still needed with real demo credentials:

1. Sign out.
2. Open the actual QR URL or `/equipment/<assetId>?tab=qr` on `localhost:3001`.
3. Confirm the login URL contains `returnTo`.
4. Log in.
5. Confirm the browser lands on the original QR/equipment destination.

## 2. Corrective Maintenance Validation

Runtime path checked:

- Technician completion button in `src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx` calls `updateWorkOrderAction`.
- Offline completion replay also calls `updateWorkOrderAction`.
- The canonical action updates work order status, linked maintenance request status, equipment condition/status, reliability evidence, asset analytics, notifications, and route revalidation.

Expected DB state after completion:

- `work_orders.status = completed`
- linked `maintenance_requests.status = completed`
- linked `maintenance_requests.resolved_at` populated
- `equipment_assets.condition = functional` when repaired/returned to service
- `equipment_assets.status = active` only when safe to reactivate
- one `work_order.completed:<workOrderId>` notification event

Manual validation still needed against the real Supabase project because local DB/API access was not available inside this run.

## 3. Notification Validation

Runtime paths checked:

- Work-order completion emits `work_order.completed`.
- Part-needed declaration emits `work_order.part_requested`.
- Stock issue emits `work_order.part_issued`.
- Notification UI reads `notifications`; the event engine processes `notification_events` into in-app rows and delivery rows.
- Telegram delivery is best-effort and does not block the workflow.

Expected event keys:

- `work_order.completed:<workOrderId>`
- `work_order.part_requested:<needId>`
- `work_order.part_issued:<needId>` or `work_order.part_issued:<issueId>`

## 4. Spare-Part Request / Issue Validation

Runtime paths checked:

- Work-order parts panel calls `declareWorkOrderPartNeededAction`.
- Store stock issue modal calls `createStockIssueAction`.
- Stock issue accepts `work_order_id` and `need_id`, marks the matching need `fulfilled`, and notifies the original requester.
- Store command center now uses canonical `work_order_parts_needed` blockers instead of fake approved maintenance request handoff counts.

Manual validation:

1. Technician declares a needed part from a work order.
2. Store user sees the blocker notification and work-order blocker row.
3. Store user issues the linked part with `work_order_id` and `need_id`.
4. Technician receives in-app and Telegram notification if configured.
5. Refresh does not duplicate the notification.

## 5. Viewer PMC Validation

Fix validation:

- BME Head PM page and Viewer compliance page use the same department PM compliance helper.
- Viewer command center PM headline now uses the same helper/source instead of its own separate `pm_schedules` rollup or stale `pm_compliance_metrics`.
- The helper reads live `pm_schedules` with equipment/department context.
- The viewer no-data state should now appear only if live PM schedules are actually unreadable or absent.

Manual validation:

1. Log in as BME Head on `localhost:3001`.
2. Record the department PM compliance rows.
3. Log in as Viewer on `localhost:3001`.
4. Open `/compliance` and `/command`.
5. Confirm the same department PMC rows and matching headline percentage.

## 6. Profile Setup Flicker Validation

Fix validation:

- `useProfile` now resets profile state deliberately on auth-user changes and sets loading before fetching.
- Dashboard layout shows `Profile Setup Required` only when `profileError` is present after profile/role loading.
- Normal route changes should show a loader instead of a false setup page.

Manual validation:

1. Log in as a valid demo user.
2. Navigate between dashboard pages.
3. Confirm no `Profile Setup Required` flash appears.
4. Confirm a deliberately unlinked auth user still sees the setup error.

## 7. Readiness Opacity Validation

Fix validation:

- Viewer command center card explanation text and department readiness rule explanation now use stronger foreground contrast.
- The explanation is visible without hover and is readable in light/dark themes.

## 8. Hanna Account Validation

Changes:

- Removed `technician@bmerms-demo.local` from BMERMS demo-user setup and auth-link seed scripts.
- Preserved `technician@bmedis-menelik.local` in the Menelik/BMEDIS setup.
- Added a migration that updates only the exact BMERMS Hanna profile email to `hanna.g@menelikii.gov.et`, clears its auth link, and deletes only the exact BMERMS auth user.

Validation:

- `technician@bmerms-demo.local` no longer appears in demo setup or auth-link seed files.
- `technician@bmedis-menelik.local` remains.

## 9. Stock Dashboard Validation

Changes:

- Removed the store command center card/list based on the fake `approvedItemsToIssue` approximation.
- Removed the `fetchStoreIssueQueue` helper that used `maintenance_requests.status = approved` as an issue queue.
- Kept real store workflows: stock blockers, receiving, stock movement, procurement, and linked part issue actions.

Manual validation:

1. Log in as store user.
2. Open `/command`.
3. Confirm no “Approved Items to Issue” or “3 approved items to issue” card/list appears.
4. Confirm blocker and stock issue links still work.

## Exact Commands Run

```bash
pwd
git branch --show-current
git status --short
rg --files -g 'middleware.ts' -g 'proxy.ts'
npm run dev
curl -I 'http://localhost:3001/equipment/test-asset?tab=qr'
curl -I 'http://localhost:3001/login?returnTo=%2Fqr%2Fa%2Ftoken123'
ps -axo pid,command
npm run build
npx tsx --test src/services/__tests__/auth-return-path.test.ts src/services/__tests__/pmc-live-source.test.ts src/services/__tests__/store-procurement-handoff.test.ts src/services/notifications/__tests__/workflow-events.test.ts src/utils/maintenance/__tests__/status-helpers.test.ts src/utils/maintenance/__tests__/work-order-transitions.test.ts
npm run test:system-fix
kill 33498 33512 33513
```

Results:

- `npm run build`: passed.
- Targeted workflow tests: 26 passed.
- `npm run test:system-fix`: 613 passed.
- QR protected-route HTTP check: returned `307` with preserved `returnTo`.
- Dev server started for validation on `localhost:3001` and then stopped.

## Known Limitations

- Real Supabase DB rows and remote migration state were not verified from this environment.
- The migration file exists locally; apply it to the target Supabase project with the repository's normal migration command before testing deployed data.
- Browser E2E login could not be completed here because local Playwright/Chromium sandbox startup failed in this environment; redirect behavior was verified with HTTP responses and unit tests.
- The old dev server at `localhost:3000` is a different checkout; stop it or test `localhost:3001` for this repository.
