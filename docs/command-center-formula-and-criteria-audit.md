# Command Center Formula and Criteria Audit

## 1. Executive Summary

The Command Center calculates operational risk, reliability, preventive maintenance compliance, replacement priority, equipment health, clinical readiness, technician workload, and cross-module action priority. These outputs support the BME Head by turning raw records from equipment, work orders, PM, calibration, spare parts, procurement, and analytics snapshots into ranked decisions: what is unsafe, what is unavailable, what needs PM or calibration, what may need replacement, and where staff workload is overloaded.

The repository contains both canonical database implementations and TypeScript/UI implementations. The strongest implemented formulas are RPN/FMEA, MTBF, MTTR, availability, PMC, RPI, equipment health, readiness, and Command Center critical action scoring. Several values are hardcoded but documented in code comments. The main audit concerns are: replacement page UI weights do not match the canonical RPI weights, some recommendation rules exist as a utility but are not wired to a generator, legacy seeded analytics rows can coexist with live recomputed rows, and some snapshot values require explicit refresh or scheduled Edge Function execution.

## 2. Source Files Reviewed

| File path | What it contains | Why it matters |
| --- | --- | --- |
| `src/utils/analytics/formulas.ts` | Pure TypeScript formulas for RPN, risk band, availability, MTBF, MTTR, PMC, downtime burden, annualized failure rate. | Thesis proposal formula reference and Edge Function mirror. |
| `src/utils/analytics/normalization.ts` | Min-max and inverse min-max normalization helpers. | Used by composite and RPI formulas. |
| `src/utils/analytics/composite-scoring.ts` | Weighted sum, ranking, and weight validation helpers. | Implements general composite score logic. |
| `src/utils/analytics/replacement-index.ts` | TypeScript RPI criteria, default weights, normalization, weighted sum, ranking. | Canonical code-level replacement model. |
| `src/utils/analytics/recommendations.ts` | Recommendation flag generation rules and thresholds. | Defines many alert rules, but no caller was found. |
| `src/utils/analytics/score-registry.ts` | Registry of formulas, data modes, weights, criteria, source tables, limitations. | Best in-code documentation source for formulas and weights. |
| `src/utils/analytics/critical-action-bands.ts` | Critical action category weights and urgency bands. | Canonical Command Center action scoring weights. |
| `src/utils/decision-support/procurement-delay.ts` | Procurement delay score based on expected delivery date, age fallback, and priority boost. | Live procurement triage scoring. |
| `src/utils/decision-support/replacement-thresholds.ts` | RPI strong/review/monitor thresholds. | Shared replacement classification rules. |
| `src/utils/decision-support/command-center-reasons.ts` | Human-readable explanations for triage and lifecycle drivers. | Explains criteria to users. |
| `src/utils/viewer/readiness.ts` | Department readiness risk classification for viewer command center. | Viewer-facing readiness risk thresholds. |
| `src/utils/viewer/executive-metrics.ts` | Executive rollups for readiness, PM, calibration, risk, replacement, stock, procurement. | Management dashboard aggregation logic. |
| `src/services/decision-support.service.ts` | Snapshot fetcher plus operational fallback health, triage, readiness, workload computation. | Legacy/secondary decision-support data path. |
| `src/services/analytics.service.ts` | Reads reliability, risk, PMC, performance, replacement, flags. | Connects UI to analytics tables. |
| `src/services/risk-assessment.service.ts` | Reads/refetches FMEA risk scores and explains dimensions. | Risk page/equipment detail evidence path. |
| `src/services/metrics/workload.service.ts` | Canonical live technician workload classification. | Workload/capacity score source of truth. |
| `src/services/maintenance.service.ts` | Maintenance requests/work orders/events and recompute trigger after completed work order. | Source of repair, failure, downtime, and recompute evidence. |
| `src/services/pm.service.ts` | PM plans/schedules/completions and recompute trigger after completed PM status. | Source of PMC and overdue PM evidence. |
| `src/services/equipment.service.ts` | Equipment asset fields: condition, status, install date, warranty, contract, category. | Source of age, health, readiness, warranty/contract fields. |
| `src/app/(dashboard)/command/_lib/command-center-data.ts` | Live Command Center fetchers, triage scoring, critical action scoring. | Main BME Head Command Center logic. |
| `src/app/(dashboard)/command/page.tsx` | Command Center page and replacement data fetch. | Main UI consumer and RPI candidate filter. |
| `src/app/(dashboard)/command/_components/TriageCenterTabs.tsx` | Triage UI score explanations. | Displays formula evidence to user. |
| `src/app/(dashboard)/command/_components/CommandCenterInteractive.tsx` | Department readiness UI formula explanation. | Shows readiness calculation. |
| `src/app/(dashboard)/replacement/page.tsx` | Replacement page filters, displayed RPI weights, thresholds, explanations. | Contains a weight mismatch against canonical RPI. |
| `src/app/(dashboard)/replacement/_components/ViewerReplacementRisk.tsx` | Viewer replacement risk summary. | Uses canonical RPI thresholds. |
| `src/app/(dashboard)/pm/page.tsx` | PM module UI. | Uses PM schedules/compliance evidence. |
| `src/app/(dashboard)/maintenance/page.tsx` and subroutes | Maintenance workflow UI. | Sources operational records for reliability and triage. |
| `src/types/database.ts` | Generated Supabase table/view/function types. | Confirms database fields and RPC names. |
| `supabase/migrations/00001_reference_tables.sql` | Risk scales and scoring weight profiles. | Lookup/reference source for S/O/D labels and composite weight profiles. |
| `supabase/migrations/00010_analytics_tables.sql` | Analytics table definitions and generated RPN/PMC columns. | Defines stored metrics and generated values. |
| `supabase/migrations/00011_views_and_functions.sql` | Initial SQL views and functions for MTBF, MTTR, availability, PMC. | SQL implementation of reliability/PM formulas. |
| `supabase/migrations/00013_memis2_decision_support_and_guardrails.sql` | Decision-support snapshot tables, escalation/repeat repair tables/rules. | Adds Command Center materializations. |
| `supabase/migrations/00019_command_center_completeness.sql` | Earlier refresh_decision_support_snapshots implementation. | Historical implementation, later replaced. |
| `supabase/migrations/00020_fix_mtbf_date_extract.sql` | Final MTBF date interval fix. | Corrects SQL MTBF period-hour calculation. |
| `supabase/migrations/00021_decision_support_read_models.sql` and `00031_audit_read_model_views.sql` | Read model views including v_asset_health_summary, v_department_readiness, v_replacement_decision, v_overdue_pm, v_calibration_due. | UI and reports read these views. |
| `supabase/migrations/00023_replacement_scores_triage_pmc_fixes.sql` | RPI computation for all active assets; latest refresh snapshot core. | Main SQL source for RPI, health, readiness, workload, triage queue. |
| `supabase/migrations/00034_reliability_metrics_dedup.sql` | Latest `_recompute_asset_metrics` upsert behavior: one reliability row per asset. | Final reliability/PMC recompute behavior. |
| `supabase/migrations/00036_fmea_risk_engine.sql` | Final FMEA engine and risk refresh triggers. | Main SQL source of severity, occurrence, detectability assignment. |
| `supabase/migrations/00043_calibration_due_asset_id.sql` and `00044_view_department_columns.sql` | Current v_calibration_due and v_overdue_pm shape. | Source of PM/calibration triage inputs. |
| `supabase/migrations/00049_pg_cron_schedule.sql`, `00054_pg_cron_fire_and_reap.sql` | Scheduled analytics refresh machinery. | Determines automatic snapshot recomputation path. |
| `supabase/migrations/00061_reliability_evidence.sql` and `00069_fix_work_order_reliability_event_upsert.sql` | Downtime and maintenance event evidence pipeline. | Ensures completed corrective work can feed MTBF/MTTR/availability. |
| `supabase/functions/refresh-analytics-snapshot/index.ts` | Edge Function calling recompute_all_equipment_analytics and refresh_decision_support_snapshots. | Scheduled/manual full refresh path. |
| `supabase/functions/calculate-equipment-scores/index.ts` | On-demand score calculation mirror for one asset. | Confirms TypeScript formula parity for RPN/reliability/PMC. |
| `supabase/seed/01_reference_data.sql` | Risk scale labels and scoring weight profiles. | Seeded lookup/reference values. |
| `supabase/seed/10_analytics_data.sql` | Seeded reliability, RPN, PMC, performance, RPI, and recommendation flags. | Demo/baseline values. |
| `supabase/menelikII-data/thesis-data-extraction/04b-formulas-and-weights.md` | Existing thesis formula/weight evidence. | Used to compare thesis/progress documentation against code. |
| `supabase/menelikII-data/thesis-data-extraction/04-menelik-analytics-results.md` | Menelik analytics result cautions. | Documents limited operational history for longitudinal metrics. |
| `src/app/(dashboard)/decision-support` | Not found in repository. | User-requested path does not exist. |
| `src/app/(dashboard)/analytics` | Not found in repository. | User-requested path does not exist. |
| `src/app/(dashboard)/risk` | Not found in repository. | User-requested path does not exist. |

## 3. Formula Inventory Table

