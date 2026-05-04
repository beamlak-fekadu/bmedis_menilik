-- Migration 00026: Expand RLS role checks so developer mirrors admin/technician
-- This migration drops and recreates every existing policy in prior migrations
-- that checks auth_user_has_role('admin') and/or auth_user_has_role('technician'),
-- adding auth_user_has_role('developer') so developer receives equivalent DB access.
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- Policies originally introduced in 00012_rls_policies.sql
-- =============================================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    -- Reference tables: insert/update/delete_* (admin-only in original policy)
    FOREACH tbl IN ARRAY ARRAY[
        'departments', 'equipment_categories', 'manufacturers', 'equipment_models',
        'vendors', 'suppliers', 'failure_codes', 'maintenance_action_codes',
        'calibration_types', 'pm_templates', 'risk_scales', 'scoring_weights',
        'status_labels', 'roles'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'insert_' || tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'update_' || tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'delete_' || tbl, tbl);

        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_user_has_role(''admin'') OR auth_user_has_role(''developer''))',
            'insert_' || tbl,
            tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''developer''))',
            'update_' || tbl,
            tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''developer''))',
            'delete_' || tbl,
            tbl
        );
    END LOOP;

    -- Operational tables: insert/update/delete_* with admin/technician checks
    FOREACH tbl IN ARRAY ARRAY[
        'equipment_locations', 'asset_status_history', 'equipment_documents',
        'installation_records', 'maintenance_events', 'downtime_logs',
        'maintenance_parts_used', 'pm_plans', 'pm_schedules', 'pm_checklists',
        'pm_completions', 'calibration_requests', 'calibration_records',
        'calibration_certificates', 'spare_parts', 'stock_receipts', 'stock_issues',
        'training_requests', 'training_sessions', 'staff_training_records',
        'equipment_training_records', 'disposal_requests', 'disposed_assets'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'insert_' || tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'update_' || tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'delete_' || tbl, tbl);

        EXECUTE format(
            'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_user_has_role(''admin'') OR auth_user_has_role(''technician'') OR auth_user_has_role(''developer'') OR auth_user_has_role(''store_user''))',
            'insert_' || tbl,
            tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''technician'') OR auth_user_has_role(''developer''))',
            'update_' || tbl,
            tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''developer''))',
            'delete_' || tbl,
            tbl
        );
    END LOOP;

    -- Analytics tables: manage_* with admin/technician checks
    FOREACH tbl IN ARRAY ARRAY[
        'equipment_reliability_metrics', 'equipment_risk_scores',
        'pm_compliance_metrics', 'equipment_performance_scores',
        'replacement_priority_scores', 'recommendation_flags'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'manage_' || tbl, tbl);
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''technician'') OR auth_user_has_role(''developer''))',
            'manage_' || tbl,
            tbl
        );
    END LOOP;
END $$;

DROP POLICY IF EXISTS admin_manage_profiles ON profiles;
CREATE POLICY admin_manage_profiles ON profiles
FOR ALL TO authenticated
USING (auth_user_has_role('admin') OR auth_user_has_role('developer'));

DROP POLICY IF EXISTS admin_manage_user_roles ON user_roles;
CREATE POLICY admin_manage_user_roles ON user_roles
FOR ALL TO authenticated
USING (auth_user_has_role('admin') OR auth_user_has_role('developer'));

DROP POLICY IF EXISTS manage_equipment ON equipment_assets;
CREATE POLICY manage_equipment ON equipment_assets
FOR ALL TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
);

DROP POLICY IF EXISTS manage_maintenance_requests ON maintenance_requests;
CREATE POLICY manage_maintenance_requests ON maintenance_requests
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
);

DROP POLICY IF EXISTS manage_work_orders ON work_orders;
CREATE POLICY manage_work_orders ON work_orders
FOR ALL TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
);

DROP POLICY IF EXISTS select_audit_logs ON audit_logs;
CREATE POLICY select_audit_logs ON audit_logs
FOR SELECT TO authenticated
USING (auth_user_has_role('admin') OR auth_user_has_role('developer'));

-- =============================================================================
-- Policies originally introduced in 00014_memis2_rls_and_refresh.sql
-- =============================================================================
DROP POLICY IF EXISTS manage_memis_lookup_values ON memis_lookup_values;
CREATE POLICY manage_memis_lookup_values ON memis_lookup_values
FOR ALL TO authenticated
USING (auth_user_has_role('admin') OR auth_user_has_role('developer'));

DROP POLICY IF EXISTS insert_procurement_requests ON procurement_requests;
CREATE POLICY insert_procurement_requests ON procurement_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
  OR auth_user_has_role('store_user')
  OR auth_user_has_role('department_user')
);

DROP POLICY IF EXISTS update_procurement_requests ON procurement_requests;
CREATE POLICY update_procurement_requests ON procurement_requests
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
  OR auth_user_has_role('store_user')
);

