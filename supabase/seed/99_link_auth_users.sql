-- Seed 99: Link seeded demo profiles to real Supabase Auth users
--
-- Purpose:
--   Seeded demo profiles are created with profiles.user_id = NULL.
--   For hosted Supabase projects, create users in Authentication first, then link
--   each seeded profile to the corresponding auth.users.id UUID here.
--
-- Usage:
--   1) Replace each REPLACE_WITH_* value with a real auth.users.id UUID.
--   2) Run this script in Supabase SQL Editor after auth users are created.
--   3) Review the validation queries at the end.

-- ============================================================================
-- 1) Before state: inspect targeted demo profiles
-- ============================================================================
WITH expected_demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('admin',           'bme.head@bmerms-demo.local', 'REPLACE_WITH_ADMIN_AUTH_UUID'),
      ('department_user', 'department.user@bmerms-demo.local',       'REPLACE_WITH_DEPARTMENT_USER_AUTH_UUID'),
      ('store_user',      'store.user@bmerms-demo.local',       'REPLACE_WITH_STORE_USER_AUTH_UUID'),
      ('viewer',          'viewer@bmerms-demo.local',      'REPLACE_WITH_VIEWER_AUTH_UUID')
  ) AS t(expected_role, email, auth_user_uuid_text)
)
SELECT
  p.id AS profile_id,
  p.full_name,
  p.email,
  p.user_id,
  e.expected_role,
  r.name AS assigned_role
FROM expected_demo_accounts e
LEFT JOIN profiles p ON p.email = e.email
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles r ON r.id = ur.role_id
ORDER BY e.expected_role, p.email;

-- ============================================================================
-- 2) Link profiles.user_id to real auth.users.id UUIDs
--    Only rows with valid UUID text are updated.
-- ============================================================================
WITH expected_demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('admin',           'bme.head@bmerms-demo.local', 'REPLACE_WITH_ADMIN_AUTH_UUID'),
      ('department_user', 'department.user@bmerms-demo.local',       'REPLACE_WITH_DEPARTMENT_USER_AUTH_UUID'),
      ('store_user',      'store.user@bmerms-demo.local',       'REPLACE_WITH_STORE_USER_AUTH_UUID'),
      ('viewer',          'viewer@bmerms-demo.local',      'REPLACE_WITH_VIEWER_AUTH_UUID')
  ) AS t(expected_role, email, auth_user_uuid_text)
),
parsed_demo_accounts AS (
  SELECT
    expected_role,
    email,
    CASE
      WHEN auth_user_uuid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN auth_user_uuid_text::uuid
      ELSE NULL
    END AS auth_user_id
  FROM expected_demo_accounts
)
UPDATE profiles p
SET user_id = d.auth_user_id
FROM parsed_demo_accounts d
WHERE p.email = d.email
  AND d.auth_user_id IS NOT NULL;

-- ============================================================================
-- 3) After state: confirm links were applied
-- ============================================================================
WITH expected_demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('admin',           'bme.head@bmerms-demo.local'),
      ('department_user', 'department.user@bmerms-demo.local'),
      ('store_user',      'store.user@bmerms-demo.local'),
      ('viewer',          'viewer@bmerms-demo.local')
  ) AS t(expected_role, email)
)
SELECT
  p.id AS profile_id,
  p.full_name,
  p.email,
  p.user_id,
  e.expected_role,
  r.name AS assigned_role
FROM expected_demo_accounts e
LEFT JOIN profiles p ON p.email = e.email
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles r ON r.id = ur.role_id
ORDER BY e.expected_role, p.email;

-- ============================================================================
-- 4) Validation checks
-- ============================================================================

-- 4.1 Any expected profile still missing user_id?
WITH expected_demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('admin',           'bme.head@bmerms-demo.local'),
      ('department_user', 'department.user@bmerms-demo.local'),
      ('store_user',      'store.user@bmerms-demo.local'),
      ('viewer',          'viewer@bmerms-demo.local')
  ) AS t(expected_role, email)
)
SELECT
  e.expected_role,
  e.email,
  p.id AS profile_id,
  p.user_id
FROM expected_demo_accounts e
LEFT JOIN profiles p ON p.email = e.email
WHERE p.id IS NULL OR p.user_id IS NULL;

-- 4.2 Duplicate user_id links (should return zero rows)
SELECT user_id, COUNT(*) AS profile_count
FROM profiles
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 4.3 Role mapping validation for linked demo accounts
WITH expected_demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('admin',           'bme.head@bmerms-demo.local'),
      ('department_user', 'department.user@bmerms-demo.local'),
      ('store_user',      'store.user@bmerms-demo.local'),
      ('viewer',          'viewer@bmerms-demo.local')
  ) AS t(expected_role, email)
)
SELECT
  e.expected_role,
  p.email,
  p.id AS profile_id,
  p.user_id,
  d.id AS department_id,
  d.name AS department_name,
  COUNT(ur.role_id) AS total_roles,
  BOOL_OR(r.name = e.expected_role) AS has_expected_role,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.name), NULL) AS assigned_roles
FROM expected_demo_accounts e
LEFT JOIN profiles p ON p.email = e.email
LEFT JOIN departments d ON d.id = p.department_id
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles r ON r.id = ur.role_id
GROUP BY e.expected_role, p.email, p.id, p.user_id, d.id, d.name
ORDER BY e.expected_role;
