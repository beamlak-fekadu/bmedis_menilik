-- Migration 00028: Audit logging — defensive performed_by backfill (00025 alignment)
-- Ensures performed_by matches user_id (profiles FK) for all rows where user_id is set.

UPDATE audit_logs
SET performed_by = user_id
WHERE performed_by IS NULL
  AND user_id IS NOT NULL;
