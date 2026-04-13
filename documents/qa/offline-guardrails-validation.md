# Offline and Data-Guardrail Validation

Date: 2026-04-13

## Offline queue validation

Scope:
- `src/lib/offline/technician-queue.ts`
- `src/app/(dashboard)/maintenance/work-orders/[id]/page.tsx`
- `src/services/offline-sync.service.ts`

### Scenarios validated

1. **Queue action when offline path is used**
   - Action uses `enqueueOfflineAction(...)`.
   - Queue size reflects in UI.
   - Event logged with `sync_status='pending'` in `offline_sync_events`.

2. **Successful sync**
   - Action sent to `updateWorkOrder(...)`.
   - Queue item removed by `removeOfflineAction(...)`.
   - Event logged with `sync_status='synced'`.

3. **Partial failure sync**
   - Failed action remains in queue.
   - Retry metadata captured via `markOfflineActionFailed(...)`:
     - `retryCount` increments
     - `lastError` updated
   - Event logged with `sync_status='failed'`.

## Data-quality guardrail validation

Scope:
- `src/services/equipment.service.ts`
- `src/utils/validation/operations.ts`
- New request/PM/procurement pages

### Negative test matrix

| Case | Expected result | Enforcement layer |
|---|---|---|
| Duplicate equipment asset code | Reject create with duplicate error | Service + DB unique index |
| Missing maintenance request asset | Reject submission with warning | Zod schema |
| Maintenance fault description too short | Reject submission with warning | Zod schema |
| Missing PM plan asset/name | Reject submission with warning | Zod schema |
| PM frequency less than 1 | Reject submission | Zod schema |
| Procurement title/justification too short | Reject submission | Zod schema |
| Unsupported procurement status/priority | Reject at validation/DB check constraints | Zod + DB |

## Notes

- Full repo lint currently has pre-existing unrelated debt, but touched files for offline/guardrails are clean under targeted diagnostics.
- Guardrails are now enforced both in UI validation and database constraints for critical fields.
