-- ============================================================================
-- BMEDIS RLS / RBAC Audit SQL
-- ----------------------------------------------------------------------------
-- Run these queries in the Supabase SQL Editor (or psql) against the linked
-- BMEDIS project. They are read-only and safe to run any number of times.
--
-- Each section prints what it found and a short note on what to look at if
-- the result is non-empty. None of these queries make assumptions about the
-- running session — they inspect catalog tables and operational data only.
--
-- Capability matrix source of truth: src/lib/rbac.ts
-- RBAC narrative: documents/rbac-audit.md
-- ============================================================================


-- ============================================================================
-- 1. List all policies on key operational tables
-- ----------------------------------------------------------------------------
-- Result: one row per (table, policy) describing what the policy permits and
-- under what USING / WITH CHECK expression. Read this side-by-side with
-- src/lib/rbac.ts CAPABILITY_MATRIX. Anything granting more than the matrix
-- says is a gap (e.g. a technician INSERT on `roles`).
-- ============================================================================

SELECT
  c.relname                                    AS table_name,
  pol.polname                                  AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE pol.polcmd::text
  END                                          AS command,
  pg_get_expr(pol.polqual,      pol.polrelid)  AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid)  AS with_check_expr,
  pol.polroles::regrole[]                      AS db_roles
FROM   pg_policy pol
JOIN   pg_class  c   ON c.oid = pol.polrelid
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
AND    c.relname IN (
         'profiles',
         'user_roles',
         'roles',
         'equipment_assets',
         'maintenance_requests',
         'work_orders',
         'work_order_events',
         'pm_plans',
         'pm_schedules',
         'pm_completions',
         'calibration_requests',
         'calibration_records',
         'spare_parts',
         'stock_receipts',
         'stock_issues',
         'procurement_requests',
         'training_requests',
         'training_sessions',
         'staff_training_records',
         'disposal_requests',
         'disposed_assets',
         'audit_logs',
         'recommendation_flags',
         'command_center_acknowledgements',
         'decision_support_refresh_log',
         'offline_sync_events',
         'equipment_documents',
         'installation_requests',
         'installation_records',
         'specification_requests',
         'chat_sessions',
         'chat_messages'
       )
ORDER  BY c.relname, pol.polname;
-- Expected: every operational table has at least a SELECT policy. UPDATE/INSERT
-- policies should reference role names from CAPABILITY_MATRIX.


-- ============================================================================
-- 2. Find policies that mention `admin` but NOT `bme_head`
-- ----------------------------------------------------------------------------
-- CAPABILITY_MATRIX treats bme_head as the operational equivalent of admin
-- (admin minus developer-only). Policies granting admin but missing bme_head
-- are parity bugs that block the BME Head from doing work admin can do.
-- ============================================================================

SELECT  c.relname AS table_name,
        pol.polname,
        pg_get_expr(pol.polqual,      pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''admin''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''admin''%'
        )
AND     COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') NOT ILIKE '%''bme_head''%'
AND     COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') NOT ILIKE '%''bme_head''%'
ORDER   BY c.relname, pol.polname;
-- Expected: zero rows. Any row is a parity gap — add `'bme_head'` next to
-- `'admin'` in the policy, or split policies to cover both.


-- ============================================================================
-- 3. Find policies that mention `technician`
-- ----------------------------------------------------------------------------
-- Technician should be allowed: maintenance.request.create, work_order.start /
-- complete / add_event, pm.complete, calibration.request.create / record_result,
-- training.request.create, procurement.request, alerts.acknowledge,
-- reports.view. NOT allowed: equipment.delete, pm.plan.create, pm.assign,
-- procurement.status_update, roles/users management.
-- ============================================================================

SELECT  c.relname AS table_name,
        pol.polname,
        CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                        WHEN '*' THEN 'ALL' ELSE pol.polcmd::text END AS command,
        pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''technician''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''technician''%'
        )
ORDER   BY c.relname, pol.polname;
-- Cross-check against CAPABILITY_MATRIX.technician in src/lib/rbac.ts.


-- ============================================================================
-- 4. Find policies that mention `viewer`
-- ----------------------------------------------------------------------------
-- Viewer is read-only. Any policy granting viewer on INSERT / UPDATE / DELETE
-- is a bug.
-- ============================================================================

SELECT  c.relname AS table_name,
        pol.polname,
        CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                        WHEN '*' THEN 'ALL' ELSE pol.polcmd::text END AS command,
        pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''viewer''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''viewer''%'
        )
ORDER   BY c.relname, pol.polname;

-- Viewer write-policy gap (should always return zero rows):
SELECT  c.relname AS table_name,
        pol.polname,
        pol.polcmd
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     pol.polcmd IN ('a','w','d','*')
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''viewer''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''viewer''%'
        )
ORDER   BY c.relname, pol.polname;
-- Expected: zero rows. Each row = a write capability viewer should not have.


-- ============================================================================
-- 5. Role / profile integrity
-- ----------------------------------------------------------------------------
-- Detects orphan rows that break authorization in subtle ways.
-- ============================================================================