| No. | Formula / Score | Purpose | Equation / Logic | Criteria Used | Weights / Thresholds | Implementation Location | Data Source | Status |
| --- | --------------- | ------- | ---------------- | ------------- | -------------------- | ----------------------- | ----------- | ------ |
| 1 | RPN | FMEA asset risk | `severity * occurrence * detectability` | Severity, occurrence, detectability | S/O/D each 1-10 | `src/utils/analytics/formulas.ts`, `supabase/migrations/00010_analytics_tables.sql`, `00036_fmea_risk_engine.sql` | Risk score table, computed FMEA engine, seeded risk rows | Implemented |
| 2 | Risk classification | Badge/classify RPN | critical >=500, high >=200, medium >=80, else low | RPN | 500/200/80 | `classifyRiskLevel`, `fn_classify_risk_level`, generated `risk_level` | Computed/generated | Implemented |
| 3 | FMEA severity assignment | Calculate S from clinical impact | Max of category, condition, department severity | category criticality, condition, department name/code | critical category 9, high 8, medium 5, low 3; non-functional 7, needs repair 6, under maintenance 5; ICU/ED/OR/etc. 8, lab/radiology 6, ward/OPD/pharmacy 4 | `fn_compute_fmea_risk_for_asset` | Equipment asset, category, department | Implemented, hardcoded |
| 4 | FMEA occurrence assignment | Calculate O from failure likelihood | Based on 365-day failures, age, condition, recurring flag | failure events, completed corrective WOs, age, condition, recurring_failure flag | >=6 failures ->9; >=5 ->8; >=3 ->6; >=1 ->4; else 2. Age >=12 -> at least 6, >=10 ->5, >=7 ->4. Condition and recurring flag floors. | `fn_compute_fmea_risk_for_asset` | Maintenance events, work orders, equipment asset, recommendation flags | Implemented, hardcoded |
| 5 | FMEA detectability assignment | Calculate D from control weaknesses | Baseline 2 plus penalties | PM overdue days, PMC, calibration due/overdue/result, PM plan, recent control, condition | condition +2; PM >30d +2, >0 +1; calibration overdue +2, due 30d +1; fail +2, adjusted +1; PMC <50 +2, <80 +1; no PM plan +1; no recent control +1 | `fn_compute_fmea_risk_for_asset` | PM schedules/plans/compliance, calibration records/requests, maintenance events, PM completions | Implemented, hardcoded |
| 6 | MTBF | Reliability between failures | `total_operational_hours / failure_count` | Period hours, downtime hours, failure count | Null if no failures; zero if operational hours <=0 | `computeMTBF`, `fn_compute_mtbf`, Edge Function | maintenance_events, downtime_logs | Implemented |
| 7 | MTTR | Repair maintainability | `total_repair_hours / repair_count` | repair_duration_hours, completed repair count | Null if no repair count | `computeMTTR`, `fn_compute_mttr`, Edge Function | maintenance_events | Implemented |
| 8 | Availability | Operational uptime proxy | `MTBF / (MTBF + MTTR)` | MTBF, MTTR | Null if missing or denominator zero | `computeAvailability`, `fn_compute_availability`, Edge Function | reliability metrics from events/downtime | Implemented |
| 9 | PMC | PM schedule adherence | `completed_count / scheduled_count * 100` | Scheduled PM count, completed PM count | SQL generated column returns 0 if scheduled_count=0; utility returns null if scheduled_count<=0 | `computePMC`, `fn_compute_pmc`, `_recompute_asset_metrics`, `pm_compliance_metrics.pmc_percentage` | pm_schedules, pm_compliance_metrics | Implemented; null/zero inconsistency |
| 10 | Downtime burden | Burden of downtime over observation period | `total_downtime_hours / period_hours * 100` | total downtime, period hours | Null if period_hours<=0 | `src/utils/analytics/formulas.ts` | Utility only | Implemented utility, no main Command Center use found |
| 11 | Annualized failure rate | Normalize failure frequency per year | `failure_count / period_days * 365` | failure count, period days | Null if period_days<=0 | `src/utils/analytics/formulas.ts` | Utility only | Implemented utility, no main Command Center use found |
| 12 | Min-max normalization | Scale criteria for composite scores | `(value - min) / (max - min)`; inverse `1 - normalized` | Value, min, max | default 0.5 when no variance in array/RPI callers | `normalization.ts`, `compute_replacement_priority_scores_all` | Raw analytics columns | Implemented |
| 13 | Weighted composite score | Generic composite score | `sum(weight * normalized_value)` | normalized criteria, weights | No enforced sum in compute; validate function checks tolerance 0.01 | `composite-scoring.ts`; seeded `equipment_performance_scores` | Seeded performance rows, optional scoring_weights | Implemented utility/seeded; no live recompute found |
| 14 | RPI | Replacement planning priority | Weighted sum of normalized age, failures, inverse availability, downtime burden, spare shortages, RPN, maintenance cost | age, failure_count, availability, downtime, part shortage flags, RPN, maintenance service cost | Age 0.15, failures 0.15, availability 0.20, burden 0.15, spare 0.10, risk 0.15, cost 0.10 | `replacement-index.ts`, `compute_replacement_priority_scores_all`, `v_replacement_decision` | equipment_assets, reliability metrics, risk scores, maintenance_events, recommendation_flags | Implemented |
| 15 | Replacement bands | Classify RPI | strong >=0.70, review >=0.55, else monitor | RPI | 0.70/0.55 | `replacement-thresholds.ts` | replacement_priority_scores | Implemented |
| 16 | Equipment health score | Asset-level health summary | `availability*35 + pmc/100*25 + (1-min(0.35,rpn/1000))*25 + (1-conditionPenalty-flagPenalty)*15`, minimum 1 | availability, PMC, RPN, condition, active flags | 35/25/25/15; defaults availability 0.92, PMC 80, RPN 120; condition penalty 0/0.15/0.30; flag penalty min 0.25 at 0.05 each | `refresh_decision_support_snapshots`, `decision-support.service.ts` fallback | reliability, pm_compliance, risk, equipment_assets, recommendation_flags | Implemented, hardcoded defaults |
| 17 | Clinical readiness | Department service readiness | `essential_functional / essential_total * 100` | high/critical assets, functional active status | high/critical assets only | `refresh_decision_support_snapshots`, `v_department_readiness`, `CommandCenterInteractive.tsx` | equipment_assets, equipment_categories | Implemented |
| 18 | Viewer department risk | Viewer readiness classification | high if essential unavailable >0 or critical/high open work >0; medium if readiness<80 or overdue PM+calibration>=3; low otherwise; unknown if no readiness and no overdue signals | readiness, unavailable essential, open work, overdue PM, overdue calibration | readiness 80, overdue combined 3 | `src/utils/viewer/readiness.ts` | v_department_readiness, v_open_work_orders, v_overdue_pm, v_calibration_due | Implemented |
| 19 | Legacy triage priority queue | Snapshot-ranked intervention list | severity flag score + min(40,RPN/15) + max(0,(80-PMC)/2) + max(0,20-rank) | flags, RPN, PMC, replacement rank | flag severity critical 45, high 25, medium 10, else 4 | `refresh_decision_support_snapshots`, `decision-support.service.ts` fallback | recommendation_flags, risk, PM, replacement | Implemented snapshot path |
| 20 | Live critical action score | Rank top BME Head actions | category base + item score, sorted descending | module category, item-specific urgency | base weights: corrective 100, needs_request 90, calibration 85, PM 75, stock 70, risk_watch 65, installation 60, replacement 55, procurement 45, training 35. Bands: critical >=180, high >=150, medium >=100 | `critical-action-bands.ts`, `buildCriticalActions` | live fetchers | Implemented |
| 21 | Corrective maintenance triage | Rank open corrective work/request | urgency score + status score + min(20,daysOpen*0.5) | priority/urgency, status, age | urgency critical 40/high 30/medium 20/default 10; status in_progress 20, assigned 15, on_hold 10, open/pending 5, approved 10 | `fetchCorrectiveMaintenanceTriage` | work_orders, maintenance_requests | Implemented |
| 22 | Needs-request triage | Find nonfunctional assets without active corrective request | `90 + conditionScore + deptScore + riskScore + healthPenalty` | condition, category criticality, risk level, health score | condition 45/35/25; criticality 25/18/8; risk critical 20/high 12; health penalty min 10 `(70-health)/7` | `fetchNeedsRequestTriage` | equipment_assets, risk scores, v_asset_health_summary | Implemented |
| 23 | Proactive risk watch | Watch risky assets without open corrective work | Sum flag severity scores plus risk level score | flags, risk level, condition, active work state | flag critical 30/high 20/default 10; risk critical 40/high 25 | `fetchProactiveRiskWatch` | recommendation_flags, risk scores, equipment_assets | Implemented |
| 24 | PM triage priority | Rank overdue PM | `50 + min(50, daysOverdue*0.3)` | scheduled date, overdue days | base 50, cap 50 | `fetchPMTriage`, `score-registry.ts` | v_overdue_pm | Implemented |
| 25 | Calibration triage priority | Rank due/overdue calibration | `50 + min(50, daysOverdue*0.5)` | next_due_date, overdue days | base 50, cap 50 | `fetchCalibrationTriage`, `score-registry.ts` | v_calibration_due | Implemented |
| 26 | Stock blocker priority | Rank spare part blockers | linked active work ->100; stockout ->90; low stock -> `60 + deficit/reorder*30` | current stock, reorder level, active work link | 100/90/60+ratio*30 | `fetchStockBlockers` | spare_parts, work_order_parts_needed, maintenance_parts_used, work_orders | Implemented |
| 27 | Installation triage | Rank pending commissioning | `40 + min(40, daysPending*0.5)` | installation date, commissioning date | base 40, cap 40 | `fetchInstallationTriage` | installation_records | Implemented |
| 28 | Procurement delay priority | Rank delayed procurement | Expected-date path: delayed `60 + min(120,daysPastDue*2)+priorityBoost`; not delayed `20+priorityBoost`; no expected date fallback `25+min(45,age*0.5)+priorityBoost`; terminal 0 | expected_delivery_date, created_at, status, priority | priority boost critical +40, high +20, medium 0, low -10; bands critical>=150/high>=100/medium>=60 | `scoreProcurementDelay`, `fetchProcurementTriage` | procurement_requests | Implemented |
| 29 | Training triage | Rank pending training requests | `35 + min(35, daysPending*0.3)` | created_at, status | base 35, cap 35 | `fetchTrainingTriage` | training_requests | Implemented |
| 30 | Technician workload / capacity | Classify workload status | overloaded if open assignments>=6 or critical tasks>0; busy if open>=3; else available | open assignments, critical tasks | 6/3 thresholds; any critical task overloads | `workload.service.ts` | profiles, user_roles, work_orders | Implemented |
| 31 | Recommendation flags | Generate asset recommendations | Rule-based thresholds for nonfunctional days, failures, availability, RPN, RPI rank, PM, calibration, parts, warranty, contract | operational metrics | daysNonFunctional>30/>90; failure>=4/>=6; availability<0.95/<0.90; RPN>=200/>=500; rank<=5/<=2; PM overdue>0/>30; PMC<70/<50; calibration overdue>0/>30; warranty/contract<=90/<=30 | `recommendations.ts` | Inputs only | Implemented utility, no caller found |
| 32 | Escalation rules | Rule table for escalation | Seeded config JSON | department, days overdue, priority, repeat threshold, criticality | ICU critical min_days 1; repeat threshold 3 in 60 days; calibration overdue high/critical min 7 days | `00013_memis2_decision_support_and_guardrails.sql` | escalation_rules | Seeded table; no evaluator found |
| 33 | Repeat repair flags | Intended repeat repair tracking | Table fields only | failure_count_window, window_days | default window_days 180 | `repeat_repair_flags` table; `00032` says superseded by recommendation_flags.recurring_failure | Not actively populated |
| 34 | Calibration due/overdue logic | Due/overdue queue | `next_due_date <= current_date + 90 days`; Command Center filters next 30 days; overdue when due date < today | calibration next_due_date | 90-day view; 30-day Command Center horizon; >30 days badge in compliance UI | `v_calibration_due`, `fetchCalibrationTriage`, compliance page | calibration_records | Implemented |
| 35 | PM overdue logic | PM overdue queue | status overdue or active scheduled/in_progress with scheduled_date < today | PM status, scheduled_date | due soon 30 days in PM semantics; overdue if date past | `v_overdue_pm`, `pm/semantics.ts` | pm_schedules | Implemented |
| 36 | Warranty/contract expiry logic | Flag expiring support coverage | remaining days >0 and <=90; high if <=30 else medium | warrantyDaysRemaining, contractDaysRemaining | 90/30 days | `recommendations.ts` | equipment_assets fields when caller supplies days | Utility only; no caller found |

