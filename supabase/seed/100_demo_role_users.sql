-- Seed 100: Real Supabase Auth demo users for 7-role testing
--
-- Run this after creating the seven users in Supabase Authentication.
-- It is idempotent: roles are upserted, profiles are updated by email, and
-- each demo profile is reset to exactly one intended role assignment.

-- ============================================================================
-- 1) Ensure the application roles exist
-- ============================================================================
INSERT INTO roles (name, description, permissions)
VALUES
  ('developer', 'Thesis developer with full system access and demo/debug controls',
   '["manage_users", "manage_settings", "manage_equipment", "manage_maintenance", "manage_pm", "manage_calibration", "manage_spare_parts", "manage_training", "manage_disposal", "view_analytics", "manage_analytics", "view_reports", "export_reports", "manage_documents", "developer_tools"]'::jsonb),
  ('admin', 'Legacy system administrator with broad system access',
   '["manage_users", "manage_settings", "manage_equipment", "manage_maintenance", "manage_pm", "manage_calibration", "manage_spare_parts", "manage_training", "manage_disposal", "view_analytics", "manage_analytics", "view_reports", "export_reports", "manage_documents"]'::jsonb),
  ('bme_head', 'Biomedical Engineering Head with operational and decision-support access',
   '["manage_equipment", "manage_maintenance", "manage_pm", "manage_calibration", "manage_spare_parts", "manage_training", "manage_disposal", "view_analytics", "manage_analytics", "view_reports", "export_reports", "manage_documents"]'::jsonb),
  ('technician', 'Biomedical Engineer / Technician for equipment and maintenance workflows',
   '["manage_equipment", "manage_maintenance", "manage_pm", "manage_calibration", "manage_spare_parts", "manage_training", "view_analytics", "view_reports", "manage_documents"]'::jsonb),
  ('department_head', 'Department Head for department-level equipment, requests, work orders, and reports',
   '["view_equipment", "create_maintenance_request", "create_training_request", "create_calibration_request", "create_disposal_request", "view_department_work_orders", "view_reports"]'::jsonb),
  ('department_user', 'Department User / Equipment Focal Person for request intake and department equipment visibility',
   '["view_equipment", "create_maintenance_request", "create_training_request", "create_calibration_request", "create_disposal_request", "view_reports"]'::jsonb),
  ('store_user', 'Store / Logistics Officer for spare parts, logistics, procurement, and reports',
   '["manage_spare_parts", "view_equipment", "view_maintenance", "view_procurement", "view_reports"]'::jsonb),
  ('viewer', 'Hospital Management / Evaluator with read-only dashboards, decision support, and reports',
   '["view_equipment", "view_maintenance", "view_analytics", "view_reports", "export_reports"]'::jsonb)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- ============================================================================
-- 2) Insert or update the seven demo profiles and link to Auth UUIDs
-- ============================================================================
WITH department_target AS (
  SELECT id
  FROM departments
  WHERE is_active = true
  ORDER BY
    CASE
      WHEN code ILIKE '%ICU%' OR name ILIKE '%ICU%' THEN 0
      ELSE 1
    END,
    name,
    id
  LIMIT 1
),
demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('developer@bmerms-demo.local',       'BMERMS Developer',             'Thesis Developer',                    '5aa5ca7f-0989-403f-8cd6-cc853f9a7144'::uuid, 'developer',       NULL::uuid),
      ('bme.head@bmerms-demo.local',        'BME Department Head',          'Biomedical Engineering Head',         '915dfce3-3915-4d42-b3e9-d358881dd431'::uuid, 'bme_head',        NULL::uuid),
      ('technician@bmerms-demo.local',      'Biomedical Technician',        'Biomedical Engineer / Technician',     'a4540dbf-a2c1-472a-b7dc-f5f77ed1837f'::uuid, 'technician',      NULL::uuid),
      ('department.head@bmerms-demo.local', 'Department Head Demo',         'Department Head',                     '5983bb00-11ac-4d06-937a-ac47342586fc'::uuid, 'department_head', (SELECT id FROM department_target)),
      ('department.user@bmerms-demo.local', 'Department User Demo',         'Equipment Focal Person',              '33b145af-29cd-4696-b7c3-ae8cb0ae60e3'::uuid, 'department_user', (SELECT id FROM department_target)),
      ('store.user@bmerms-demo.local',      'Store Logistics Demo',         'Store / Logistics Officer',           '37c7fd91-7db3-4db2-b762-02cadec51501'::uuid, 'store_user',      NULL::uuid),
      ('viewer@bmerms-demo.local',          'Hospital Viewer Demo',         'Hospital Management / Evaluator',      '8f47dbee-8b34-4302-b394-40ac31d2d54b'::uuid, 'viewer',          NULL::uuid)
  ) AS t(email, full_name, job_title, auth_user_id, expected_role, department_id)
),
updated_profiles AS (
  UPDATE profiles p
  SET
    user_id = d.auth_user_id,
    full_name = d.full_name,
    job_title = d.job_title,
    department_id = d.department_id,
    is_active = true
  FROM demo_accounts d
  WHERE p.email = d.email
  RETURNING p.id, p.email
),
inserted_profiles AS (
  INSERT INTO profiles (user_id, full_name, email, department_id, job_title, is_active)
  SELECT d.auth_user_id, d.full_name, d.email, d.department_id, d.job_title, true
  FROM demo_accounts d
  WHERE NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.email = d.email
  )
  RETURNING id, email
),
demo_profiles AS (
  SELECT id, email FROM updated_profiles
  UNION ALL
  SELECT id, email FROM inserted_profiles
),
removed_existing_roles AS (
  DELETE FROM user_roles ur
  USING demo_profiles dp
  WHERE ur.user_id = dp.id
  RETURNING ur.user_id
)
INSERT INTO user_roles (user_id, role_id)
SELECT dp.id, r.id
FROM demo_profiles dp
JOIN demo_accounts d ON d.email = dp.email
JOIN roles r ON r.name = d.expected_role
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================================
-- 3) Validation: expected link and role state for the seven demo accounts
-- ============================================================================
WITH demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('developer@bmerms-demo.local',       'developer'),
      ('bme.head@bmerms-demo.local',        'bme_head'),
      ('technician@bmerms-demo.local',      'technician'),
      ('department.head@bmerms-demo.local', 'department_head'),
      ('department.user@bmerms-demo.local', 'department_user'),
      ('store.user@bmerms-demo.local',      'store_user'),
      ('viewer@bmerms-demo.local',          'viewer')
  ) AS t(email, expected_role)
)
SELECT
  d.email,
  p.full_name,
  p.job_title,
  p.user_id AS linked_auth_user_uuid,
  departments.name AS department_name,
  d.expected_role,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT roles.name ORDER BY roles.name), NULL) AS assigned_roles,
  BOOL_OR(roles.name = d.expected_role) AS has_expected_role
FROM demo_accounts d
LEFT JOIN profiles p ON p.email = d.email
LEFT JOIN departments ON departments.id = p.department_id
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles ON roles.id = ur.role_id
GROUP BY d.email, p.full_name, p.job_title, p.user_id, departments.name, d.expected_role
ORDER BY d.email;
