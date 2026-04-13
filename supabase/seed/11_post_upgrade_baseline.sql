-- Post-upgrade baseline seed for MEMIS 2.0 extensions
-- Run after migration 00014.

-- Procurement pipeline baseline
INSERT INTO procurement_requests (
  id, request_number, title, justification, status, priority, requested_by, department_id, expected_delivery_date
) VALUES
  (
    'b1000001-0000-0000-0000-000000000001',
    'PR-2026-001',
    'ICU Ventilator Flow Sensor Batch',
    'Critical ICU ventilators require replacement flow sensors to prevent service interruption.',
    'ordered',
    'critical',
    'a3000001-0000-0000-0000-000000000001',
    'd0000001-0000-0000-0000-000000000001',
    CURRENT_DATE + INTERVAL '7 days'
  ),
  (
    'b1000001-0000-0000-0000-000000000002',
    'PR-2026-002',
    'Emergency Department Defibrillator Battery Kits',
    'Battery depletion trend in ED defibrillators requires pre-emptive stock.',
    'in_transit',
    'high',
    'a3000001-0000-0000-0000-000000000001',
    'd0000001-0000-0000-0000-000000000003',
    CURRENT_DATE + INTERVAL '3 days'
  ),
  (
    'b1000001-0000-0000-0000-000000000003',
    'PR-2026-003',
    'Operating Theater Sterilizer Pressure Valves',
    'Recurring pressure instability indicates valve replacement requirement.',
    'requested',
    'medium',
    'a3000001-0000-0000-0000-000000000004',
    'd0000001-0000-0000-0000-000000000002',
    CURRENT_DATE + INTERVAL '14 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Inspection template baseline
INSERT INTO inspection_templates (id, template_name, template_type, grading_scale, checklist_items)
VALUES
  (
    'e9000001-0000-0000-0000-000000000001',
    'General Biomedical Inspection v1',
    'inspection',
    '["A","B","C","D"]'::jsonb,
    '[
      {"item":"Power-on self-test","required":true},
      {"item":"Alarm functionality","required":true},
      {"item":"Cable and connector integrity","required":true},
      {"item":"Physical housing condition","required":true}
    ]'::jsonb
  ),
  (
    'e9000001-0000-0000-0000-000000000002',
    'Calibration Verification v1',
    'calibration',
    '["Pass","Minor Drift","Major Drift","Fail"]'::jsonb,
    '[
      {"item":"Reference standard connected","required":true},
      {"item":"Measured drift within tolerance","required":true},
      {"item":"Certificate generated","required":true}
    ]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Simulated offline sync event baseline
INSERT INTO offline_sync_events (
  id, client_action_id, actor_user_id, entity_type, entity_id, action_type, payload, sync_status, synced_at
) VALUES (
  'a7000001-0000-0000-0000-000000000001',
  'seed-offline-001',
  'a3000001-0000-0000-0000-000000000002',
  'work_order',
  'c5000001-0000-0000-0000-000000000001',
  'update_status',
  '{"status":"in_progress","source":"offline_queue_seed"}'::jsonb,
  'synced',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Refresh snapshot-backed decision support data
SELECT refresh_decision_support_snapshots(CURRENT_DATE);