## 4. Detailed Formula Explanations

### RPN / FMEA Risk

**Purpose:**
RPN helps the BME Head identify equipment whose failure would be clinically serious, likely to happen, and difficult to detect or control.

**Formula / Logic:**
`RPN = Severity x Occurrence x Detectability`.

**Implementation Location:**
`src/utils/analytics/formulas.ts` function `computeRPN`; `supabase/migrations/00010_analytics_tables.sql` generated column `equipment_risk_scores.rpn`; `supabase/migrations/00036_fmea_risk_engine.sql` functions `fn_compute_fmea_risk_for_asset`, `fn_refresh_fmea_risk_score_for_asset`, `fn_classify_risk_level`; `supabase/functions/calculate-equipment-scores/index.ts`.

**Criteria / Inputs Used:**
Severity means clinical impact. Occurrence means likelihood/frequency of failure. Detectability means weakness of control/detection before harm or service failure.

**Where Each Input Comes From:**
Severity is computed from `equipment_categories.criticality_level`, `equipment_assets.condition`, and department name/code patterns. Occurrence is computed from `maintenance_events`, completed corrective `work_orders`, equipment age, condition, and active `recommendation_flags.recurring_failure`. Detectability is computed from `pm_schedules`, `pm_plans`, `pm_compliance_metrics`, `calibration_records`, `calibration_requests`, `maintenance_events`, and `pm_completions`. Manual override inputs are user-entered through `fn_set_fmea_risk_manual_override`. Seed rows exist in `supabase/seed/10_analytics_data.sql`.

**Why These Criteria Are Used:**
Severity captures patient/service impact. Occurrence captures repeated breakdown behavior. Detectability captures how well PM, calibration, alarms, inspections, and recent controls reduce the chance that a failure reaches clinical service.

**Weights / Thresholds / Classification Rules:**
There are no weights because RPN is multiplicative. Risk levels: low <80, medium >=80, high >=200, critical >=500. S/O/D are constrained to 1-10.

**Evidence from Code:**
`computeRPN` multiplies S/O/D and validates 1-10. `equipment_risk_scores` stores generated `rpn` and generated `risk_level`. `fn_compute_fmea_risk_for_asset` builds an explanation JSON with severity, occurrence, detectability, RPN, and risk_level.

**Defense Explanation:**
“We use RPN as a biomedical FMEA score. Severity tells us how dangerous the failure is, occurrence tells us how often it happens, and detectability tells us whether our controls catch it early. Multiplying the three values gives priority to equipment where all three risks are high. The system then classifies the number into low, medium, high, or critical bands.”

**Concerns / Gaps:**
The FMEA factor rules are hardcoded in SQL. They are mostly reasonable and partly explained by code comments, but the exact department keyword mapping and score floors should be defended in the thesis.

### Risk Classification

**Purpose:**
Risk classification turns numeric RPN into dashboard labels for quick triage.

**Formula / Logic:**
`critical` when RPN >=500; `high` when >=200; `medium` when >=80; otherwise `low`.

**Implementation Location:**
`src/utils/analytics/formulas.ts` `classifyRiskLevel`; `supabase/migrations/00010_analytics_tables.sql` generated `risk_level`; `supabase/migrations/00036_fmea_risk_engine.sql` `fn_classify_risk_level`; Edge Function mirror.

**Criteria / Inputs Used:**
RPN only.

**Where Each Input Comes From:**
RPN is either generated from stored S/O/D or computed by FMEA engine.

**Why These Criteria Are Used:**
The BME Head needs a simple action band instead of interpreting a 1-1000 score each time.

**Weights / Thresholds / Classification Rules:**
500, 200, and 80 are hardcoded thresholds.

**Evidence from Code:**
The same threshold numbers appear in TypeScript, SQL generated column, SQL function, and Edge Function.

**Defense Explanation:**
“The RPN band converts the FMEA score into an understandable action label. Critical and high assets are reviewed first. Medium assets are monitored and planned. Low assets remain normal risk unless other workflow evidence changes.”

**Concerns / Gaps:**
Thresholds are hardcoded; repository does not cite a standard or advisor-approved source for 80/200/500.

### FMEA Severity, Occurrence, and Detectability Assignment

**Purpose:**
These rules remove dependence on manual scoring by deriving S/O/D from available biomedical operations data.

**Formula / Logic:**
Severity is the maximum of category criticality, condition severity, and department/service importance. Occurrence is based on 365-day corrective failures, age, condition, and recurring failure flag. Detectability starts at 2 and increases for poor condition, overdue PM, overdue/due calibration, failed/adjusted calibration, low PMC, missing PM plan, and no recent control record.

**Implementation Location:**
`supabase/migrations/00036_fmea_risk_engine.sql` function `fn_compute_fmea_risk_for_asset`; trigger function fixed in `00066_fix_equipment_asset_insert_triggers.sql`.

**Criteria / Inputs Used:**
Criticality, condition, department name/code, failure events, completed corrective work orders, age, recurring failure flags, PM overdue days, PMC, PM plan existence, calibration records/requests, last calibration result, and recent control records.

**Where Each Input Comes From:**
Equipment asset record, equipment category lookup, departments table, maintenance events, work orders, PM schedules/plans/completions, calibration records/requests, recommendation flags.

**Why These Criteria Are Used:**
High criticality and critical departments increase clinical consequence. Repeated failures and older equipment increase failure likelihood. Weak PM/calibration/control evidence makes failures harder to prevent or detect.

**Weights / Thresholds / Classification Rules:**
Category score: critical 9, high 8, medium 5, low 3, unknown 4. Condition severity: non_functional 7, needs_repair 6, under_maintenance 5. Department score: ICU/emergency/OR/neonatal/delivery/sterilization 8; lab/radiology 6; ward/OPD/pharmacy 4. Occurrence: >=6 failures 9, >=5 8, >=3 6, >=1 4, else 2, with age/condition/recurring-failure floors. Detectability penalties are +1/+2 as described above and capped at 10.

**Evidence from Code:**
`fn_compute_fmea_risk_for_asset` appends driver strings such as category criticality, condition, department, failure count, age, overdue PM, calibration, PM compliance, PM plan, and recent control record.

**Defense Explanation:**
“The system does not guess the FMEA factors. It maps clinical criticality, recent failures, PM and calibration evidence, and current condition into the three FMEA dimensions. The explanation JSON stores the reason for each factor, so a BME Head can see why an asset became high risk.”

**Concerns / Gaps:**
The scoring thresholds are hardcoded in SQL. They are explainable but should be listed in the thesis methodology as locally selected biomedical engineering rules.

### MTBF

**Purpose:**
MTBF estimates how long equipment operates between failures.

**Formula / Logic:**
`MTBF = total_operational_hours / failure_count`. SQL computes period hours for the rolling period, subtracts summed downtime, and divides by failures.

**Implementation Location:**
`src/utils/analytics/formulas.ts` `computeMTBF`; `supabase/migrations/00011_views_and_functions.sql` `fn_compute_mtbf`; fixed in `00020_fix_mtbf_date_extract.sql`; materialized by `_recompute_asset_metrics` in `00034_reliability_metrics_dedup.sql`; Edge Function mirror.

**Criteria / Inputs Used:**
Observation period, downtime hours, failure count.

**Where Each Input Comes From:**
Failure count comes from `maintenance_events.failure_date`. Downtime comes from `downtime_logs.duration_hours`, derived from `maintenance_events.downtime_start/end` by trigger in `00061_reliability_evidence.sql`. Period defaults to rolling 365 days in `_recompute_asset_metrics`.

**Why These Criteria Are Used:**
MTBF indicates reliability. A low MTBF means frequent breakdowns and greater risk to clinical service continuity.

**Weights / Thresholds / Classification Rules:**
No weights. Returns null when failure_count is zero. SQL returns 0 if operational hours are <=0.

**Evidence from Code:**
`fn_compute_mtbf` counts failures between period dates, sums downtime, sets operational hours to period hours minus downtime, then divides by failure_count.

**Defense Explanation:**
“MTBF shows the average operating time between failures. If a ventilator fails repeatedly in the same year, its MTBF drops and it becomes a reliability concern. The system uses maintenance event and downtime evidence, so the metric improves as more operational history is captured.”

**Concerns / Gaps:**
Menelik thesis extraction notes say MTBF/MTTR/availability may be immature when imported maintenance events and downtime are limited. MTBF is snapshot-based and depends on recompute.

### MTTR

**Purpose:**
MTTR estimates how long repairs take on average.

**Formula / Logic:**
`MTTR = total_repair_hours / repair_count`.

