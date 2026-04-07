-- Migration 00010: Analytics / Computed Tables
-- Stores computed reliability metrics, risk scores, PM compliance, performance scores,
-- replacement priorities, and recommendation flags.

-- =============================================================================
-- EQUIPMENT RELIABILITY METRICS
-- Stores MTTR, MTBF, availability per asset per period (Proposal Equations 2-4)
-- =============================================================================
CREATE TABLE equipment_reliability_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    mttr_hours DECIMAL(10,2),
    mtbf_hours DECIMAL(10,2),
    availability_ratio DECIMAL(5,4),
    total_downtime_hours DECIMAL(10,2),
    total_operational_hours DECIMAL(10,2),
    failure_count INTEGER NOT NULL DEFAULT 0,
    repair_count INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(asset_id, period_start, period_end)
);

CREATE INDEX idx_reliability_metrics_asset ON equipment_reliability_metrics(asset_id);

-- =============================================================================
-- EQUIPMENT RISK SCORES
-- Stores FMEA RPN scores per asset (Proposal Equation 1: RPN = S x O x D)
-- =============================================================================
CREATE TABLE equipment_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
    occurrence INTEGER NOT NULL CHECK (occurrence BETWEEN 1 AND 10),
    detectability INTEGER NOT NULL CHECK (detectability BETWEEN 1 AND 10),
    rpn INTEGER GENERATED ALWAYS AS (severity * occurrence * detectability) STORED,
    risk_level TEXT GENERATED ALWAYS AS (
        CASE
            WHEN (severity * occurrence * detectability) >= 500 THEN 'critical'
            WHEN (severity * occurrence * detectability) >= 200 THEN 'high'
            WHEN (severity * occurrence * detectability) >= 80 THEN 'medium'
            ELSE 'low'
        END
    ) STORED,
    assessed_by UUID REFERENCES profiles(id),
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    UNIQUE(asset_id, assessed_at)
);

CREATE INDEX idx_risk_scores_asset ON equipment_risk_scores(asset_id);
CREATE INDEX idx_risk_scores_rpn ON equipment_risk_scores(rpn DESC);

-- =============================================================================
-- PM COMPLIANCE METRICS
-- Stores PMC per department/category per period (Proposal Equation 5)
-- =============================================================================
CREATE TABLE pm_compliance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id),
    category_id UUID REFERENCES equipment_categories(id),
    asset_id UUID REFERENCES equipment_assets(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    scheduled_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    pmc_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN scheduled_count > 0 THEN (completed_count::DECIMAL / scheduled_count) * 100 ELSE 0 END
    ) STORED,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pmc_metrics_department ON pm_compliance_metrics(department_id);
CREATE INDEX idx_pmc_metrics_period ON pm_compliance_metrics(period_start, period_end);

-- =============================================================================
-- EQUIPMENT PERFORMANCE SCORES
-- Composite scores using normalization and weighted aggregation (Proposal Equations 6-7)
-- =============================================================================
CREATE TABLE equipment_performance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    normalized_availability DECIMAL(5,4),
    normalized_mttr DECIMAL(5,4),
    normalized_downtime DECIMAL(5,4),
    normalized_pmc DECIMAL(5,4),
    normalized_failure_rate DECIMAL(5,4),
    composite_score DECIMAL(5,4),
    weights_profile_id UUID REFERENCES scoring_weights(id),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(asset_id, period_start, period_end, weights_profile_id)
);

CREATE INDEX idx_performance_scores_asset ON equipment_performance_scores(asset_id);
CREATE INDEX idx_performance_scores_composite ON equipment_performance_scores(composite_score DESC);

-- =============================================================================
-- REPLACEMENT PRIORITY SCORES
-- Multi-criteria replacement ranking (Proposal Section on Replacement Prioritization)
-- =============================================================================
CREATE TABLE replacement_priority_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    age_score DECIMAL(5,4),
    failure_score DECIMAL(5,4),
    availability_score DECIMAL(5,4),
    maintenance_burden_score DECIMAL(5,4),
    spare_part_score DECIMAL(5,4),
    risk_score DECIMAL(5,4),
    cost_score DECIMAL(5,4),
    replacement_priority_index DECIMAL(5,4),
    rank INTEGER,
    justification TEXT,
    weights_profile_id UUID REFERENCES scoring_weights(id),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(asset_id, period_start, period_end, weights_profile_id)
);

CREATE INDEX idx_replacement_priority_asset ON replacement_priority_scores(asset_id);
CREATE INDEX idx_replacement_priority_rank ON replacement_priority_scores(rank);

-- =============================================================================
-- RECOMMENDATION FLAGS
-- Generated alerts and recommendations from analytics engine
-- =============================================================================
CREATE TABLE recommendation_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL CHECK (flag_type IN (
        'urgent_maintenance', 'monitor_closely', 'prioritize_pm', 'calibrate_soon',
        'replacement_candidate', 'recurring_failure', 'part_shortage', 'high_risk',
        'low_availability', 'overdue_pm', 'warranty_expiring', 'contract_expiring'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    is_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_recommendation_flags_asset ON recommendation_flags(asset_id);
CREATE INDEX idx_recommendation_flags_type ON recommendation_flags(flag_type);
CREATE INDEX idx_recommendation_flags_severity ON recommendation_flags(severity);
CREATE INDEX idx_recommendation_flags_acknowledged ON recommendation_flags(is_acknowledged);