-- 5a. Profiles with no role assignment at all
SELECT  p.id, p.full_name, p.email, p.is_active
FROM    profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
WHERE   ur.user_id IS NULL
ORDER   BY p.full_name;
-- Each row = a logged-in user who falls through every role gate. Either
-- assign a role or deactivate the profile.

-- 5b. user_roles rows pointing to a non-existent profile
SELECT  ur.user_id, ur.role_id
FROM    user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
WHERE   p.id IS NULL;
-- Expected: zero rows. Any row is orphan data — delete or repair.

-- 5c. user_roles rows pointing to a non-existent role
SELECT  ur.user_id, ur.role_id
FROM    user_roles ur
LEFT JOIN roles r ON r.id = ur.role_id
WHERE   r.id IS NULL;
-- Expected: zero rows.

-- 5d. Duplicate (user_id, role_id) pairs
SELECT  ur.user_id, ur.role_id, COUNT(*) AS occurrences
FROM    user_roles ur
GROUP   BY ur.user_id, ur.role_id
HAVING  COUNT(*) > 1;
-- Expected: zero rows. If non-empty, there is no UNIQUE constraint on
-- (user_id, role_id); consider adding one.


-- ============================================================================
-- 6. Demo auth linkage
-- ----------------------------------------------------------------------------
-- Seed users with `@bmerms-demo.local` emails should each map to exactly one
-- profile with a valid role. `beamlak.work@gmail.com` should be linked to the
-- developer role (migration 00022).
-- ============================================================================

SELECT  p.email,
        p.full_name,
        p.user_id            AS auth_user_id,
        p.user_id IS NOT NULL AS has_auth_link,
        STRING_AGG(r.name, ', ' ORDER BY r.name) AS roles
FROM    profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles r       ON r.id       = ur.role_id
WHERE   p.email ILIKE '%@bmerms-demo.local'
   OR   p.email ILIKE '%@menelikii.gov.et'
   OR   p.email = 'beamlak.work@gmail.com'
GROUP   BY p.id, p.email, p.full_name, p.user_id
ORDER   BY p.email;
-- Expected: every demo email shows exactly one role; beamlak.work@gmail.com
-- shows `developer` and has_auth_link=true. Empty roles means the role grants
-- silently failed — re-run supabase/seed/99_link_auth_users.sql.

-- Profiles with user_id NULL (cannot log in via auth.uid())
SELECT  p.id, p.email, p.full_name, p.is_active
FROM    profiles p
WHERE   p.user_id IS NULL
ORDER   BY p.email;
-- Expected: 14 seed profiles plus beamlak.work@gmail.com which
-- IS linked (so should NOT appear). Other profiles can remain unlinked as
-- assignable staff (PM/WO assignee) without login access — see PART 5 note.


-- ============================================================================
-- 7. Assignment integrity
-- ----------------------------------------------------------------------------
-- Work orders / PM schedules / etc that point at a profile that no longer
-- exists. These crash assignment UIs and break RLS-based filter-by-assignee.
-- ============================================================================

-- 7a. Work orders assigned to a missing profile
SELECT  wo.id, wo.work_order_number, wo.assigned_to, wo.status
FROM    work_orders wo
LEFT JOIN profiles p ON p.id = wo.assigned_to
WHERE   wo.assigned_to IS NOT NULL
AND     p.id IS NULL;
-- Expected: zero rows.

-- 7b. PM schedules assigned to a missing profile
SELECT  ps.id, ps.scheduled_date, ps.assigned_to, ps.status
FROM    pm_schedules ps
LEFT JOIN profiles p ON p.id = ps.assigned_to
WHERE   ps.assigned_to IS NOT NULL
AND     p.id IS NULL;
-- Expected: zero rows.

-- 7c. Calibration records completed by a missing profile
SELECT  cr.id, cr.calibration_date, cr.calibrated_by
FROM    calibration_records cr
LEFT JOIN profiles p ON p.id = cr.calibrated_by
WHERE   cr.calibrated_by IS NOT NULL
AND     p.id IS NULL;
-- Expected: zero rows.

-- 7d. Calibration requests requested by a missing profile
SELECT  cr.id, cr.request_number, cr.requested_by
FROM    calibration_requests cr
LEFT JOIN profiles p ON p.id = cr.requested_by
WHERE   cr.requested_by IS NOT NULL
AND     p.id IS NULL;
-- Expected: zero rows.

-- 7e. Staff training records pointing at a missing profile (column staff_user_id)
SELECT  str.id, str.session_id, str.staff_user_id
FROM    staff_training_records str
LEFT JOIN profiles p ON p.id = str.staff_user_id
WHERE   str.staff_user_id IS NOT NULL
AND     p.id IS NULL;
-- Expected: zero rows. (Note: column is named staff_user_id; renaming is
-- listed as deferred in the schema cleanup notes.)