**Implementation Location:**
`src/utils/analytics/formulas.ts` `computeMTTR`; `supabase/migrations/00011_views_and_functions.sql` `fn_compute_mttr`; `_recompute_asset_metrics` in `00034`; Edge Function mirror.

**Criteria / Inputs Used:**
Repair duration and number of completed repairs.

**Where Each Input Comes From:**
`maintenance_events.repair_duration_hours` and `maintenance_events.completion_date`. Completed work orders are backfilled/upserted into maintenance_events by migration `00069` and application workflows.

**Why These Criteria Are Used:**
MTTR measures maintainability and repair response. High MTTR suggests difficult repairs, parts delays, vendor dependence, or staffing constraints.

**Weights / Thresholds / Classification Rules:**
No weights. Returns null when no repair duration evidence exists.

**Evidence from Code:**
`fn_compute_mttr` sums repair_duration_hours and counts rows with completion_date in the period.

**Defense Explanation:**
“MTTR tells us how quickly the biomedical team restores equipment after failure. If MTTR is high, the equipment causes longer service interruption even if failures are not frequent. It helps identify repair delays, spare-part problems, and vendor-dependent equipment.”

**Concerns / Gaps:**
Requires complete repair duration evidence. Missing maintenance_events rows produce null values.

### Availability

**Purpose:**
Availability estimates whether equipment is ready for service based on reliability and repair time.

**Formula / Logic:**
`Availability = MTBF / (MTBF + MTTR)`.

**Implementation Location:**
`src/utils/analytics/formulas.ts` `computeAvailability`; `supabase/migrations/00011_views_and_functions.sql` `fn_compute_availability`; `_recompute_asset_metrics`; Edge Function mirror.

**Criteria / Inputs Used:**
MTBF and MTTR.

**Where Each Input Comes From:**
Computed from maintenance_events and downtime_logs; stored in `equipment_reliability_metrics.availability_ratio`.

**Why These Criteria Are Used:**
Biomedical equipment can only support care when it is both reliable and repairable. Availability combines failure frequency and repair duration.

**Weights / Thresholds / Classification Rules:**
No weights. Recommendation utility flags low availability below 0.95, critical below 0.90.

**Evidence from Code:**
`computeAvailability` and SQL `fn_compute_availability` both divide MTBF by MTBF plus MTTR and return null when inputs are invalid.

**Defense Explanation:**
“Availability summarizes uptime readiness. It is high when failures are rare and repairs are short. It is useful for identifying equipment that technically exists in inventory but is not consistently available for clinical service.”

**Concerns / Gaps:**
Snapshot-based. The reliability evidence pipeline exists, but new operational events require recompute or workflow-triggered refresh to update stored availability.

### Preventive Maintenance Compliance (PMC)

**Purpose:**
PMC measures whether scheduled PM tasks are completed.

**Formula / Logic:**
`PMC = completed scheduled PM tasks / total scheduled PM tasks x 100`.

**Implementation Location:**
`src/utils/analytics/formulas.ts` `computePMC`; `supabase/migrations/00011_views_and_functions.sql` `fn_compute_pmc`; generated column `pm_compliance_metrics.pmc_percentage`; `_recompute_asset_metrics`; PM UI/services.

**Criteria / Inputs Used:**
Scheduled PM count and completed PM count.

**Where Each Input Comes From:**
`pm_schedules.status`, `pm_schedules.scheduled_date`, optionally `pm_completions`. Stored asset-level rows in `pm_compliance_metrics`.

**Why These Criteria Are Used:**
PM compliance indicates whether the hospital is performing preventive control before failures occur.

**Weights / Thresholds / Classification Rules:**
No weights. PM semantics define compliance threshold 80. Recommendation utility flags PMC <70 and high if <50. SQL generated column returns 0 when no schedules exist, while TypeScript `computePMC` and SQL `fn_compute_pmc` return null for no scheduled count.

**Evidence from Code:**
`pm_compliance_metrics.pmc_percentage` is generated from scheduled/completed counts. `_recompute_asset_metrics` updates PM rows for a 365-day rolling period.

**Defense Explanation:**
“PMC shows schedule discipline. If PM tasks are planned but not completed, equipment risk increases because failures may not be detected early. We use PMC to explain control quality and to prioritize overdue preventive maintenance.”

**Concerns / Gaps:**
Null versus zero behavior differs by implementation. Thesis should explain whether no schedule means “not applicable” or “0% compliance.”

### Min-Max Normalization and Weighted Composite Score

**Purpose:**
Normalization allows different criteria such as age, failures, availability, and cost to be combined on a common 0-1 scale.

**Formula / Logic:**
`normalized = (value - min) / (max - min)`. Inverse normalization is `1 - normalized`. Composite score is `sum(weight_j * normalized_j)`.

**Implementation Location:**
`src/utils/analytics/normalization.ts`; `src/utils/analytics/composite-scoring.ts`; SQL RPI `compute_replacement_priority_scores_all`; seeded `equipment_performance_scores`.

**Criteria / Inputs Used:**
Any numeric criteria used in a composite model.

**Where Each Input Comes From:**
For RPI, from equipment assets, reliability metrics, risk scores, maintenance events, and recommendation flags. For performance scores, only seeded values were found.

**Why These Criteria Are Used:**
Biomedical decision criteria have different units. Normalization prevents hours, counts, percentages, and costs from overpowering each other due to scale.

**Weights / Thresholds / Classification Rules:**
No variance defaults to 0.5 in callers. `validateWeights` checks sum near 1.0 but `computeWeightedScore` does not enforce it.

**Evidence from Code:**
`minMaxNormalize` returns null when max equals min. RPI SQL uses `ELSE 0.5` for no variance.

**Defense Explanation:**
“Before combining criteria, the system converts each one to a 0-1 scale. This allows cost, downtime, age, and risk to be compared fairly. Then the system applies documented weights to calculate the final index.”

**Concerns / Gaps:**
General `equipment_performance_scores` appears seeded and read-only in the app; no live recompute was found.

### Replacement Priority Index (RPI)

**Purpose:**
RPI helps the BME Head shortlist equipment for replacement review, procurement planning, or disposal evidence.

**Formula / Logic:**
RPI is the weighted sum of normalized age, failure count, inverse availability, maintenance burden/downtime, spare-part shortage, RPN, and maintenance cost.

**Implementation Location:**
`src/utils/analytics/replacement-index.ts`; `supabase/migrations/00023_replacement_scores_triage_pmc_fixes.sql` `compute_replacement_priority_scores_all`; view `v_replacement_decision`; UI in `src/app/(dashboard)/replacement/page.tsx` and Command Center replacement fetch.

**Criteria / Inputs Used:**
Age years, failure count, availability ratio, downtime hours, part shortage flags, RPN, maintenance service cost.

**Where Each Input Comes From:**
Age from `equipment_assets.installation_date` or purchase date. Failure/availability/downtime from `equipment_reliability_metrics`. RPN from `equipment_risk_scores`. Spare shortage from unacknowledged `recommendation_flags.flag_type='part_shortage'`. Cost from `maintenance_events.service_cost`.

**Why These Criteria Are Used:**
Replacement decisions depend on lifecycle age, reliability, service disruption, repair burden, parts support, clinical risk, and cost pressure.

**Weights / Thresholds / Classification Rules:**
Canonical weights: age 15%, failures 15%, availability 20%, maintenance burden 15%, spare parts 10%, risk 15%, cost 10%. Bands: strong >=0.70, review >=0.55, monitor <0.55.

**Evidence from Code:**
SQL uses `age_score*0.15 + failure_score*0.15 + avail_score*0.20 + burden_score*0.15 + spare_score*0.10 + risk_score*0.15 + cost_score*0.10`. TypeScript `DEFAULT_REPLACEMENT_WEIGHTS` matches.

**Defense Explanation:**
“RPI is not an automatic replacement approval. It ranks assets for review by combining age, reliability, availability, maintenance burden, spare support, risk, and cost. A high RPI means the BME Head should open evidence and decide whether to plan procurement, disposal, or continued monitoring.”

**Concerns / Gaps:**
`src/app/(dashboard)/replacement/page.tsx` displays failure weight 20% and availability weight 15%, but canonical SQL/TypeScript/score-registry use failure 15% and availability 20%. This is a clear UI documentation mismatch.

### Equipment Health Score

**Purpose:**
Health score summarizes asset condition for the Command Center.

**Formula / Logic:**
`health = availability*35 + (PMC/100)*25 + (1 - min(0.35, RPN/1000))*25 + (1 - conditionPenalty - flagPenalty)*15`, rounded and minimum 1.

**Implementation Location:**
SQL `refresh_decision_support_snapshots` in `00023`; fallback `computeFromOperationalData` in `src/services/decision-support.service.ts`; view `v_asset_health_summary`.

**Criteria / Inputs Used:**
Availability, PMC, RPN, equipment condition, active recommendation flags.

**Where Each Input Comes From:**
`equipment_reliability_metrics`, `pm_compliance_metrics`, `equipment_risk_scores`, `equipment_assets.condition`, `recommendation_flags`.

**Why These Criteria Are Used:**
Health score combines readiness, preventive control, risk, and current status into one operational indicator.

**Weights / Thresholds / Classification Rules:**
Availability 35, PM 25, risk control 25, condition/status 15. Defaults when missing: availability 0.92, PMC 80, RPN 120. Condition penalty: functional 0, needs_repair 0.15, else 0.30. Flag penalty: min 0.25, 0.05 per open flag.

**Evidence from Code:**
SQL `refresh_decision_support_snapshots` inserts `equipment_health_snapshots` with component fields and explanation JSON. Service fallback mirrors the same formula.

**Defense Explanation:**
“Equipment health combines four things: availability, preventive maintenance compliance, FMEA risk control, and current condition or open flags. It gives the BME Head a quick view of which assets are healthy and which assets need attention. Missing data uses conservative default values until real evidence is captured.”

**Concerns / Gaps:**
Defaults are hardcoded and should be explained. Snapshot freshness must be checked.

### Clinical Readiness Score

**Purpose:**
Clinical readiness shows whether each department has its essential equipment functional.

**Formula / Logic:**
`readiness = essential_functional / essential_total x 100`.

**Implementation Location:**
SQL `refresh_decision_support_snapshots`; view `v_department_readiness`; UI `CommandCenterInteractive.tsx`; viewer executive metrics.

