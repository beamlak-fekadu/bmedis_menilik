-- Migration 00082 — deterministic notification event dedupe.
--
-- Workflow terminal events such as work_order.completed, work_order.part_requested,
-- and work_order.part_issued use notification_events.dedupe_key as the
-- canonical idempotency key. Keep old event history by suffixing any legacy
-- duplicate keys, then enforce one live event row per non-null key.

WITH ranked AS (
  SELECT
    id,
    dedupe_key,
    row_number() OVER (
      PARTITION BY dedupe_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.notification_events
  WHERE dedupe_key IS NOT NULL
)
UPDATE public.notification_events ne
SET dedupe_key = ranked.dedupe_key || ':legacy-duplicate:' || ne.id::text
FROM ranked
WHERE ne.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_events_dedupe_key
  ON public.notification_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
