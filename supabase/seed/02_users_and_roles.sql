-- Seed 02: Users, Profiles, and Roles
-- Creates roles and profiles for demo users at Menelik II Hospital.
-- NOTE: In production/hosted Supabase, auth.users entries are created via Supabase Auth
-- (Dashboard or Admin API), not by direct inserts in this seed file.
-- Seeded profiles intentionally start with user_id = NULL and must be linked later.
-- Run supabase/seed/99_link_auth_users.sql after creating real Auth users.

-- =============================================================================
-- ROLES (5 roles)
-- =============================================================================
INSERT INTO roles (id, name, description, permissions) VALUES
    ('b1000001-0000-0000-0000-000000000001', 'admin', 'Biomedical Engineering Head - full system access',
     '["manage_users", "manage_settings", "manage_equipment", "manage_maintenance", "manage_pm", "manage_calibration", "manage_spare_parts", "manage_training", "manage_disposal", "view_analytics", "manage_analytics", "view_reports", "export_reports", "manage_documents"]'),
    ('b1000001-0000-0000-0000-000000000002', 'technician', 'Biomedical Engineer / Technician - equipment and maintenance management',
     '["manage_equipment", "manage_maintenance", "manage_pm", "manage_calibration", "manage_spare_parts", "manage_training", "view_analytics", "view_reports", "manage_documents"]'),
    ('b1000001-0000-0000-0000-000000000003', 'department_user', 'Department User - can submit requests and view department equipment',
     '["view_equipment", "create_maintenance_request", "create_training_request", "create_calibration_request", "create_disposal_request", "view_reports"]'),
    ('b1000001-0000-0000-0000-000000000004', 'store_user', 'Store/Logistics User - manages spare parts inventory',
     '["manage_spare_parts", "view_equipment", "view_maintenance", "view_reports"]'),
    ('b1000001-0000-0000-0000-000000000005', 'viewer', 'Management Viewer - read-only access to dashboards and reports',
     '["view_equipment", "view_maintenance", "view_analytics", "view_reports", "export_reports"]');

-- =============================================================================
-- PROFILES (15 users)
-- user_id is NULL until linked via Supabase Auth; profile.id is used by all FK references
-- =============================================================================
INSERT INTO profiles (id, full_name, email, phone, department_id, job_title, is_active) VALUES
    -- Admin (Biomedical Head) — linked demo login
    ('a3000001-0000-0000-0000-000000000001', 'Dr. Ermias Tadesse', 'bme.head@bmerms-demo.local', '+251-91-234-5678', NULL, 'Head of Biomedical Engineering', true),
    -- Technicians (first is the linked demo login; others use menelikii.gov.et)
    ('a3000001-0000-0000-0000-000000000002', 'Hanna Gebremedhin', 'technician@bmerms-demo.local', '+251-91-345-6789', NULL, 'Senior Biomedical Technician', true),
    ('a3000001-0000-0000-0000-000000000003', 'Solomon Bekele', 'solomon.b@menelikii.gov.et', '+251-91-456-7890', NULL, 'Biomedical Technician', true),
    ('a3000001-0000-0000-0000-000000000004', 'Meron Alemu', 'meron.a@menelikii.gov.et', '+251-91-567-8901', NULL, 'Biomedical Technician', true),
    -- Department Users (first is the linked demo login; others use menelikii.gov.et).
    -- NOTE: the seed only ships a `department_user` role; the dedicated `department.head@bmerms-demo.local`
    -- demo login exists in Supabase Auth but is not mapped here until a `department_head` role is added.
    ('a3000001-0000-0000-0000-000000000005', 'Sr. Tigist Worku', 'department.user@bmerms-demo.local', '+251-91-678-9012', 'd0000001-0000-0000-0000-000000000001', 'ICU Head Nurse', true),
    ('a3000001-0000-0000-0000-000000000006', 'Dr. Yonas Abera', 'yonas.a@menelikii.gov.et', '+251-91-789-0123', 'd0000001-0000-0000-0000-000000000002', 'Chief Surgeon', true),
    ('a3000001-0000-0000-0000-000000000007', 'Sr. Bethlehem Desta', 'bethlehem.d@menelikii.gov.et', '+251-91-890-1234', 'd0000001-0000-0000-0000-000000000003', 'Emergency Department Lead', true),
    ('a3000001-0000-0000-0000-000000000008', 'Dr. Fitsum Haile', 'fitsum.h@menelikii.gov.et', '+251-91-901-2345', 'd0000001-0000-0000-0000-000000000004', 'Radiologist', true),
    ('a3000001-0000-0000-0000-000000000009', 'Ato Dawit Mekonnen', 'dawit.m@menelikii.gov.et', '+251-91-012-3456', 'd0000001-0000-0000-0000-000000000005', 'Lab Manager', true),
    ('a3000001-0000-0000-0000-000000000010', 'W/ro Selamawit Girma', 'selamawit.g@menelikii.gov.et', '+251-91-123-4567', 'd0000001-0000-0000-0000-000000000006', 'Chief Pharmacist', true),
    ('a3000001-0000-0000-0000-000000000011', 'Sr. Rahel Mengistu', 'rahel.m@menelikii.gov.et', '+251-91-234-5670', 'd0000001-0000-0000-0000-000000000007', 'Ward Charge Nurse', true),
    ('a3000001-0000-0000-0000-000000000012', 'Dr. Abel Habtamu', 'abel.h@menelikii.gov.et', '+251-91-345-6780', 'd0000001-0000-0000-0000-000000000008', 'OPD Physician', true),
    -- Store User — linked demo login
    ('a3000001-0000-0000-0000-000000000013', 'Ato Biniam Teshome', 'store.user@bmerms-demo.local', '+251-91-456-7801', NULL, 'Medical Equipment Store Officer', true),
    -- Management Viewers — first is the linked demo login; second uses menelikii.gov.et
    ('a3000001-0000-0000-0000-000000000014', 'Dr. Amanuel Kifle', 'viewer@bmerms-demo.local', '+251-91-567-8012', NULL, 'Medical Director', true),
    ('a3000001-0000-0000-0000-000000000015', 'W/ro Meseret Yilma', 'meseret.y@menelikii.gov.et', '+251-91-678-9023', NULL, 'Hospital Administrator', true);

-- =============================================================================
-- USER ROLES (assign roles to profiles)
-- =============================================================================
INSERT INTO user_roles (user_id, role_id) VALUES
    -- Admin
    ('a3000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001'),
    -- Technicians
    ('a3000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000002'),
    ('a3000001-0000-0000-0000-000000000003', 'b1000001-0000-0000-0000-000000000002'),
    ('a3000001-0000-0000-0000-000000000004', 'b1000001-0000-0000-0000-000000000002'),
    -- Department Users
    ('a3000001-0000-0000-0000-000000000005', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000006', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000007', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000008', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000009', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000010', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000011', 'b1000001-0000-0000-0000-000000000003'),
    ('a3000001-0000-0000-0000-000000000012', 'b1000001-0000-0000-0000-000000000003'),
    -- Store User
    ('a3000001-0000-0000-0000-000000000013', 'b1000001-0000-0000-0000-000000000004'),
    -- Viewers
    ('a3000001-0000-0000-0000-000000000014', 'b1000001-0000-0000-0000-000000000005'),
    ('a3000001-0000-0000-0000-000000000015', 'b1000001-0000-0000-0000-000000000005');