**Criteria / Inputs Used:**
Essential assets are equipment in categories with criticality `high` or `critical`. Functional assets are those with `condition='functional'` and `status='active'`.

**Where Each Input Comes From:**
`equipment_assets`, `equipment_categories`, `departments`, `clinical_readiness_snapshots`.

**Why These Criteria Are Used:**
Hospital service readiness depends mainly on essential devices being functional, not just being listed in inventory.

**Weights / Thresholds / Classification Rules:**
No weights. Viewer risk uses readiness <80 as medium risk when no high-risk blocker exists.

**Evidence from Code:**
SQL counts high/critical category assets by department and sums functional active rows. UI displays `essential_functional ÷ essential_total x 100`.

**Defense Explanation:**
“Clinical readiness asks a simple question: among essential high and critical equipment, how many are functional today? This avoids overstating readiness by including non-essential assets. It supports department-level service continuity decisions.”

**Concerns / Gaps:**
Readiness is snapshot-based in SQL. Viewer pages may mix snapshot readiness with live supporting counts.

### Viewer Department Risk Classification

**Purpose:**
This classifies department risk for viewer/management dashboards.

**Formula / Logic:**
High if any essential asset is unavailable or any critical/high work order is open. Medium if readiness is below 80% or overdue PM plus overdue calibration is at least 3. Low otherwise. Unknown if readiness is null and no overdue signals exist.

**Implementation Location:**
`src/utils/viewer/readiness.ts`; used by Viewer Command Center and executive metrics.

**Criteria / Inputs Used:**
Readiness score, essential unavailable count, critical open work count, overdue PM count, overdue calibration count.

**Where Each Input Comes From:**
`v_department_readiness`, `v_open_work_orders`, `v_overdue_pm`, `v_calibration_due`.

**Why These Criteria Are Used:**
Management needs to know whether a department has immediate service risk, compliance pressure, or normal status.

**Weights / Thresholds / Classification Rules:**
High: unavailable essential >0 or criticalOpenWork >0. Medium: readiness <80 or overdue PM+calibration >=3. Low otherwise.

**Evidence from Code:**
`classifyDeptRisk` implements the exact rule and comments document it.

**Defense Explanation:**
“Department risk is rule-based rather than weighted. If essential equipment is down or high-priority work is open, the department is high risk. If readiness is below 80% or compliance backlog is building, it is medium risk.”

**Concerns / Gaps:**
80% and count 3 are hardcoded and need thesis justification.

### Legacy Triage Priority Queue

**Purpose:**
The triage queue ranks assets requiring action in snapshot decision-support views.

**Formula / Logic:**
`priority_score = flag severity score + min(40,RPN/15) + max(0,(80-PMC)/2) + max(0,20-replacement_rank)`.

**Implementation Location:**
SQL `refresh_decision_support_snapshots`; service fallback `computeFromOperationalData` in `src/services/decision-support.service.ts`.

**Criteria / Inputs Used:**
Unacknowledged flags, RPN, PM compliance, replacement rank.

**Where Each Input Comes From:**
`recommendation_flags`, `equipment_risk_scores`, `pm_compliance_metrics`, `replacement_priority_scores`.

**Why These Criteria Are Used:**
The queue prioritizes assets with urgent flags, high risk, weak PM compliance, and strong replacement evidence.

**Weights / Thresholds / Classification Rules:**
Flag critical 45, high 25, medium 10, else 4. RPN cap 40. PMC target 80. Replacement rank contributes up to 19 points.

**Evidence from Code:**
SQL `triage` CTE builds `priority_score` and recommendation text based on top flag and RPN.

**Defense Explanation:**
“The triage queue combines current alerts, risk score, PM weakness, and replacement rank. It is designed to sort action items, not to make final decisions. The BME Head still reviews the evidence before acting.”

**Concerns / Gaps:**
This is a snapshot path and differs from the live Command Center critical action scoring. The thesis should distinguish the two.

### Live Critical Action Score

**Purpose:**
This ranks the top cross-module action cards on the BME Head Command Center.

**Formula / Logic:**
`critical_action_score = category_base_weight + item_priority_score`.

**Implementation Location:**
`src/utils/analytics/critical-action-bands.ts`; `src/app/(dashboard)/command/_lib/command-center-data.ts` `buildCriticalActions`.

**Criteria / Inputs Used:**
Category type and module-specific item score from corrective work, needs request, calibration, PM, stock, risk watch, installation, replacement, procurement, training.

**Where Each Input Comes From:**
Live queries to work orders, maintenance requests, PM schedules, calibration records, spare parts, replacement view, procurement requests, training requests, risk scores, recommendation flags.

**Why These Criteria Are Used:**
The BME Head needs cross-module ordering. Corrective work and clinical safety blockers should outrank long-term planning.

**Weights / Thresholds / Classification Rules:**
Category bases: corrective 100, needs_request 90, calibration 85, PM 75, stock 70, risk_watch 65, installation 60, replacement 55, procurement 45, training 35. Urgency bands: critical >=180, high >=150, medium >=100, else low.

**Evidence from Code:**
`CRITICAL_ACTION_CATEGORY_WEIGHTS` and `CRITICAL_ACTION_URGENCY_BANDS` are documented in `critical-action-bands.ts`; `buildCriticalActions` adds base and item score and sorts descending.

**Defense Explanation:**
“Critical action score is a Command Center ranking rule. It gives higher base priority to actions that can immediately block patient care, such as corrective work and calibration. The item score then adjusts the rank based on how urgent that specific record is.”

**Concerns / Gaps:**
Weights are hardcoded but code comments provide rationale. There is no database-managed weighting profile for live action weights.

### Corrective Maintenance Triage Score

**Purpose:**
Ranks active corrective work orders and maintenance requests.

**Formula / Logic:**
`score = urgencyScore + statusScore + min(20, daysOpen*0.5)`.

**Implementation Location:**
`fetchCorrectiveMaintenanceTriage` in `command-center-data.ts`.

**Criteria / Inputs Used:**
Priority/urgency, workflow status, days open.

**Where Each Input Comes From:**
`work_orders.priority/status/created_at` and `maintenance_requests.urgency/status/created_at`.

**Why These Criteria Are Used:**
Critical work, active/in-progress jobs, and aging jobs need higher attention.

**Weights / Thresholds / Classification Rules:**
Urgency: critical 40, high 30, medium 20, default 10. Work-order status: in_progress 20, assigned 15, on_hold 10, open 5. Request status: in_progress 20, assigned 15, approved 10, pending 5. Age cap 20.

**Evidence from Code:**
The helper functions `urgencyScore`, `woStatusScore`, and `mrStatusScore` define the numbers.

**Defense Explanation:**
“Corrective maintenance triage prioritizes urgent, active, and aging repair work. A critical open work order should appear ahead of routine work. The age component prevents older unresolved jobs from being forgotten.”

**Concerns / Gaps:**
Weights are hardcoded. The age cap and 0.5/day multiplier need thesis explanation if challenged.

### Needs-Request Triage Score

**Purpose:**
Finds nonfunctional or problematic equipment with no active corrective request.

**Formula / Logic:**
`score = 90 + conditionScore + departmentCriticalityScore + riskScore + healthPenalty`.

**Implementation Location:**
`fetchNeedsRequestTriage` in `command-center-data.ts`.

**Criteria / Inputs Used:**
Condition, category criticality, risk level, health score, absence of active corrective work.

**Where Each Input Comes From:**
`equipment_assets`, `equipment_categories`, `equipment_risk_scores`, `v_asset_health_summary`, active corrective work order/request checks.

**Why These Criteria Are Used:**
Equipment that is down but has no corrective workflow is a process gap. Clinical criticality and poor health increase urgency.

**Weights / Thresholds / Classification Rules:**
Condition: non_functional 45, needs_repair 35, under_maintenance 25. Criticality: critical 25, high 18, else 8. Risk: critical 20, high 12. Health penalty: max 10 based on health below 70.

**Evidence from Code:**
`fetchNeedsRequestTriage` filters condition problem assets and excludes assets with active corrective work.

**Defense Explanation:**
“This rule detects equipment that needs biomedical action but does not yet have an open repair request. It prevents broken equipment from sitting outside the maintenance workflow. It is a process-control safeguard for the BME Head.”

**Concerns / Gaps:**
Hardcoded 90 base makes these items very prominent. This should be explained as intentional because missing corrective request is an operational gap.

### Proactive Risk Watch Score

**Purpose:**
Shows high-risk signals for assets that do not yet have corrective work.

**Formula / Logic:**
Sum flag severity scores and risk-level score.

**Implementation Location:**
`fetchProactiveRiskWatch` in `command-center-data.ts`.

**Criteria / Inputs Used:**
Unacknowledged flags of selected types and high/critical risk scores.

**Where Each Input Comes From:**
`recommendation_flags`, `equipment_risk_scores`, `equipment_assets`.

**Why These Criteria Are Used:**
This catches assets that are risky but not yet under active repair.

**Weights / Thresholds / Classification Rules:**
Flag severity: critical 30, high 20, default 10. Risk level: critical 40, high 25.

**Evidence from Code:**
Functions `flagSeverityScore` and `riskLevelScore` implement values.

**Defense Explanation:**
“Risk watch is an early warning list. It shows assets with high risk evidence or active warning flags before they become corrective work. This supports preventive action and planning.”

**Concerns / Gaps:**
The flag list is fixed to urgent_maintenance, recurring_failure, high_risk, low_availability, monitor_closely.

### PM Triage Priority

**Purpose:**
Ranks overdue preventive maintenance tasks.

**Formula / Logic:**
`score = 50 + min(50, daysOverdue * 0.3)`.

**Implementation Location:**
`fetchPMTriage` in `command-center-data.ts`; documented in `score-registry.ts`; `v_overdue_pm` in SQL.

**Criteria / Inputs Used:**
Scheduled date and days overdue.

**Where Each Input Comes From:**
`v_overdue_pm`, based on `pm_schedules`.

**Why These Criteria Are Used:**
Older overdue PM creates greater compliance and preventive-control risk.

**Weights / Thresholds / Classification Rules:**
Base 50, overdue age cap 50, 0.3 points/day.

