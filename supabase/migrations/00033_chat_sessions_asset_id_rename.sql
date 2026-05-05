-- Migration 00033: Rename chat_sessions.equipment_id → asset_id (aligns with equipment_assets.id naming)
-- Application + generated types updated in same release.

ALTER TABLE chat_sessions
  RENAME COLUMN equipment_id TO asset_id;
