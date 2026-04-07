-- Migration 00012: Row Level Security Policies
-- Enable RLS on all tables and create policies for role-based access.

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_action_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE downtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_parts_used ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_reliability_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_compliance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE replacement_priority_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_flags ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Helper function to check user role
-- =============================================================================
CREATE OR REPLACE FUNCTION auth_user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        JOIN profiles p ON ur.user_id = p.id
        WHERE p.user_id = auth.uid()
          AND r.name = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Reference tables: readable by all authenticated, writable by admin/technician
-- =============================================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'departments', 'equipment_categories', 'manufacturers', 'equipment_models',
        'vendors', 'suppliers', 'failure_codes', 'maintenance_action_codes',
        'calibration_types', 'pm_templates', 'risk_scales', 'scoring_weights',
        'status_labels', 'roles'
    ] LOOP
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'select_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_user_has_role(''admin''))', 'insert_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_user_has_role(''admin''))', 'update_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_user_has_role(''admin''))', 'delete_' || tbl, tbl);
    END LOOP;
END $$;

-- =============================================================================
-- Profiles: users can read all, update own
-- =============================================================================
CREATE POLICY select_profiles ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY update_own_profile ON profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY admin_manage_profiles ON profiles FOR ALL TO authenticated USING (auth_user_has_role('admin'));

-- =============================================================================
-- User roles: readable by all, managed by admin
-- =============================================================================
CREATE POLICY select_user_roles ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_manage_user_roles ON user_roles FOR ALL TO authenticated USING (auth_user_has_role('admin'));

-- =============================================================================
-- Equipment assets: readable by all authenticated, writable by admin/technician
-- =============================================================================
CREATE POLICY select_equipment ON equipment_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY manage_equipment ON equipment_assets FOR ALL TO authenticated
    USING (auth_user_has_role('admin') OR auth_user_has_role('technician'));

-- =============================================================================
-- Maintenance requests: department users can create, all can read
-- =============================================================================
CREATE POLICY select_maintenance_requests ON maintenance_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY create_maintenance_requests ON maintenance_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY manage_maintenance_requests ON maintenance_requests FOR UPDATE TO authenticated
    USING (auth_user_has_role('admin') OR auth_user_has_role('technician'));

-- =============================================================================
-- Work orders: readable by all, managed by admin/technician
-- =============================================================================
CREATE POLICY select_work_orders ON work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY manage_work_orders ON work_orders FOR ALL TO authenticated
    USING (auth_user_has_role('admin') OR auth_user_has_role('technician'));

-- =============================================================================
-- All other operational tables: readable by all, writable by admin/technician
-- =============================================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'equipment_locations', 'asset_status_history', 'equipment_documents',
        'installation_records', 'maintenance_events', 'downtime_logs',
        'maintenance_parts_used', 'pm_plans', 'pm_schedules', 'pm_checklists',
        'pm_completions', 'calibration_requests', 'calibration_records',
        'calibration_certificates', 'spare_parts', 'stock_receipts', 'stock_issues',
        'training_requests', 'training_sessions', 'staff_training_records',
        'equipment_training_records', 'disposal_requests', 'disposed_assets'
    ] LOOP
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'select_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_user_has_role(''admin'') OR auth_user_has_role(''technician'') OR auth_user_has_role(''store_user''))', 'insert_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''technician''))', 'update_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_user_has_role(''admin''))', 'delete_' || tbl, tbl);
    END LOOP;
END $$;

-- =============================================================================
-- Analytics tables: readable by all, writable by system/admin
-- =============================================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'equipment_reliability_metrics', 'equipment_risk_scores',
        'pm_compliance_metrics', 'equipment_performance_scores',
        'replacement_priority_scores', 'recommendation_flags'
    ] LOOP
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'select_' || tbl, tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''technician''))', 'manage_' || tbl, tbl);
    END LOOP;
END $$;

-- =============================================================================
-- Audit logs: readable by admin only, insertable by all authenticated
-- =============================================================================
CREATE POLICY select_audit_logs ON audit_logs FOR SELECT TO authenticated USING (auth_user_has_role('admin'));
CREATE POLICY insert_audit_logs ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