**Evidence from Code:**
`fetchPMTriage` computes days since scheduled date and applies the formula.

**Defense Explanation:**
“Overdue PM is prioritized by age. A task that has been overdue longer has a higher risk of missed preventive control. The score keeps overdue PM visible in the Command Center.”

**Concerns / Gaps:**
Current formula does not include asset criticality, even though score registry notes this limitation.

### Calibration Risk Priority

**Purpose:**
Ranks calibration due or overdue items.

**Formula / Logic:**
`score = 50 + min(50, daysOverdue * 0.5)`.

**Implementation Location:**
`fetchCalibrationTriage` in `command-center-data.ts`; `v_calibration_due`; `score-registry.ts`.

**Criteria / Inputs Used:**
Next due date and days overdue.

**Where Each Input Comes From:**
`calibration_records.next_due_date` through `v_calibration_due`.

**Why These Criteria Are Used:**
Calibration affects measurement accuracy and patient safety. Overdue calibration increases safety and quality risk.

**Weights / Thresholds / Classification Rules:**
Base 50, overdue age cap 50, 0.5 points/day. View includes next_due_date within 90 days; Command Center fetch filters to 30 days.

**Evidence from Code:**
`fetchCalibrationTriage` reads `v_calibration_due` with next_due_date <= 30 days and computes score.

**Defense Explanation:**
“Calibration priority ranks devices by how close or overdue their calibration is. Biomedical equipment that measures or controls clinical parameters must be verified regularly. Overdue calibration is treated as a safety and quality signal.”

**Concerns / Gaps:**
Current Command Center score uses due date only; it does not include device criticality or previous failed calibration in the item score.

### Stock Blocker Priority

**Purpose:**
Ranks spare part shortages that block maintenance or create stockout risk.

**Formula / Logic:**
If linked to active work, score 100. Else if current stock is zero, score 90. Else score `60 + ((reorder_level - current_stock) / reorder_level) * 30`.

**Implementation Location:**
`fetchStockBlockers` in `command-center-data.ts`; documented in `score-registry.ts`.

**Criteria / Inputs Used:**
Current stock, reorder level, active work order part linkage.

**Where Each Input Comes From:**
`spare_parts`, `work_order_parts_needed`, `maintenance_parts_used`, `work_orders`.

**Why These Criteria Are Used:**
Parts shortages can directly delay repair and keep clinical equipment unavailable.

**Weights / Thresholds / Classification Rules:**
100 confirmed maintenance blocker, 90 stockout, 60-90 low-stock risk.

**Evidence from Code:**
The function prioritizes declared parts needed for open work orders over historical parts-used linkage.

**Defense Explanation:**
“Stock blocker priority separates a true repair blocker from a general low-stock warning. If a technician declared a part needed for an open work order, the priority is highest. This helps the BME Head and store officer coordinate procurement quickly.”

**Concerns / Gaps:**
Depends on users entering `work_order_parts_needed`; no fuzzy inference from text.

### Installation, Procurement, and Training Triage

**Purpose:**
These scores keep non-maintenance operational bottlenecks visible.

**Formula / Logic:**
Installation: `40 + min(40, daysPending*0.5)`. Training: `35 + min(35, daysPending*0.3)`. Procurement uses expected delivery delay: delayed `60 + min(120, daysPastDue*2) + priorityBoost`; missing expected date fallback `25 + min(45, ageDays*0.5) + priorityBoost`.

**Implementation Location:**
`fetchInstallationTriage`, `fetchTrainingTriage`, `fetchProcurementTriage` in `command-center-data.ts`; `scoreProcurementDelay` in `src/utils/decision-support/procurement-delay.ts`.

**Criteria / Inputs Used:**
Installation date, commissioning date, training status/created_at, procurement status/priority/created_at/expected_delivery_date.

**Where Each Input Comes From:**
`installation_records`, `training_requests`, `procurement_requests`.

**Why These Criteria Are Used:**
Equipment may be unavailable because it is not commissioned, users are not trained, or required procurement is delayed.

**Weights / Thresholds / Classification Rules:**
Procurement priority boost: critical +40, high +20, medium 0, low -10. Procurement bands: critical >=150, high >=100, medium >=60, else low.

**Evidence from Code:**
`procurement-delay.ts` explicitly explains why expected_delivery_date replaced age-only scoring.

**Defense Explanation:**
“The Command Center includes workflow delays beyond repairs. Installation, procurement, and training delays can prevent equipment from being usable. These scores make non-technical bottlenecks visible to the BME Head.”

**Concerns / Gaps:**
Installation and training weights are hardcoded with little domain explanation. Procurement has stronger inline justification.

### Technician Workload / Capacity

**Purpose:**
Shows whether technicians are available, busy, or overloaded.

**Formula / Logic:**
Overloaded if open assignments >=6 or any critical task. Busy if open assignments >=3. Otherwise available.

**Implementation Location:**
`src/services/metrics/workload.service.ts`; Command Center wrapper `fetchTechnicianWorkload`.

**Criteria / Inputs Used:**
Open assignments, in-progress tasks, critical tasks, estimated hours.

**Where Each Input Comes From:**
`profiles`, `user_roles`, `roles`, and open `work_orders`.

**Why These Criteria Are Used:**
Workload affects response time and ability to clear critical equipment issues.

**Weights / Thresholds / Classification Rules:**
Overloaded threshold 6 open assignments or any critical task. Busy threshold 3 open assignments. Estimated hours are summed but do not determine status.

**Evidence from Code:**
`WORKLOAD_STATUS_THRESHOLDS` defines `overloaded: 6`, `busy: 3`; `classifyWorkloadStatus` applies them.

**Defense Explanation:**
“Workload status helps the BME Head balance assignments. A technician with many open tasks or a critical task is considered overloaded. This supports realistic scheduling and escalation.”

**Concerns / Gaps:**
Estimated hours are displayed but not used in status classification. The snapshot table has `capacity_hours=8` and `backlog_delta`, but the current workload UI uses live threshold logic.

### Recommendation Flags

**Purpose:**
Recommendation flags convert analytics signals into actionable alerts.

**Formula / Logic:**
Rule thresholds: non-functional days >30, failures >=4, availability <0.95, RPN >=200, RPI rank <=5, overdue PM >0, PMC <70, calibration overdue >0, parts shortage exists, warranty/contract within 90 days.

**Implementation Location:**
`src/utils/analytics/recommendations.ts`; `recommendation_flags` table.

**Criteria / Inputs Used:**
Asset status duration, failure count, availability, RPN, RPI rank, PM compliance, overdue PM/calibration days, spare shortages, warranty/contract remaining days.

**Where Each Input Comes From:**
Inputs are expected from equipment, maintenance, PM, calibration, stock, replacement score, warranty/contract fields. Seeded flags are inserted in `supabase/seed/10_analytics_data.sql`.

**Why These Criteria Are Used:**
Flags translate metric problems into actions: repair urgently, monitor, prioritize PM, calibrate, replace, resolve parts, or renew contracts.

**Weights / Thresholds / Classification Rules:**
Availability high below 0.95 and critical below 0.90. RPN high >=200 and critical >=500. PM compliance medium <70 and high <50. Warranty/contract medium <=90 and high <=30. RPI rank medium <=5 and high <=2.

**Evidence from Code:**
`generateRecommendations` contains all rules, but repository search found no call to `generateRecommendations(` outside its own file.

**Defense Explanation:**
“Recommendation flags are rule-based alerts. They identify known management actions such as urgent repair, recurring failure review, PM prioritization, calibration, replacement planning, and contract renewal. The current repository stores and displays flags, but the generator utility itself is not clearly wired to a live scheduler.”

**Concerns / Gaps:**
No caller found for `generateRecommendations`. Existing flags may be seeded, manually inserted, or generated by another path not found in repository.

### Escalation Rules and Repeat Repair Flags

**Purpose:**
Escalation and repeat repair structures are intended to route high-priority issues.

**Formula / Logic:**
Seeded escalation rules use JSON trigger configs: critical ICU overdue work order with min_days_overdue 1 and priority critical; repeated unresolved work order threshold 3 within 60 days; calibration overdue on high/critical equipment with min_days_overdue 7. Repeat repair table has `failure_count_window` and default `window_days=180`.

**Implementation Location:**
`supabase/migrations/00013_memis2_decision_support_and_guardrails.sql`; `supabase/migrations/00032_audit_drop_unused_tables.sql` notes repeat_repair_flags superseded by recommendation_flags.recurring_failure.

**Criteria / Inputs Used:**
Department, overdue days, priority, repeat count, criticality.

**Where Each Input Comes From:**
Escalation rules table and operational records, but no evaluator function was found.

**Why These Criteria Are Used:**
Escalation ensures management attention when critical clinical equipment or repeated unresolved problems exceed acceptable limits.

**Weights / Thresholds / Classification Rules:**
Rule-specific thresholds: 1 day for critical ICU overdue, 3 repeats/60 days, 7 days calibration overdue for high/critical assets.

**Evidence from Code:**
Only table creation and seeded rules were found. No active rule evaluator was found in repository search.

**Defense Explanation:**
“The schema includes escalation rule definitions for critical overdue work, repeated unresolved work, and calibration overdue on essential equipment. These are governance structures, but the current repository does not show a complete automatic escalation engine.”

**Concerns / Gaps:**
High gap if thesis claims automatic escalation execution. The rule table exists, but evaluator not found.

## 5. Data Lineage Map

