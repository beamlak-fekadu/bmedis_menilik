-- Migration 00022: Developer role for testing
-- Adds a 'developer' super-role with full access and links the real auth user.

-- Developer role (all permissions)
INSERT INTO roles (id, name, description, permissions) VALUES
    ('b1000001-0000-0000-0000-000000000006', 'developer',
     'Developer — full system access for testing',
     '["manage_users","manage_settings","manage_equipment","manage_maintenance","manage_pm","manage_calibration","manage_spare_parts","manage_training","manage_disposal","view_analytics","manage_analytics","view_reports","export_reports","manage_documents","manage_audit","manage_security","developer_access"]')
ON CONFLICT (id) DO NOTHING;

-- Update the existing profile for this auth user to developer job title.
-- Uses ON CONFLICT on the user_id unique key so it works whether or not
-- a profile row already exists.
INSERT INTO profiles (id, user_id, full_name, email, job_title, is_active)
VALUES (
    'a3000001-0000-0000-0000-000000000099',
    '7d8ac74b-ec15-414d-bfea-e4433eb8bc14',
    'Beamlak',
    'beamlak.work@gmail.com',
    'Developer',
    true
)
ON CONFLICT (user_id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    job_title  = EXCLUDED.job_title,
    is_active  = EXCLUDED.is_active;

-- Resolve the profile id for the auth user (may differ from the value above if row existed)
DO $$
DECLARE
    v_profile_id uuid;
BEGIN
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = '7d8ac74b-ec15-414d-bfea-e4433eb8bc14';

    -- Assign developer role
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_profile_id, 'b1000001-0000-0000-0000-000000000006')
    ON CONFLICT DO NOTHING;
END $$;
