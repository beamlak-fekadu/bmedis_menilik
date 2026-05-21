-- Migration 00073: notification self-test RLS
--
-- Symptom (NOTIF-03):
--   `createTestNotificationToSelfAction` (src/actions/notifications.actions.ts)
--   accepts every authenticated role — including `viewer`. The action
--   issues two RLS-guarded inserts:
--     1) insert into `notification_events` for the test event
--     2) insert into `notifications` with recipient_profile_id = self
--
--   Migration 00055 only grants INSERT on both tables to
--   developer/admin/bme_head/technician/store_user/department_head/
--   department_user. `viewer` is excluded — so a viewer's self-test
--   silently fails at the DB layer with `new row violates row-level
--   security policy`. The user sees a confusing "Notification couldn't
--   be queued" toast and Telegram diagnostics show no event.
--
-- Fix:
--   Add two narrow, additive RLS policies that allow any authenticated
--   user (including viewer) to insert ONLY their own self-test rows:
--
--     A. `notifications`:
--          INSERT WHERE recipient_profile_id maps to a profile.user_id
--          equal to auth.uid().
--          This is strictly "send a notification to myself" — it cannot
--          be used to spam other recipients.
--
--     B. `notification_events`:
--          INSERT WHERE event_type = 'system.test_notification' AND
--          payload->>'target_profile_id' resolves to the caller's own
--          profile id. This locks the policy to the self-test code path
--          only; production events flow through workflow actions that
--          continue to use the existing privileged policy (00055).
--
-- The existing "Privileged insert *" policies from migration 00055 are
-- preserved — multiple permissive INSERT policies are OR'd in PostgreSQL,
-- so this migration is purely additive and changes no existing behavior
-- for non-viewer roles. Idempotent via DROP POLICY IF EXISTS guards.

-- Helper: resolve auth.uid() to profiles.id.
-- profiles.user_id is the auth.users.id linkage.
-- Multiple permissive policies OR together, so this lookup runs only when
-- the privileged check from 00055 already failed.

DROP POLICY IF EXISTS "Self insert notifications" ON notifications;
CREATE POLICY "Self insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recipient_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Self insert test notification_events" ON notification_events;
CREATE POLICY "Self insert test notification_events"
  ON notification_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_type = 'system.test_notification'
    AND payload ->> 'target_profile_id' IN (
      SELECT id::text FROM profiles WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Self insert notifications" ON notifications IS
  'Allows any authenticated user (including viewer) to insert a notification row that targets their own profile id. Used by the Self-test diagnostic in /developer-lab and /notifications. Cannot be used to insert notifications targeting other recipients.';

COMMENT ON POLICY "Self insert test notification_events" ON notification_events IS
  'Narrow self-test event insert. Locked to event_type = system.test_notification and target_profile_id = self. Production events still go through the privileged insert policy from 00055.';
