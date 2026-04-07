-- Migration 00005: Preventive Maintenance Tables
-- PM plans, schedules, checklists, and completions.

-- =============================================================================
-- PM PLANS
-- =============================================================================
CREATE TABLE pm_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    template_id UUID REFERENCES pm_templates(id),
    name TEXT NOT NULL,
    frequency_days INTEGER NOT NULL DEFAULT 90,
    next_due_date DATE,
    last_completed_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_plans_asset ON pm_plans(asset_id);
CREATE INDEX idx_pm_plans_next_due ON pm_plans(next_due_date);
CREATE TRIGGER trg_pm_plans_updated_at BEFORE UPDATE ON pm_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PM SCHEDULES
-- =============================================================================
CREATE TABLE pm_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES pm_plans(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES equipment_assets(id),
    scheduled_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'overdue', 'skipped', 'in_progress')),
    assigned_to UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_schedules_plan ON pm_schedules(plan_id);
CREATE INDEX idx_pm_schedules_asset ON pm_schedules(asset_id);
CREATE INDEX idx_pm_schedules_date ON pm_schedules(scheduled_date);
CREATE INDEX idx_pm_schedules_status ON pm_schedules(status);
CREATE TRIGGER trg_pm_schedules_updated_at BEFORE UPDATE ON pm_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PM CHECKLISTS
-- =============================================================================
CREATE TABLE pm_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES pm_schedules(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_pm_checklists_updated_at BEFORE UPDATE ON pm_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PM COMPLETIONS
-- =============================================================================
CREATE TABLE pm_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES pm_schedules(id) ON DELETE CASCADE,
    completed_by UUID REFERENCES profiles(id),
    completion_date DATE NOT NULL,
    duration_hours DECIMAL(6,2),
    notes TEXT,
    checklist_results JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_completions_schedule ON pm_completions(schedule_id);