| Raw Data Table / Field | Used In Which Formula | Transformation | Final Command Center Output |
| ---------------------- | --------------------- | -------------- | --------------------------- |
| `equipment_assets.condition` | FMEA severity/occurrence, health, readiness, needs-request triage | Mapped to penalties/scores; functional count | Risk score, health score, readiness, needs-request action |
| `equipment_assets.status` | Readiness, active asset filters | Active assets included; deleted excluded | Command Center counts and readiness |
| `equipment_assets.installation_date / purchase_date` | RPI age, FMEA occurrence age | Age years from date | Replacement score, occurrence floor |
| `equipment_assets.warranty_expiry / service_contract_expiry` | Warranty/contract recommendation utility | Days remaining threshold | Potential recommendation flags; not wired |
| `equipment_categories.criticality_level` | FMEA severity, readiness, needs-request triage, viewer risk | Criticality score and essential asset filter | RPN, readiness %, action priority |
| `departments.name / code` | FMEA severity | Keyword mapping to department severity | RPN severity |
| `maintenance_events.failure_date` | MTBF, RPI failure count/cost, FMEA occurrence | Count failures in rolling period | Reliability cards, RPI, risk |
| `maintenance_events.repair_duration_hours / completion_date` | MTTR | Sum duration and count repairs | MTTR, availability |
| `maintenance_events.downtime_start / downtime_end` | MTBF/availability | Trigger creates downtime_logs duration | Reliability metrics |
| `downtime_logs.duration_hours` | MTBF, RPI maintenance burden | Sum downtime, subtract from period | MTBF, RPI burden |
| `maintenance_events.service_cost` | RPI cost | Sum service cost, normalize | RPI cost score |
| `work_orders.status / priority / created_at` | Corrective triage, workload, viewer risk | Status/urgency/age scoring | Critical actions, workload status |
| `maintenance_requests.status / urgency / created_at` | Corrective triage | Status/urgency/age scoring | Critical actions |
| `pm_schedules.status / scheduled_date` | PMC, PM triage, FMEA detectability, viewer risk | Completed/scheduled ratio; days overdue | PMC, PM action, risk detectability |
| `pm_plans.is_active` | FMEA detectability, PM semantics | Missing active plan penalty for critical/high assets | RPN detectability |
| `pm_completions.completion_date` | FMEA recent control | Recent PM completion evidence | RPN detectability |
| `calibration_records.next_due_date / result` | Calibration triage, FMEA detectability, viewer risk | Due/overdue days, failed/adjusted penalty | Calibration actions, RPN detectability |
| `calibration_requests.asset_id` | FMEA detectability | Determines calibration relevance | RPN detectability |
| `spare_parts.current_stock / reorder_level` | Stock blocker priority | Stockout/low-stock/deficit scoring | Stock critical action |
| `work_order_parts_needed.spare_part_id` | Stock blocker priority | Links shortage to active work | Maintenance blocker action |
| `recommendation_flags.flag_type / severity / is_acknowledged` | Health, triage queue, risk watch, RPI spare score | Count flags, score severity, shortage count | Health penalty, triage, RPI |
| `replacement_priority_scores.rank / replacement_priority_index` | Critical actions, triage queue, replacement page | Filter candidates and convert to 0-100 display | Replacement action and candidate cards |
| `procurement_requests.expected_delivery_date / priority / status / created_at` | Procurement delay priority | Delay days plus priority boost | Procurement critical action |
| `installation_records.installation_date / commissioning_date` | Installation triage | Pending days scoring | Installation action |
| `training_requests.created_at / status` | Training triage | Pending days scoring | Training action |
| `profiles / user_roles / roles` | Workload capacity | Identify active technicians | Workload table |

## 6. Criteria Source Analysis

| Criterion | Meaning | Source Table / Code Location | User-entered, computed, seeded, or hardcoded? | Why It Is Used |
| --------- | ------- | ---------------------------- | --------------------------------------------- | -------------- |
| severity | Clinical impact factor | `equipment_risk_scores.severity`; `fn_compute_fmea_risk_for_asset`; `risk_scales` | Computed or manual override; seeded lookup labels | Captures patient/service consequence |
| occurrence | Failure likelihood factor | `equipment_risk_scores.occurrence`; FMEA SQL | Computed or manual override | Captures repeated failure probability |
| detectability | Control/detection weakness factor | `equipment_risk_scores.detectability`; FMEA SQL | Computed or manual override | Captures PM/calibration/control weakness |
| criticality | Equipment category importance | `equipment_categories.criticality_level` | Lookup/reference, seeded/user maintained | Identifies essential clinical equipment |
| failure count | Count of failures | `maintenance_events.failure_date`, completed corrective WOs | Computed from live events or seeded events | Reliability and occurrence signal |
| repair count | Completed repairs with duration | `maintenance_events.completion_date`, `repair_duration_hours` | Computed from live events | MTTR denominator |
| operational time | Period minus downtime | SQL `fn_compute_mtbf` | Computed | MTBF numerator |
| maintenance time | Repair duration sum | `maintenance_events.repair_duration_hours` | User/workflow-entered then computed | MTTR numerator |
| downtime | Time asset unavailable | `downtime_logs`, generated from maintenance event downtime timestamps | Computed/materialized from user-entered timestamps | Availability and burden |
| PM scheduled count | PM tasks planned | `pm_schedules` | User/workflow generated | PMC denominator |
| PM completed count | PM tasks completed | `pm_schedules.status='completed'`, `pm_completions` | User/workflow-entered | PMC numerator |
| availability | Uptime readiness ratio | `equipment_reliability_metrics.availability_ratio` | Computed snapshot; seeded demo rows | Health/RPI/reliability evidence |
| age | Years since installation/purchase | `equipment_assets.installation_date`, `purchase_date` | User-entered field computed into years | Lifecycle replacement pressure |
| maintenance burden | Downtime/repair burden | `equipment_reliability_metrics.total_downtime_hours`; `maintenance_events.service_cost` | Computed from events | Replacement pressure |
| spare-part availability | Supportability/stock pressure | `recommendation_flags.part_shortage`, `spare_parts`, `work_order_parts_needed` | Mixed live and seeded | Repair feasibility and replacement pressure |
| maintenance cost | Service cost | `maintenance_events.service_cost` | User-entered/event evidence | Lifecycle cost pressure |
| open flags | Active recommendation flags | `recommendation_flags.is_acknowledged=false` | Seeded or live inserted | Health penalty and triage |
| overdue tasks | Late PM/calibration/work | `v_overdue_pm`, `v_calibration_due`, work order dates | Computed live views | Compliance urgency |
| technician workload | Current assignments | `work_orders.assigned_to/status/priority`, technician profiles | Computed live | Capacity planning |
| department/service criticality | Clinical service sensitivity | Department names/codes in SQL FMEA mapping | Hardcoded keyword mapping | Higher impact areas need priority |
| asset status | Active/deleted lifecycle state | `equipment_assets.status`, `deleted_at` | User-entered/admin state | Scope and readiness |
| functional state | Whether device works | `equipment_assets.condition` | User-entered/workflow-updated | Readiness and health |
| calibration due date | Next calibration deadline | `calibration_records.next_due_date` | User-entered/computed by calibration workflow | Accuracy/safety compliance |
| warranty expiry | Vendor coverage end | `equipment_assets.warranty_expiry` | User-entered; recommendation utility only | Renewal planning |
| service contract expiry | Service coverage end | `equipment_assets.service_contract_expiry` | User-entered; recommendation utility only | Vendor support planning |

## 7. Weights and Thresholds Audit

| Score / Formula | Weight or Threshold | Value | Where Defined | Justification Found? | Recommendation |
| --------------- | ------------------- | ----- | ------------- | -------------------- | -------------- |
| RPN | Severity/occurrence/detectability range | 1-10 | TS/SQL checks; `risk_scales` | Clearly justified in code/docs | Include lookup table in thesis appendix |
| RPN band | medium/high/critical | 80/200/500 | formulas.ts, SQL generated, FMEA function | Hardcoded but reasonable | Cite FMEA band rationale |
| FMEA severity | category criticality mapping | critical 9, high 8, medium 5, low 3 | `fn_compute_fmea_risk_for_asset` | Likely based on domain reasoning | Explain local mapping |
| FMEA severity | condition mapping | non_functional 7, needs_repair 6, under_maintenance 5 | FMEA SQL | Likely based on domain reasoning | Explain in defense |
| FMEA severity | department keywords | ICU/ED/OR/etc 8; lab/radiology 6; ward/OPD/pharmacy 4 | FMEA SQL | Hardcoded and needs explanation | Add thesis table |
| FMEA occurrence | failure bands | >=6=9, >=5=8, >=3=6, >=1=4, else 2 | FMEA SQL | Hardcoded and needs explanation | Add rationale |
| FMEA occurrence | age floors | >=12 ->6, >=10 ->5, >=7 ->4 | FMEA SQL | Hardcoded and needs explanation | Justify lifecycle assumptions |
| FMEA detectability | PM/calibration penalties | +1/+2 values | FMEA SQL | Likely based on domain reasoning | Explain as control weakness penalties |
| Availability | low/critical recommendation | <0.95 / <0.90 | `recommendations.ts` | Hardcoded but reasonable | Explain as operational target, if used |
| PMC | PM compliance target | 80 | `pm/semantics.ts`, triage queue formula | Hardcoded but reasonable | State PM target in thesis |
| PMC recommendation | medium/high | <70 / <50 | `recommendations.ts` | Hardcoded and needs explanation | Only claim if generator is wired |
| RPI weights | age/failure/availability/burden/spare/risk/cost | 15/15/20/15/10/15/10 | `replacement-index.ts`, SQL, score-registry | Clearly justified in code/docs | Keep; fix UI mismatch |
| RPI bands | monitor/review/strong | <0.55 / >=0.55 / >=0.70 | `replacement-thresholds.ts` | Clearly says prototype | Defend as prototype thresholds |
| Replacement page UI | displayed weights | failure 20%, availability 15% | `replacement/page.tsx` | Unclear/mismatch | Fix documentation/UI after audit |
| Equipment health | component weights | availability 35, PM 25, risk 25, status 15 | SQL/service/score-registry | Clearly documented in registry | Include in thesis |
| Equipment health defaults | missing values | availability .92, PMC 80, RPN 120 | SQL/service | Hardcoded and needs explanation | Explain as neutral baseline defaults |
| Health status penalties | condition/flags | 0/0.15/0.30; flags 0.05 max 0.25 | SQL/service | Hardcoded and needs explanation | Add method note |
| Readiness | essential filter | category high/critical only | SQL | Clearly justified in UI | Keep |
| Viewer dept risk | readiness medium threshold | <80 | `viewer/readiness.ts` | Hardcoded but reasonable | Explain management risk threshold |
| Viewer dept risk | overdue compliance threshold | >=3 PM+calibration | `viewer/readiness.ts` | Hardcoded and needs explanation | Add rationale |
| Critical actions | category bases | 100/90/85/75/70/65/60/55/45/35 | `critical-action-bands.ts` | Clearly justified in comments | Keep; include in thesis |
| Critical actions | urgency bands | 180/150/100 | `critical-action-bands.ts` | Clearly documented but hardcoded | Include in thesis |
| Corrective triage | urgency/status/age | 40/30/20/10; 20/15/10/5; age cap 20 | `command-center-data.ts` | Hardcoded and needs explanation | Add method note |
| Needs request | base and components | 90 + components | `command-center-data.ts` | Hardcoded and needs explanation | Explain missing request as process gap |
| PM triage | age formula | 50 + min(50, days*0.3) | `command-center-data.ts` | Hardcoded and needs explanation | Add rationale |
| Calibration triage | age formula | 50 + min(50, days*0.5) | `command-center-data.ts` | Hardcoded and needs explanation | Add rationale |
| Stock blocker | blocker scores | 100/90/60+ratio*30 | `command-center-data.ts` | Clearly documented in registry | Keep |
| Procurement delay | expected date scoring | base 60/20, cap 120, boosts 40/20/0/-10 | `procurement-delay.ts` | Clearly justified in comments | Keep |
| Workload | capacity thresholds | busy >=3, overloaded >=6 or any critical | `workload.service.ts` | Hardcoded but reasonable | Explain as operational prototype |
| Escalation rules | seeded configs | 1 day ICU critical; 3 repeats/60; calibration high/critical 7 days | `00013` | Hardcoded and needs explanation | Do not claim automatic execution unless evaluator added |

