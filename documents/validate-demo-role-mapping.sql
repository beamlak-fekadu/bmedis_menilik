-- documents/validate-demo-role-mapping.sql
--
-- Read-only validation for the seven BMERMS demo login accounts.
-- Paste into the Supabase SQL Editor. No INSERT / UPDATE / DELETE.
--
-- Use this to confirm the mapping after running
-- documents/apply-demo-role-mapping.sql (or after seed 100 has been applied
-- via `supabase db push`).
--
-- IMPORTANT — job titles vs database roles:
--   * job_title is FREE TEXT (Clinical Engineer, Radiologist, ICU Head, etc.).
--   * Database role names are the eight LOWERCASE values:
--       developer, admin, bme_head, technician, department_head,
--       department_user, store_user, viewer
--   * Comparisons in this script are made against the lowercase role names,
--     never against job titles.
--
-- Expected output (status = 'OK' for every row):
--
--   developer@bmerms-demo.local        | BMERMS Developer    | Thesis Developer                | developer
--   bme.head@bmerms-demo.local         | Ermias Tadesse      | Biomedical Engineering Head     | bme_head
--   technician@bmerms-demo.local       | Hanna Gebremedhin   | Clinical Engineer               | technician
--   department.head@bmerms-demo.local  | Tigist Worku        | ICU Head                        | department_head
--   department.user@bmerms-demo.local  | Dr. Fitsum Haile    | Radiologist                     | department_user
--   store.user@bmerms-demo.local       | Ato Biniam Teshome  | Medical Equipment Store Officer | store_user
--   viewer@bmerms-demo.local           | Dr. Amanuel Kifle   | Medical Director                | viewer
--
-- Possible status values:
--   OK
--   MISSING AUTH USER
--   MISSING PROFILE
--   PROFILE NOT LINKED TO AUTH
--   WRONG NAME
--   WRONG JOB TITLE
--   WRONG ROLE
--   MULTIPLE ROLES

WITH demo_accounts AS (
  SELECT *
  FROM (
    VALUES
      ('developer@bmerms-demo.local',       'BMERMS Developer',    'Thesis Developer',                  'developer'),
      ('bme.head@bmerms-demo.local',        'Ermias Tadesse',      'Biomedical Engineering Head',       'bme_head'),
      ('technician@bmerms-demo.local',      'Hanna Gebremedhin',   'Clinical Engineer',                 'technician'),
      ('department.head@bmerms-demo.local', 'Tigist Worku',        'ICU Head',                          'department_head'),
      ('department.user@bmerms-demo.local', 'Dr. Fitsum Haile',    'Radiologist',                       'department_user'),
      ('store.user@bmerms-demo.local',      'Ato Biniam Teshome',  'Medical Equipment Store Officer',   'store_user'),
      ('viewer@bmerms-demo.local',          'Dr. Amanuel Kifle',   'Medical Director',                  'viewer')
  ) AS t(email, expected_full_name, expected_job_title, expected_role)
),
aggregated AS (
  SELECT
    d.email,
    au.id AS auth_user_uuid,
    p.id  AS profile_id,
    p.full_name,
    d.expected_full_name,
    p.job_title,
    d.expected_job_title,
    p.user_id AS linked_auth_user_uuid,
    dep.name AS department_name,
    d.expected_role,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.name ORDER BY r.name), NULL) AS assigned_roles,
    COUNT(DISTINCT r.name) AS role_count,
    BOOL_OR(r.name = d.expected_role) AS has_expected_role
  FROM demo_accounts d
  LEFT JOIN auth.users au ON au.email = d.email
  LEFT JOIN profiles   p  ON p.email = d.email
  LEFT JOIN departments dep ON dep.id = p.department_id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  LEFT JOIN roles      r  ON r.id = ur.role_id
  GROUP BY d.email, au.id, p.id, p.full_name, d.expected_full_name,
           p.job_title, d.expected_job_title, p.user_id, dep.name, d.expected_role
)
SELECT
  email,
  CASE WHEN auth_user_uuid IS NULL THEN 'MISSING AUTH USER' ELSE 'OK' END AS auth_user_status,
  auth_user_uuid,
  profile_id,
  full_name,
  expected_full_name,
  (full_name = expected_full_name) AS has_expected_name,
  job_title,
  expected_job_title,
  (job_title = expected_job_title) AS has_expected_job_title,
  linked_auth_user_uuid,
  (linked_auth_user_uuid IS NOT NULL AND linked_auth_user_uuid = auth_user_uuid) AS profile_link_matches_auth,
  department_name,
  expected_role,
  assigned_roles,
  role_count,
  has_expected_role,
  CASE
    WHEN auth_user_uuid IS NULL                                  THEN 'MISSING AUTH USER'
    WHEN profile_id IS NULL                                      THEN 'MISSING PROFILE'
    WHEN linked_auth_user_uuid IS NULL
      OR linked_auth_user_uuid <> auth_user_uuid                 THEN 'PROFILE NOT LINKED TO AUTH'
    WHEN full_name IS DISTINCT FROM expected_full_name           THEN 'WRONG NAME'
    WHEN job_title IS DISTINCT FROM expected_job_title           THEN 'WRONG JOB TITLE'
    WHEN NOT has_expected_role                                   THEN 'WRONG ROLE'
    WHEN role_count > 1                                          THEN 'MULTIPLE ROLES'
    ELSE 'OK'
  END AS status
FROM aggregated
ORDER BY email;
