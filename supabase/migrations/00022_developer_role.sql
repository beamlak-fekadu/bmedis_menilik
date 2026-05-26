-- Migration 00022: Developer role for testing
-- Adds a 'developer' role only.
-- Auth users, profiles, and user_roles must be created by the setup script
-- because auth.users IDs are different for every Supabase project.

INSERT INTO roles (id, name, description, permissions)
VALUES (
    'b1000001-0000-0000-0000-000000000006',
    'developer',
    'Developer — full system access for testing',
    '[
        "manage_users",
        "manage_settings",
        "manage_equipment",
        "manage_maintenance",
        "manage_pm",
        "manage_calibration",
        "manage_spare_parts",
        "manage_training",
        "manage_disposal",
        "view_analytics",
        "manage_analytics",
        "view_reports",
        "export_reports",
        "manage_documents",
        "manage_audit",
        "manage_security",
        "developer_access"
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;