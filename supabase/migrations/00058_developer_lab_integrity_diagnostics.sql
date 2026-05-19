-- Migration 00058: Developer Lab integrity diagnostics
-- Adds a safe, developer-gated RPC for validating seeded demo Auth/Profile/Role
-- mapping without exposing keys or broad auth.users access to the application.

CREATE OR REPLACE FUNCTION validate_demo_role_integrity()
RETURNS TABLE (
  email TEXT,
  auth_user_id UUID,
  profile_id UUID,
  profile_user_id UUID,
  full_name TEXT,
  job_title TEXT,
  department_id UUID,
  department_name TEXT,
  assigned_roles TEXT[],
  primary_reason TEXT,
  reasons TEXT[]
) AS $$
BEGIN
  IF NOT auth_user_has_role('developer') THEN
    RAISE EXCEPTION 'Developer role required for demo role integrity diagnostics';
  END IF;

  RETURN QUERY
  WITH expected AS (
    SELECT *
    FROM (
      VALUES
        ('developer@bmerms-demo.local',       'BMEDIS Developer',    'Thesis Developer',                  'developer',       NULL::TEXT),
        ('bme.head@bmerms-demo.local',        'Ermias Tadesse',      'Biomedical Engineering Head',       'bme_head',        NULL::TEXT),
        ('technician@bmerms-demo.local',      'Hanna Gebremedhin',   'Clinical Engineer',                 'technician',      NULL::TEXT),
        ('department.head@bmerms-demo.local', 'Tigist Worku',        'ICU Head',                          'department_head', 'Intensive Care Unit'),
        ('department.user@bmerms-demo.local', 'Dr. Fitsum Haile',    'Radiologist',                       'department_user', 'Radiology and Imaging'),
        ('store.user@bmerms-demo.local',      'Ato Biniam Teshome',  'Medical Equipment Store Officer',   'store_user',      NULL::TEXT),
        ('viewer@bmerms-demo.local',          'Dr. Amanuel Kifle',   'Medical Director',                  'viewer',          NULL::TEXT)
    ) AS t(email, expected_full_name, expected_job_title, expected_role, expected_department_name)
  ),
  resolved AS (
    SELECT
      e.*,
      au.id AS auth_user_id,
      p.id AS profile_id,
      p.user_id AS profile_user_id,
      p.full_name,
      p.job_title,
      p.department_id,
      d.name AS department_name,
      COALESCE(roles.assigned_roles, ARRAY[]::TEXT[]) AS assigned_roles
    FROM expected e
    LEFT JOIN auth.users au
      ON lower(au.email) = lower(e.email)
    LEFT JOIN LATERAL (
      SELECT p.*
      FROM profiles p
      WHERE (au.id IS NOT NULL AND p.user_id = au.id)
         OR lower(p.email) = lower(e.email)
      ORDER BY
        CASE WHEN au.id IS NOT NULL AND p.user_id = au.id THEN 0 ELSE 1 END,
        p.updated_at DESC,
        p.created_at DESC
      LIMIT 1
    ) p ON TRUE
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.name ORDER BY r.name), NULL) AS assigned_roles
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = p.id
    ) roles ON TRUE
  ),
  reasoned AS (
    SELECT
      r.*,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN r.auth_user_id IS NULL THEN 'MISSING_AUTH_USER' END,
        CASE WHEN r.profile_id IS NULL THEN 'MISSING_PROFILE' END,
        CASE
          WHEN r.profile_id IS NOT NULL
           AND (
             r.profile_user_id IS NULL
             OR (r.auth_user_id IS NOT NULL AND r.profile_user_id <> r.auth_user_id)
           )
          THEN 'PROFILE_NOT_LINKED_TO_AUTH'
        END,
        CASE WHEN r.profile_id IS NOT NULL AND r.full_name IS DISTINCT FROM r.expected_full_name THEN 'WRONG_NAME' END,
        CASE WHEN r.profile_id IS NOT NULL AND r.job_title IS DISTINCT FROM r.expected_job_title THEN 'WRONG_JOB_TITLE' END,
        CASE WHEN r.profile_id IS NOT NULL AND r.department_name IS DISTINCT FROM r.expected_department_name THEN 'WRONG_DEPARTMENT' END,
        CASE WHEN r.profile_id IS NOT NULL AND CARDINALITY(r.assigned_roles) = 0 THEN 'MISSING_ROLE' END,
        CASE WHEN r.profile_id IS NOT NULL AND CARDINALITY(r.assigned_roles) > 0 AND NOT (r.expected_role = ANY(r.assigned_roles)) THEN 'WRONG_ROLE' END,
        CASE WHEN r.profile_id IS NOT NULL AND CARDINALITY(r.assigned_roles) > 1 THEN 'MULTIPLE_ROLES' END
      ]::TEXT[], NULL) AS failure_reasons
    FROM resolved r
  )
  SELECT
    reasoned.email,
    reasoned.auth_user_id,
    reasoned.profile_id,
    reasoned.profile_user_id,
    reasoned.full_name,
    reasoned.job_title,
    reasoned.department_id,
    reasoned.department_name,
    reasoned.assigned_roles,
    CASE
      WHEN CARDINALITY(reasoned.failure_reasons) = 0 THEN 'OK'
      ELSE reasoned.failure_reasons[1]
    END AS primary_reason,
    CASE
      WHEN CARDINALITY(reasoned.failure_reasons) = 0 THEN ARRAY['OK']::TEXT[]
      ELSE reasoned.failure_reasons
    END AS reasons
  FROM reasoned
  ORDER BY ARRAY_POSITION(ARRAY[
    'developer@bmerms-demo.local',
    'bme.head@bmerms-demo.local',
    'technician@bmerms-demo.local',
    'department.head@bmerms-demo.local',
    'department.user@bmerms-demo.local',
    'store.user@bmerms-demo.local',
    'viewer@bmerms-demo.local'
  ]::TEXT[], reasoned.email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION validate_demo_role_integrity() TO authenticated;