## 8. Live Data vs Seeded Data

The following values are recomputed from live operational records when the recompute pipeline runs: reliability metrics, PM compliance metrics, FMEA risk scores, replacement priority scores, equipment health snapshots, clinical readiness snapshots, workload snapshots, and legacy triage queue. The full refresh path is `recompute_all_equipment_analytics()` followed by `refresh_decision_support_snapshots()`, exposed through `supabase/functions/refresh-analytics-snapshot/index.ts` and pg_cron functions.

Some Command Center values are live queries rather than stored snapshots. `src/app/(dashboard)/command/_lib/command-center-data.ts` live-fetches corrective maintenance, needs-request triage, proactive risk watch, PM, calibration, stock blockers, installation, procurement, training, replacement candidates, and technician workload. This means the visible BME Head critical action strip can reflect current records even when some stored snapshot tables are stale.

Seeded/demo data exists in `supabase/seed/10_analytics_data.sql` for reliability metrics, FMEA risk scores, PM compliance metrics, equipment performance scores, replacement priority scores, and recommendation flags. These rows are useful for demos and baseline thesis evidence, but should not be described as mature live hospital analytics unless recomputed from real operational records.

Automatic recomputation exists in multiple ways, but with limits. FMEA risk has database triggers on maintenance events, work orders, PM schedules, PM completions, calibration records/requests, and equipment assets. Completed work orders and completed PM status in services call `recomputeAssetAnalytics`. Full fleet RPI and decision-support snapshots require `recompute_all_equipment_analytics()` or the scheduled Edge Function. The reliability evidence pipeline writes downtime_logs from maintenance event downtime timestamps, but stored reliability rows still depend on recompute.

Tables that must be populated for real Command Center values are: `equipment_assets`, `equipment_categories`, `departments`, `maintenance_requests`, `work_orders`, `maintenance_events`, `downtime_logs`, `pm_plans`, `pm_schedules`, `pm_completions`, `calibration_records`, `calibration_requests`, `spare_parts`, `work_order_parts_needed`, `procurement_requests`, `installation_records`, `training_requests`, `recommendation_flags`, `equipment_risk_scores`, `equipment_reliability_metrics`, `pm_compliance_metrics`, and `replacement_priority_scores`.

The main missing or partial pipelines are recommendation generation and escalation evaluation. `generateRecommendations` exists but no caller was found. Escalation rules are seeded but no active evaluator was found. Composite performance scores are seeded/read but no live recompute path was found.

## 9. Thesis Defense Explanation

* **RPN:** “We use RPN because it combines the seriousness of a failure, how often it occurs, and how hard it is to detect. This helps the BME Head focus on equipment where clinical risk is highest.”
* **MTBF:** “We use MTBF because it tells us the average operating time between failures. Lower MTBF means the equipment is failing more often.”
* **MTTR:** “We use MTTR because it tells us how long repairs take. Higher MTTR means longer downtime and possible service interruption.”
* **Availability:** “We use availability because equipment must be both reliable and repairable to be ready for clinical use. It combines MTBF and MTTR into one uptime ratio.”
* **PMC:** “We use PMC because preventive maintenance only protects patients and equipment if scheduled tasks are actually completed. It measures completed PM tasks divided by scheduled PM tasks.”
* **RPI:** “We use RPI because replacement decisions should consider more than age. The score combines age, failures, availability, maintenance burden, spare-part support, risk, and cost.”
* **Equipment Health Score:** “We use equipment health score because the BME Head needs one quick asset condition indicator. It combines availability, PM compliance, RPN control, current condition, and open flags.”
* **Clinical Readiness:** “We use clinical readiness because a department is ready only when its essential high and critical equipment is functional. Non-essential assets are tracked but excluded from readiness percentage.”
* **Triage Priority:** “We use triage priority because the Command Center must rank many different issues together. It combines category importance and item urgency so immediate clinical blockers appear first.”

## 10. Gaps, Risks, and Recommendations

| Severity | Affected formula | Why it matters | Recommended fix or defense explanation |
| --- | --- | --- | --- |
| High | RPI | Replacement page displays failure 20% and availability 15%, but canonical code uses failure 15% and availability 20%. | Fix UI/report text after audit. For defense, state canonical RPI is 15/15/20/15/10/15/10 and note UI typo if asked. |
| High | Recommendation flags | `generateRecommendations` has important rules but no caller was found, so flags may be seeded/static or generated elsewhere outside repo. | Do not claim automatic recommendation generation unless pipeline is shown. Explain stored flags are consumed by Command Center. |
| High | Escalation rules | Tables and seeded rules exist, but no evaluator was found. | Do not claim automatic escalation execution. Present as designed rule table unless evaluator is added. |
| Medium | PMC | Null/zero behavior differs: utility/RPC returns null when no scheduled PM; generated table column returns 0. | Thesis should define whether no PM schedule means not applicable or zero compliance. |
| Medium | Equipment health | Defaults availability .92, PMC 80, RPN 120 are hardcoded. | Explain as neutral baseline defaults used only when evidence is missing; surface missing evidence in thesis limitations. |
| Medium | FMEA assignment rules | SQL hardcodes department keywords, age bands, and penalty values. | Add methodology table to thesis; explain local hospital-adapted FMEA mapping. |
| Medium | Composite performance score | `equipment_performance_scores` is seeded and read, but no live recompute path was found. | Treat as demo/baseline or remove from thesis claims unless recompute path exists. |
| Medium | Snapshot freshness | Health/readiness/triage snapshots require refresh; some live Command Center sections bypass snapshots. | Explain live vs snapshot clearly. Use refresh logs during defense. |
| Medium | Menelik reliability maturity | Thesis extraction notes say longitudinal reliability indicators may be immature with limited operational history. | Say formulas are implemented, but real MTBF/MTTR/availability become stronger as operational data accumulates. |
| Medium | PM triage | Current item score uses overdue days only, not criticality. | Explain PM triage is due-date urgency; criticality affects risk/readiness elsewhere. |
| Medium | Calibration triage | Current item score uses due date only, not criticality/result. | Explain calibration triage is deadline-based; FMEA detectability handles failed/adjusted result. |
| Low | Workload capacity | Estimated hours are shown but not used in status classification. | Explain current status is count/critical-task based; hours are supporting evidence. |
| Low | Downtime burden and annualized failure rate | Utilities exist but no main Command Center consumer found. | Do not present as active Command Center formulas unless used through RPI inputs. |
| Low | Requested folders | `src/app/(dashboard)/decision-support`, `analytics`, and `risk` not found. | Use actual routes: `command`, `replacement`, `pm`, `maintenance`, `compliance`, services, utilities. |
| Low | Repeat repair flags | `repeat_repair_flags` table exists but appears superseded by `recommendation_flags.recurring_failure`. | Explain recurring failure is represented by recommendation flags in current implementation. |

Formulas mentioned in the thesis/progress evidence but not clearly implemented: automatic recommendation generation, automatic escalation execution, live composite performance score recomputation, and mature Menelik reliability trends. The repository has formulas and tables for these areas, but either no caller/evaluator was found or the thesis extraction notes caution that real longitudinal data is limited.

Formulas implemented in code but not clearly emphasized in the thesis/progress evidence: needs-request triage score, proactive risk watch score, corrective maintenance score, installation triage, training triage, viewer department risk classification, and procurement expected-delivery-date delay scoring. These should be added if the defense discusses the Command Center beyond the major thesis formulas.

## 11. Final Checklist for Defense Readiness

* Explain what each formula means: RPN, MTBF, MTTR, availability, PMC, RPI, health, readiness, triage, workload.
* Explain every criterion: severity, occurrence, detectability, age, failures, downtime, PM completion, calibration due date, spare parts, cost, condition, flags, workload.
* State where values come from: asset records, maintenance events, work orders, downtime logs, PM schedules, calibration records, spare parts, procurement records, recommendation flags, lookup tables, seeded data, and hardcoded defaults.
* Distinguish live values from snapshots and seeded demo data.
* Be ready to say that RPI canonical weights are age 15%, failures 15%, availability 20%, maintenance burden 15%, spare parts 10%, risk 15%, cost 10%.
* Be ready to explain the RPI UI mismatch in `replacement/page.tsx`.
* Be ready to explain why high/critical equipment is used for clinical readiness.
* Be ready to explain why health score uses default values when evidence is missing.
* Be ready to explain that Command Center supports prioritization, not automatic final decisions.
* Be ready to say “Not found in repository” for automatic escalation evaluator, recommendation generator caller, and requested `decision-support`, `analytics`, and `risk` route folders.
* Be ready to explain limitations: limited longitudinal operational history, hardcoded prototype thresholds, snapshot refresh dependence, and criteria needing advisor/examiner justification.
