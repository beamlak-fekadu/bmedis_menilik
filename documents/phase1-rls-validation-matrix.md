# Phase 1 — Live RLS/Role Validation Matrix

Manual validation steps to confirm Phase 1 fixes work against the deployed
Supabase project. Cannot be executed without browser/credentials, so the
artifact is the checklist itself.

## Pre-flight

1. Apply pending migrations:
   ```bash
   supabase db push --linked
   ```
   Latest migration after Phase 1: `00073_notification_self_test_rls.sql`.

2. Regenerate types:
   ```bash
   npx supabase gen types typescript --linked > src/types/database.ts
   ```

3. Confirm demo role integrity panel in Developer Lab shows 7/7 OK.

4. Confirm beamlak.work@gmail.com is linked to a profile with role=developer.

## Demo role test users

The seed file `99_link_auth_users.sql` defines mappings between auth users
and seeded profile rows. Use those credentials. NEVER commit passwords.

| Role | Demo email |
|---|---|
| Developer | beamlak.work@gmail.com |
| BME Head | bmehead@bmerms-demo.local |
| Technician | technician@bmerms-demo.local |
| Department Head (Radiology) | depthead_radiology@bmerms-demo.local |
| Department User (Radiology) | deptuser_radiology@bmerms-demo.local |
| Store User | store@bmerms-demo.local |
| Viewer | viewer@bmerms-demo.local |

## Test matrix

### Service worker / offline (OFF-01)

- [ ] Sign in as BME Head, visit `/command`, `/equipment`, `/maintenance`,
      then `/equipment/<id>`. Wait 5s on each.
- [ ] DevTools → Application → Service Workers → confirm `sw.js v2` active.
- [ ] Set Network throttle to Offline.
- [ ] Refresh `/equipment` → should load (from PAGES_CACHE).
- [ ] Refresh `/equipment/<id>` → should load.
- [ ] Visit a route never visited before → falls back to `/offline` shell.
- [ ] Confirm `/login` is NOT cached (auth pages excluded).

### Offline queue + sync evidence (OFF-02, OFF-03)

- [ ] Sign in as Technician. Open a WO detail page.
- [ ] Click "Complete Work Order" → "Save Draft" (NOT Confirm Completion).
- [ ] Confirm toast says "Completion intent saved offline. Work order
      remains open until you reconnect and confirm completion."
- [ ] DevTools → IndexedDB → `bmedis_offline_v2` → action queued.
- [ ] Reconnect online → app auto-syncs.
- [ ] `/offline-sync` → action shows synced.
- [ ] `offline_sync_events` table has the row (Supabase Studio).
- [ ] Work order status still NOT 'completed' (per OFF-02 expectation).
- [ ] To verify OFF-03: temporarily simulate `offline_sync_events` insert
      failure (drop INSERT RLS, push, retry); confirm the queue record's
      metadata.evidence_write_failed becomes true.

### Notification engine (NOTIF-01, NOTIF-02, NOTIF-03)

- [ ] Sign in as BME Head. Open a corrective maintenance request. Click
      Approve, then create a work order, assign to a technician.
- [ ] Sign in as that technician. Confirm in-app notification "Work
      assigned to you" appears in NotificationBell. (NOTIF-01)
- [ ] Sign in as Department User; submit a calibration request.
- [ ] Sign in as BME Head; reject the request.
- [ ] Sign in back as Department User → confirm "Calibration request
      rejected" notification with link to `/calibration/requests/<id>`.
      (NOTIF-02)
- [ ] Sign in as Technician; create a calibration record with result=fail.
- [ ] Sign in as BME Head → confirm "Calibration result requires
      attention" notification with link to `/calibration/records/<id>`.
      (NOTIF-02)
- [ ] Sign in as Viewer. Open `/notifications` → click "Send test
      notification". Confirm self-test toast says success (NOT "denied").
      (NOTIF-03)
- [ ] Confirm `notifications` row exists with recipient = viewer profile id.

### PM completion transactionality (PM-01)

- [ ] Sign in as Technician. Complete a PM schedule with all required fields.
- [ ] Confirm toast says "PM completion evidence recorded".
- [ ] Confirm pm_completions, pm_schedules.status=completed, pm_plans
      next_due_date and equipment condition all updated.
- [ ] Simulate failure: temporarily drop the pm_plans UPDATE RLS so
      the planUpdate fails. Complete PM again.
- [ ] Confirm toast shows "PM completion recorded with 1 warning(s)"
      and a separate warning toast lists the plan update failure.
- [ ] Confirm pm_completions row exists, pm_schedules.status=completed.

### .single() coercion sweep (SHAPE-01)

- [ ] Sign in as Viewer. Manually fire the calibration update action via
      browser console (e.g. POST to the action route with a calibration
      request id). Confirm error message says "You do not have permission
      to change this calibration request..." — NOT "Cannot coerce the
      result to a single JSON object".

### Ambiguous embed sweep (EMBED-01)

- [ ] Sign in as BME Head, open `/command`. Confirm critical action strip
      and triage tabs render rows with assigned technician name shown.
- [ ] No console PGRST201 errors in Network tab.

### Analytics refresh truth (ANALYTICS-01)

- [ ] Sign in as BME Head, edit an equipment asset (change name).
- [ ] If recompute fails (simulate by dropping fn_recompute_*), confirm
      action returns with `analytics_refresh_warning` and `audit_logs`
      row `equipment.analytics_refresh_failed` exists.

### Calibration department access (PART 9)

- [ ] Sign in as Department User (Radiology).
- [ ] Open `/calibration`. Confirm "New Request" / "Request Calibration"
      buttons are visible.
- [ ] Submit a calibration request for an asset in Radiology → success.
- [ ] Attempt to submit for an asset in another department → blocked
      with "outside your department" error.
- [ ] Same flow as Department Head (Radiology).
- [ ] Sign in as Viewer. Open `/calibration`. Confirm "New Request"
      button is NOT shown.
- [ ] Sign in as Store User. Open `/calibration`. Confirm "New Request"
      button is NOT shown.

### Negative tests (RLS denial)

- [ ] Sign in as Viewer. Try `updateRequestStatusAction` directly
      (curl with viewer's auth cookie). Confirm "You do not have
      permission" structured error (NOT raw PGRST116).
- [ ] Sign in as Department User from Radiology. Try
      `createWorkOrderAction` with payload referencing an asset from
      Pharmacy. Confirm denial.

### Telegram (optional)

- [ ] Set `TELEGRAM_NOTIFICATIONS_ENABLED=false` env var. Re-run a WO
      assignment → in-app notification still appears; delivery log row
      shows `skipped: telegram_disabled_or_missing_token`.

## Reporting back

For each row above, mark ✓ / ✗ / SKIPPED with the reason. SKIPPED is
allowed if a prerequisite (Telegram bot token, additional roles) is not
configured; mark the env as the blocker.
