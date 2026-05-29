# Corrective Maintenance / QR / Notifications / PMC Validation

## Roles And Accounts

- Department user: creates corrective maintenance requests from equipment QR/detail pages.
- BME Head: approves requests and assigns technicians.
- Technician / clinical engineer: starts and completes work orders; declares needed parts.
- Store user: receives part-request notifications and issues stock.
- Viewer: reads compliance overview only.

## QR Deep-Link Return

1. Log out.
2. Open `/qr/a/<valid-token>` or a protected route such as `/equipment/<asset-id>?tab=qr`.
3. Confirm the app sends the user to `/login?returnTo=<encoded-original-path-and-query>`.
4. Log in.
5. Confirm the browser lands on the exact original QR/equipment URL.
6. Open `/login` directly and log in; confirm it lands on `/command`.
7. Try `returnTo=https://evil.com`, `returnTo=//evil.com`, and `returnTo=/\evil`; confirm all fall back to `/command`.

## Corrective Maintenance Completion

1. As department user, create a corrective request for a functional or faulty asset.
2. As BME Head, approve it and create or assign the linked work order.
3. As technician, start work and then complete it with outcome `resolved` and final condition `functional`.
4. Verify database state:
   - `work_orders.status = completed`
   - linked `maintenance_requests.status = completed`
   - linked `maintenance_requests.resolved_at` is set
   - `equipment_assets.condition = functional`
   - `equipment_assets.status = active` unless the asset is disposed, decommissioned, or in storage
   - one `notification_events` row exists with `dedupe_key = work_order.completed:<work_order_id>`
   - the requesting department user has a `notifications` row for `work_order.completed`
5. Verify UI state:
   - department request page shows completed
   - BME Head Command Center no longer lists the work as active
   - technician work-order page shows completed evidence
   - a new corrective request is no longer blocked by the completed work order
6. Repeat completion save or refresh; confirm notifications are not duplicated.

## Spare Part Request And Issue

1. As technician, open an active work order and declare a spare part need.
2. Verify store users receive in-app notification `work_order.part_requested`.
3. If Telegram is configured and store users have chat IDs, verify Telegram delivery; if not configured, confirm the workflow still succeeds and records a skipped delivery.
4. Open the notification link; confirm `/spare-parts?action=issue` is prefilled with `partId`, `quantity`, `work_order_id`, and `need_id`.
5. As store user, issue the part.
6. Verify:
   - stock decreases by the issued quantity
   - `work_order_parts_needed.status = fulfilled`
   - requesting technician receives `work_order.part_issued` in-app notification
   - Telegram is sent when configured
   - repeated refresh does not duplicate the notification event

## Viewer PMC

1. Log in as BME Head and open `/pm`.
2. Record the department PM compliance rows and percentages.
3. Log in as Viewer and open `/compliance`.
4. Confirm Viewer shows the same department rows and percentages.
5. Confirm Viewer has no edit controls for PM records.
6. Confirm “No PM schedule history available” only appears when `pm_schedules` has no readable rows.