-- ============================================================================
-- 8. BME Head operational parity
-- ----------------------------------------------------------------------------
-- Listing of all policies where `admin` appears WITHOUT `bme_head` (same
-- query as section 2, repeated here as the canonical "parity gaps" view).
-- BME Head must be operationally equivalent to admin EXCEPT for Developer Lab
-- / debug / sandbox surfaces, which live in app routes rather than DB rules.
-- ============================================================================

SELECT  c.relname AS table_name,
        pol.polname,
        CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                        WHEN '*' THEN 'ALL' ELSE pol.polcmd::text END AS command,
        pg_get_expr(pol.polqual,      pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''admin''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''admin''%'
        )
AND     COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') NOT ILIKE '%''bme_head''%'
AND     COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') NOT ILIKE '%''bme_head''%'
ORDER   BY c.relname, pol.polname;


-- ============================================================================
-- 9. Viewer write-policy posture (re-stated for clarity)
-- ----------------------------------------------------------------------------
-- Should return zero rows. Each row = a write surface viewer should not have.
-- ============================================================================

SELECT  c.relname AS table_name, pol.polname, pol.polcmd
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     pol.polcmd IN ('a','w','d','*')
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''viewer''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''viewer''%'
        )
ORDER   BY c.relname, pol.polname;


-- ============================================================================
-- 10. Store user scope
-- ----------------------------------------------------------------------------
-- Per CAPABILITY_MATRIX, store_user has: spare_parts.manage, stock.receive,
-- stock.issue, procurement.request, reports.view. It should NOT have writes
-- to maintenance/work-order/calibration/PM/disposal tables.
-- ============================================================================

SELECT  c.relname AS table_name,
        pol.polname,
        CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                        WHEN '*' THEN 'ALL' ELSE pol.polcmd::text END AS command,
        pg_get_expr(pol.polqual,      pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     c.relname IN ('spare_parts','stock_receipts','stock_issues','procurement_requests')
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''store_user''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''store_user''%'
        )
ORDER   BY c.relname, pol.polname;

-- Store user should NOT appear on these tables (write side):
SELECT  c.relname AS table_name,
        pol.polname,
        pol.polcmd
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     c.relname IN (
          'maintenance_requests','work_orders','work_order_events',
          'pm_plans','pm_schedules','pm_completions',
          'calibration_records','disposal_requests','disposed_assets',
          'roles','user_roles'
        )
AND     pol.polcmd IN ('a','w','d','*')
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''store_user''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''store_user''%'
        )
ORDER   BY c.relname, pol.polname;
-- Expected: zero rows.


-- ============================================================================
-- 11. Department-role scope
-- ----------------------------------------------------------------------------
-- department_head / department_user can create maintenance, calibration,
-- training, and disposal requests (per CAPABILITY_MATRIX). They should NOT
-- be able to approve, complete work orders, manage spare parts, etc.
-- ============================================================================

-- 11a. department_head / department_user appearances on intake tables
SELECT  c.relname AS table_name,
        pol.polname,
        CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                        WHEN '*' THEN 'ALL' ELSE pol.polcmd::text END AS command,
        pg_get_expr(pol.polqual,      pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     c.relname IN ('maintenance_requests','training_requests','calibration_requests','disposal_requests')
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''department_head''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''department_head''%'
       OR COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''department_user''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''department_user''%'
        )
ORDER   BY c.relname, pol.polname;
-- Expected: SELECT/INSERT policies that scope by department_id = the user's
-- own profiles.department_id. If a row grants global INSERT, that is a scope
-- leak.

-- 11b. Department roles should NOT appear on write policies for these tables:
SELECT  c.relname AS table_name,
        pol.polname,
        pol.polcmd
FROM    pg_policy pol
JOIN    pg_class  c ON c.oid = pol.polrelid
JOIN    pg_namespace n ON n.oid = c.relnamespace
WHERE   n.nspname = 'public'
AND     c.relname IN (
          'work_orders','pm_plans','pm_schedules','pm_completions',
          'calibration_records','spare_parts','stock_receipts','stock_issues',
          'procurement_requests','disposed_assets','roles','user_roles'
        )
AND     pol.polcmd IN ('a','w','d','*')
AND     (
          COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''department_head''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''department_head''%'
       OR COALESCE(pg_get_expr(pol.polqual,      pol.polrelid),'') ILIKE '%''department_user''%'
       OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%''department_user''%'
        )
ORDER   BY c.relname, pol.polname;
-- Expected: zero rows.


-- ============================================================================
-- 12. Notes for follow-up
-- ----------------------------------------------------------------------------
-- - When CAPABILITY_MATRIX grows (e.g. installation.*, documents.*, settings.*),
--   add the corresponding policy checks to this file.
-- - getActiveTechnicians() (src/services/users.service.ts) relies on the join
--   profiles → user_roles → roles. If RLS on `user_roles` or `roles` blocks
--   the embedded join for non-admin users, the assignment dropdowns will look
--   empty. Verify by running section 1 against `user_roles` and `roles` and
--   confirming SELECT is granted to the calling role.
-- - To re-run after policy changes, just re-execute the script top to bottom.