DROP POLICY IF EXISTS delete_procurement_requests ON procurement_requests;
CREATE POLICY delete_procurement_requests ON procurement_requests
FOR DELETE TO authenticated
USING (auth_user_has_role('admin') OR auth_user_has_role('developer'));

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'equipment_health_snapshots',
        'clinical_readiness_snapshots',
        'triage_action_queue',
        'repeat_repair_flags',
        'escalation_rules',
        'escalation_events',
        'workload_capacity_snapshots',
        'inspection_templates'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'manage_' || tbl, tbl);
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (auth_user_has_role(''admin'') OR auth_user_has_role(''technician'') OR auth_user_has_role(''developer''))',
            'manage_' || tbl,
            tbl
        );
    END LOOP;
END $$;

DROP POLICY IF EXISTS update_offline_sync_events ON offline_sync_events;
CREATE POLICY update_offline_sync_events ON offline_sync_events
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
);

-- =============================================================================
-- Policies originally introduced in 00015_chatbot_tables.sql
-- =============================================================================
DROP POLICY IF EXISTS select_own_chat_sessions ON chat_sessions;
CREATE POLICY select_own_chat_sessions ON chat_sessions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = chat_sessions.user_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('admin')
  OR auth_user_has_role('developer')
);

DROP POLICY IF EXISTS delete_own_chat_sessions ON chat_sessions;
CREATE POLICY delete_own_chat_sessions ON chat_sessions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = chat_sessions.user_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('admin')
  OR auth_user_has_role('developer')
);

DROP POLICY IF EXISTS select_own_chat_messages ON chat_messages;
CREATE POLICY select_own_chat_messages ON chat_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM chat_sessions cs
    JOIN profiles p ON p.id = cs.user_id
    WHERE cs.id = chat_messages.session_id
      AND p.user_id = auth.uid()
  )
  OR auth_user_has_role('admin')
  OR auth_user_has_role('developer')
);

-- =============================================================================
-- Policies originally introduced in 00016_copilot_memory_telemetry_eval.sql
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.chat_session_memory') IS NOT NULL THEN
    DROP POLICY IF EXISTS select_own_chat_memory ON chat_session_memory;
    CREATE POLICY select_own_chat_memory ON chat_session_memory
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM chat_sessions cs
        JOIN profiles p ON p.id = cs.user_id
        WHERE cs.id = chat_session_memory.session_id
          AND p.user_id = auth.uid()
      )
      OR auth_user_has_role('admin')
      OR auth_user_has_role('developer')
    );
  END IF;

  IF to_regclass('public.chat_telemetry_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS select_chat_telemetry ON chat_telemetry_events;
    CREATE POLICY select_chat_telemetry ON chat_telemetry_events
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM chat_sessions cs
        JOIN profiles p ON p.id = cs.user_id
        WHERE cs.id = chat_telemetry_events.session_id
          AND p.user_id = auth.uid()
      )
      OR auth_user_has_role('admin')
      OR auth_user_has_role('developer')
    );
  END IF;

  IF to_regclass('public.chat_evaluation_runs') IS NOT NULL THEN
    DROP POLICY IF EXISTS select_eval_runs ON chat_evaluation_runs;
    CREATE POLICY select_eval_runs ON chat_evaluation_runs
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = chat_evaluation_runs.created_by
          AND p.user_id = auth.uid()
      )
      OR auth_user_has_role('admin')
      OR auth_user_has_role('developer')
    );
  END IF;

  IF to_regclass('public.chat_evaluation_results') IS NOT NULL THEN
    DROP POLICY IF EXISTS select_eval_results ON chat_evaluation_results;
    CREATE POLICY select_eval_results ON chat_evaluation_results
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM chat_evaluation_runs r
        JOIN profiles p ON p.id = r.created_by
        WHERE r.id = chat_evaluation_results.run_id
          AND p.user_id = auth.uid()
      )
      OR auth_user_has_role('admin')
      OR auth_user_has_role('developer')
    );
  END IF;
END $$;

-- =============================================================================
-- Policies originally introduced in 00019_command_center_completeness.sql
-- =============================================================================
DROP POLICY IF EXISTS acknowledge_triage_action_queue ON triage_action_queue;
CREATE POLICY acknowledge_triage_action_queue ON triage_action_queue
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
  OR auth_user_has_role('department_user')
  OR auth_user_has_role('store_user')
)
WITH CHECK (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
  OR auth_user_has_role('department_user')
  OR auth_user_has_role('store_user')
);

DROP POLICY IF EXISTS acknowledge_recommendation_flags ON recommendation_flags;
CREATE POLICY acknowledge_recommendation_flags ON recommendation_flags
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
  OR auth_user_has_role('department_user')
  OR auth_user_has_role('store_user')
)
WITH CHECK (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
  OR auth_user_has_role('department_user')
  OR auth_user_has_role('store_user')
);

-- =============================================================================
-- Policies originally introduced in 00021_decision_support_read_models.sql
-- =============================================================================
DROP POLICY IF EXISTS insert_decision_support_refresh_log ON decision_support_refresh_log;
CREATE POLICY insert_decision_support_refresh_log ON decision_support_refresh_log
FOR INSERT TO authenticated
WITH CHECK (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
);

DROP POLICY IF EXISTS update_decision_support_refresh_log ON decision_support_refresh_log;
CREATE POLICY update_decision_support_refresh_log ON decision_support_refresh_log
FOR UPDATE TO authenticated
USING (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
)
WITH CHECK (
  auth_user_has_role('admin')
  OR auth_user_has_role('technician')
  OR auth_user_has_role('developer')
);
