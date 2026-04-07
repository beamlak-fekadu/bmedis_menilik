-- Seed 10: Analytics / Pre-computed Data
-- Reliability metrics, risk scores, PM compliance, performance scores,
-- replacement priorities, and recommendation flags.
-- Period: 2024-01-01 to 2025-03-31 (15 months)

-- =============================================================================
-- EQUIPMENT RELIABILITY METRICS (for assets with maintenance history)
-- Computed using Proposal Equations 2-4:
--   MTTR = T_maintenance / N_repairs
--   MTBF = T_operational / N_failures
--   Availability = MTBF / (MTBF + MTTR)
-- =============================================================================
INSERT INTO equipment_reliability_metrics (id, asset_id, period_start, period_end, mttr_hours, mtbf_hours, availability_ratio, total_downtime_hours, total_operational_hours, failure_count, repair_count) VALUES
-- ICU Ventilator #1 (a005): 4 failures, moderate downtime
('b2000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', '2024-01-01', '2025-03-31', 2.13, 2718.0, 0.9992, 8.5, 10872.0, 4, 4),
-- ICU Ventilator #2 (a006): 5 failures, HIGH downtime - problem unit
('b2000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000006', '2024-01-01', '2025-03-31', 12.80, 1979.0, 0.9936, 191.5, 10688.5, 5, 5),
-- ICU Ventilator #3 (a007): 1 failure, low downtime
('b2000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000007', '2024-01-01', '2025-03-31', 2.00, 10878.0, 0.9998, 2.0, 10878.0, 1, 1),
-- ICU Monitor #1 (a001): 2 failures, low downtime
('b2000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', '2024-01-01', '2025-03-31', 3.25, 5438.0, 0.9994, 6.5, 10876.0, 2, 2),
-- ICU Monitor #2 (a002): 1 failure
('b2000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002', '2024-01-01', '2025-03-31', 4.00, 10876.0, 0.9996, 4.0, 10876.0, 1, 1),
-- ICU Infusion Pump #1 (a008): 1 failure
('b2000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000008', '2024-01-01', '2025-03-31', 1.50, 10878.5, 0.9999, 1.5, 10878.5, 1, 1),
-- ICU Infusion Pump #3 (a010): 2 failures, very HIGH downtime - awaiting parts
('b2000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000010', '2024-01-01', '2025-03-31', 22.00, 5217.0, 0.9958, 462.75, 10417.25, 2, 2),
-- ICU Defibrillator (a013): 1 failure
('b2000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000013', '2024-01-01', '2025-03-31', 3.00, 10877.0, 0.9997, 3.0, 10877.0, 1, 1),
-- OT Anesthesia #1 (a016): 2 failures
('b2000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000016', '2024-01-01', '2025-03-31', 7.00, 5433.0, 0.9987, 14.0, 10866.0, 2, 2),
-- OT ESU #2 (a020): 2 failures, HIGH downtime (external repair)
('b2000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000020', '2024-01-01', '2025-03-31', 60.00, 4741.0, 0.9875, 698.5, 10181.5, 2, 2),
-- OT Suction #2 (a026): 1 failure, significant downtime
('b2000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000026', '2024-01-01', '2025-03-31', 24.00, 10800.0, 0.9978, 80.75, 10799.25, 1, 1),
-- ED Defibrillator #1 (a028): 1 failure
('b2000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000028', '2024-01-01', '2025-03-31', 8.00, 10872.0, 0.9993, 8.0, 10872.0, 1, 1),
-- RAD Fixed X-ray (a039): 2 failures, HIGH downtime
('b2000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000039', '2024-01-01', '2025-03-31', 44.00, 5069.0, 0.9914, 372.0, 10508.0, 2, 2),
-- RAD CT Scanner (a042): 1 failure
('b2000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000042', '2024-01-01', '2025-03-31', 8.00, 10872.0, 0.9993, 8.0, 10872.0, 1, 1),
-- RAD C-arm (a043): 1 failure
('b2000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000043', '2024-01-01', '2025-03-31', 24.00, 10800.0, 0.9978, 80.0, 10800.0, 1, 1),
-- LAB Hematology #1 (a046): 2 failures
('b2000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000046', '2024-01-01', '2025-03-31', 3.00, 5439.0, 0.9994, 6.0, 10878.0, 2, 2),
-- LAB Chemistry #1 (a048): 2 failures
('b2000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000048', '2024-01-01', '2025-03-31', 2.50, 5439.5, 0.9995, 5.0, 10879.0, 2, 2),
-- LAB Centrifuge #2 (a054): 2 failures, moderate downtime
('b2000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000054', '2024-01-01', '2025-03-31', 8.00, 5367.0, 0.9985, 73.0, 10807.0, 2, 2),
-- Pharmacy Cold Room (a060): 1 failure
('b2000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-000000000060', '2024-01-01', '2025-03-31', 4.00, 10869.0, 0.9996, 11.0, 10869.0, 1, 1),
-- Ward Infusion Pump #3 (a067): 1 failure
('b2000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-000000000067', '2024-01-01', '2025-03-31', 3.00, 10877.0, 0.9997, 3.0, 10877.0, 1, 1);

-- =============================================================================
-- EQUIPMENT RISK SCORES (RPN = S x O x D, Proposal Equation 1)
-- S: Severity (clinical impact), O: Occurrence (failure frequency), D: Detectability
-- =============================================================================
INSERT INTO equipment_risk_scores (id, asset_id, severity, occurrence, detectability, assessed_by, assessed_at, notes) VALUES
-- ICU equipment (high severity)
('b4000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', 9, 5, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'ICU ventilator - life-sustaining; moderate failure rate; good alarm detection'),
('b4000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000006', 9, 7, 4, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'ICU ventilator - recurring failures; O2 sensor issues compromise detection'),
('b4000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000007', 9, 3, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Newer unit; low failure rate'),
('b4000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', 8, 4, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'ICU monitor - critical for continuous monitoring'),
('b4000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002', 8, 3, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', NULL),
('b4000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000010', 8, 6, 5, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Non-functional; high risk because no backup'),
('b4000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000013', 10, 3, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Defibrillator - life-saving; battery replaced'),
-- OT equipment
('b4000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000016', 10, 4, 3, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Anesthesia - life-sustaining during surgery'),
('b4000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000017', 10, 3, 3, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', NULL),
('b4000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000020', 7, 6, 5, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'ESU - recurring power issues; output inconsistent'),
('b4000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000026', 5, 4, 4, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Non-functional suction; backup available'),
-- ED equipment
('b4000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000028', 10, 3, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'ED defibrillator - emergency life-saving'),
('b4000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000031', 7, 4, 3, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'ED monitor with sensor issues'),
-- Radiology
('b4000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000039', 6, 6, 4, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Old X-ray unit; frequent issues; aging tube'),
('b4000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000042', 8, 3, 2, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'CT scanner - high clinical value; service contract active'),
-- Lab
('b4000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000046', 7, 4, 3, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Primary hematology analyzer'),
('b4000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000048', 7, 4, 3, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Primary chemistry analyzer'),
('b4000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000049', 7, 5, 4, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Chemistry #2 - persistent alignment issue'),
('b4000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-000000000054', 4, 5, 4, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Centrifuge - moderate impact; alternatives available'),
-- Ward
('b4000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-000000000067', 6, 3, 4, 'a3000001-0000-0000-0000-000000000001', '2025-03-01', 'Ward infusion pump with sensor issue');

-- =============================================================================
-- PM COMPLIANCE METRICS (by department, quarterly)
-- PMC = (PM_completed / PM_scheduled) x 100 (Proposal Equation 5)
-- =============================================================================
INSERT INTO pm_compliance_metrics (department_id, category_id, period_start, period_end, scheduled_count, completed_count) VALUES
-- ICU Q1-Q4 2024 and Q1 2025
('d0000001-0000-0000-0000-000000000001', NULL, '2024-01-01', '2024-03-31', 12, 11),
('d0000001-0000-0000-0000-000000000001', NULL, '2024-04-01', '2024-06-30', 10, 8),
('d0000001-0000-0000-0000-000000000001', NULL, '2024-07-01', '2024-09-30', 11, 10),
('d0000001-0000-0000-0000-000000000001', NULL, '2024-10-01', '2024-12-31', 10, 8),
('d0000001-0000-0000-0000-000000000001', NULL, '2025-01-01', '2025-03-31', 10, 9),
-- OT
('d0000001-0000-0000-0000-000000000002', NULL, '2024-01-01', '2024-03-31', 8, 7),
('d0000001-0000-0000-0000-000000000002', NULL, '2024-04-01', '2024-06-30', 7, 6),
('d0000001-0000-0000-0000-000000000002', NULL, '2024-07-01', '2024-09-30', 8, 6),
('d0000001-0000-0000-0000-000000000002', NULL, '2024-10-01', '2024-12-31', 7, 6),
('d0000001-0000-0000-0000-000000000002', NULL, '2025-01-01', '2025-03-31', 8, 7),
-- ED
('d0000001-0000-0000-0000-000000000003', NULL, '2024-01-01', '2024-03-31', 4, 3),
('d0000001-0000-0000-0000-000000000003', NULL, '2024-04-01', '2024-06-30', 4, 3),
('d0000001-0000-0000-0000-000000000003', NULL, '2024-07-01', '2024-09-30', 4, 4),
('d0000001-0000-0000-0000-000000000003', NULL, '2024-10-01', '2024-12-31', 4, 3),
('d0000001-0000-0000-0000-000000000003', NULL, '2025-01-01', '2025-03-31', 4, 4),
-- Lab
('d0000001-0000-0000-0000-000000000005', NULL, '2024-01-01', '2024-03-31', 6, 4),
('d0000001-0000-0000-0000-000000000005', NULL, '2024-04-01', '2024-06-30', 6, 4),
('d0000001-0000-0000-0000-000000000005', NULL, '2024-07-01', '2024-09-30', 6, 4),
('d0000001-0000-0000-0000-000000000005', NULL, '2024-10-01', '2024-12-31', 6, 4),
('d0000001-0000-0000-0000-000000000005', NULL, '2025-01-01', '2025-03-31', 6, 5),
-- OPD (lowest compliance)
('d0000001-0000-0000-0000-000000000008', NULL, '2024-01-01', '2024-03-31', 3, 2),
('d0000001-0000-0000-0000-000000000008', NULL, '2024-04-01', '2024-06-30', 3, 1),
('d0000001-0000-0000-0000-000000000008', NULL, '2024-07-01', '2024-09-30', 3, 2),
('d0000001-0000-0000-0000-000000000008', NULL, '2024-10-01', '2024-12-31', 3, 1),
('d0000001-0000-0000-0000-000000000008', NULL, '2025-01-01', '2025-03-31', 3, 2);

-- =============================================================================
-- EQUIPMENT PERFORMANCE SCORES (Composite scoring, Proposal Equations 6-7)
-- NormScore = (value - min) / (max - min), then TS = SUM(w_j * s_ij)
-- Using Balanced Default weights profile
-- =============================================================================
INSERT INTO equipment_performance_scores (id, asset_id, period_start, period_end, normalized_availability, normalized_mttr, normalized_downtime, normalized_pmc, normalized_failure_rate, composite_score, weights_profile_id) VALUES
('e2000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', '2024-01-01', '2025-03-31', 0.9500, 0.9500, 0.9800, 0.8500, 0.6000, 0.8650, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000006', '2024-01-01', '2025-03-31', 0.4200, 0.2100, 0.3500, 0.8000, 0.2000, 0.3990, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000007', '2024-01-01', '2025-03-31', 0.9900, 0.9800, 0.9900, 0.9000, 0.9000, 0.9520, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', '2024-01-01', '2025-03-31', 0.9200, 0.9000, 0.9500, 0.8000, 0.7000, 0.8550, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000010', '2024-01-01', '2025-03-31', 0.1000, 0.0500, 0.0000, 0.0000, 0.4000, 0.1100, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000016', '2024-01-01', '2025-03-31', 0.8800, 0.8200, 0.9200, 0.8500, 0.7000, 0.8350, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000020', '2024-01-01', '2025-03-31', 0.1500, 0.0000, 0.0500, 0.7500, 0.4000, 0.2700, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000039', '2024-01-01', '2025-03-31', 0.3000, 0.1500, 0.2000, 0.6000, 0.4000, 0.3300, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000046', '2024-01-01', '2025-03-31', 0.9100, 0.9200, 0.9400, 0.6700, 0.7000, 0.8290, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000048', '2024-01-01', '2025-03-31', 0.9300, 0.9400, 0.9500, 0.7000, 0.7000, 0.8440, 'b7000001-0000-0000-0000-000000000001'),
('e2000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000054', '2024-01-01', '2025-03-31', 0.7500, 0.7200, 0.7000, 0.5000, 0.5000, 0.6340, 'b7000001-0000-0000-0000-000000000001');

-- =============================================================================
-- REPLACEMENT PRIORITY SCORES (Multi-criteria ranking, Proposal Section on Replacement)
-- Criteria: age, failure_rate, availability, maintenance_burden, spare_parts, risk
-- Higher index = higher replacement priority
-- =============================================================================
INSERT INTO replacement_priority_scores (id, asset_id, period_start, period_end, age_score, failure_score, availability_score, maintenance_burden_score, spare_part_score, risk_score, cost_score, replacement_priority_index, rank, justification, weights_profile_id) VALUES
('b3000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000039', '2024-01-01', '2025-03-31', 0.85, 0.60, 0.70, 0.75, 0.60, 0.48, 0.80, 0.6850, 1, 'Oldest imaging unit (11 years); high maintenance cost from tube replacement; recurring collimator issues; replacement recommended', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000020', '2024-01-01', '2025-03-31', 0.55, 0.60, 0.85, 0.90, 0.50, 0.70, 0.70, 0.6830, 2, 'ESU #2 with repeated generator failures requiring external repair; extended downtime impacts surgical schedule', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000006', '2024-01-01', '2025-03-31', 0.55, 0.80, 0.58, 0.65, 0.40, 0.84, 0.50, 0.6170, 3, 'ICU Ventilator #2 with recurring O2 sensor and valve failures; 5 breakdowns in 15 months; critical life-support device', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000010', '2024-01-01', '2025-03-31', 0.40, 0.50, 0.90, 0.80, 0.85, 0.80, 0.30, 0.6080, 4, 'Infusion Pump #3 non-functional for 6+ months; spare part unavailable; recommend disposal and replacement', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000054', '2024-01-01', '2025-03-31', 0.75, 0.50, 0.55, 0.50, 0.40, 0.27, 0.35, 0.4760, 5, 'Old centrifuge with rotor bearing issues; 10 years old; continued vibration problems', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000049', '2024-01-01', '2025-03-31', 0.35, 0.40, 0.45, 0.40, 0.35, 0.47, 0.40, 0.4030, 6, 'Chemistry Analyzer #2 with persistent probe alignment issue; not yet critical but degrading', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000016', '2024-01-01', '2025-03-31', 0.65, 0.40, 0.30, 0.35, 0.25, 0.40, 0.45, 0.4000, 7, 'Anesthesia Machine #1 is 8+ years old; 2 failures; manageable but aging', 'b7000001-0000-0000-0000-000000000001'),
('b3000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000026', '2024-01-01', '2025-03-31', 0.45, 0.30, 0.50, 0.50, 0.60, 0.27, 0.30, 0.3890, 8, 'OR Suction Unit #2 non-functional; motor replacement attempted', 'b7000001-0000-0000-0000-000000000001');

-- =============================================================================
-- RECOMMENDATION FLAGS (actionable alerts from analytics)
-- =============================================================================
INSERT INTO recommendation_flags (asset_id, flag_type, severity, message, details, is_acknowledged, generated_at) VALUES
-- Critical alerts
('a0000001-0000-0000-0000-000000000006', 'recurring_failure', 'critical', 'ICU Ventilator #2 has had 5 corrective maintenance events in 15 months. Recurring O2 sensor and valve failures indicate systemic reliability degradation.', '{"failure_count": 5, "period_months": 15, "rpn": 252}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000006', 'replacement_candidate', 'high', 'ICU Ventilator #2 ranks #3 in replacement priority index. Consider procurement planning for replacement unit.', '{"rpi_rank": 3, "rpi_score": 0.617}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000010', 'urgent_maintenance', 'critical', 'ICU Infusion Pump #3 has been non-functional since August 2024. Awaiting spare part (roller assembly) for over 6 months.', '{"days_non_functional": 220, "spare_part": "SP-RLR-INF", "stock": 0}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000010', 'part_shortage', 'high', 'Infusion Pump Roller Assembly (SP-RLR-INF) has zero stock. Required for ICU Infusion Pump #3 repair.', '{"part_code": "SP-RLR-INF", "current_stock": 0}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000020', 'replacement_candidate', 'high', 'OT Electrosurgical Unit #2 ranks #2 in replacement priority. Two extended external repairs totaling 120+ hours of downtime.', '{"rpi_rank": 2, "total_downtime_hours": 698.5}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000039', 'replacement_candidate', 'high', 'Fixed X-ray unit ranks #1 in replacement priority. Equipment is 11 years old with high maintenance costs.', '{"rpi_rank": 1, "age_years": 11, "rpi_score": 0.685}', false, '2025-03-15 08:00:00+03'),
-- High alerts
('a0000001-0000-0000-0000-000000000020', 'low_availability', 'high', 'OT ESU #2 availability is 0.9875 over 15 months with 698.5 hours total downtime due to external repairs.', '{"availability": 0.9875, "downtime_hours": 698.5}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000033', 'part_shortage', 'medium', 'Suction Motor Assembly (SP-MOT-SUC) has zero stock. Required for OR Suction Unit #2 motor replacement.', '{"part_code": "SP-MOT-SUC", "current_stock": 0}', false, '2025-03-15 08:00:00+03'),
-- PM overdue alerts
('a0000001-0000-0000-0000-000000000006', 'overdue_pm', 'high', 'Ventilator #2 PM was due on March 25, 2025 and is now overdue by 13 days.', '{"scheduled_date": "2025-03-25", "days_overdue": 13}', false, '2025-04-07 08:00:00+03'),
('a0000001-0000-0000-0000-000000000027', 'overdue_pm', 'medium', 'OR Autoclave PM was due on March 28, 2025 and is now overdue.', '{"scheduled_date": "2025-03-28", "days_overdue": 10}', false, '2025-04-07 08:00:00+03'),
('a0000001-0000-0000-0000-000000000057', 'overdue_pm', 'medium', 'Lab Autoclave PM was due on March 30, 2025 and is now overdue.', '{"scheduled_date": "2025-03-30", "days_overdue": 8}', false, '2025-04-07 08:00:00+03'),
-- Calibration alerts
('a0000001-0000-0000-0000-000000000039', 'calibrate_soon', 'medium', 'Fixed X-ray imaging QA was due March 18, 2025 and is now overdue.', '{"next_due": "2025-03-18", "calibration_type": "Imaging QA"}', false, '2025-04-07 08:00:00+03'),
('a0000001-0000-0000-0000-000000000049', 'calibrate_soon', 'high', 'Chemistry Analyzer #2 calibration was due December 15, 2024 and is significantly overdue.', '{"next_due": "2024-12-15", "calibration_type": "Lab Analyzer Calibration"}', false, '2025-04-07 08:00:00+03'),
-- PMC compliance alerts
('a0000001-0000-0000-0000-000000000077', 'prioritize_pm', 'medium', 'OPD Autoclave PM compliance is only 53% over 15 months. Schedule adherence needs improvement.', '{"pmc_percentage": 53.3, "completed": 8, "scheduled": 15}', false, '2025-03-15 08:00:00+03'),
-- Monitor closely
('a0000001-0000-0000-0000-000000000054', 'monitor_closely', 'medium', 'Lab Centrifuge #2 has recurring vibration issues. Bearing replaced but symptoms returning. Watch for further degradation.', '{"failure_count": 2, "age_years": 10}', false, '2025-03-15 08:00:00+03'),
('a0000001-0000-0000-0000-000000000049', 'monitor_closely', 'medium', 'Chemistry Analyzer #2 has persistent probe alignment issue. May need vendor service or replacement of probe mechanism.', '{"failure_count": 2, "pending_request": true}', false, '2025-03-15 08:00:00+03');
