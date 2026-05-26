# Chapter 5 Replacement Data

## A. Proposed New Chapter 5 Framing

Possible titles:

1. Menelik II Real-Data Deployment Results
2. Real-Data Import and System Configuration Results
3. System Deployment Results Using Menelik II Hospital Data

Recommended title: **Menelik II Real-Data Deployment Results**. This is the clearest replacement for the old simulation-results framing because Chapter 5 now needs to report what was imported, configured, initialized, and honestly limited using real hospital records.

## B. Menelik Workbook Source Summary

| Source Sheet | Source Type | Data Rows | Imported? | Reason / Use |
| --- | --- | --- | --- | --- |
| Dashboard | Summary dashboard | 15 | No | Summary only — not source operational data |
| Equipment Inventory | Inventory | 170 | Yes | Used as source evidence for corresponding module. |
| Performance Verification | PM/performance verification records | 13 | Yes | Used as source evidence for corresponding module. |
| Work Orders | Corrective maintenance records | 13 | Partially | 10 matched rows imported; 3 unmatched rows skipped. |
| Preventive Maintenance | Preventive maintenance records | 2 | Partially | Matched PM evidence imported; one unmatched row skipped. |
| Acceptance Testing | Acceptance test template | 2 | No | Blank template — no real acceptance test data |
| Training Records | Training verification records | 12 | Yes | Used as source evidence for corresponding module. |
| Calibration | Calibration placeholder/report cover | 2 | No | Calibration sheet contained only placeholder/report-cover information; no row-level calibration records were imported. |

## C. Menelik Imported Dataset Summary

| Dataset Component | Menelik Real-Data Deployment Value | Evidence Source | Interpretation |
| --- | --- | --- | --- |
| Equipment assets | 170 | validation-report.json counts.equipment_assets | Final Menelik equipment registry imported from workbook. |
| Departments | 13 | validation-report.json counts.departments | Normalized department groups used by the deployment. |
| Equipment categories | 13 | validation-report.json counts.equipment_categories | WHO/category mapping used by import. |
| Manufacturers | 12 | validation-report.json counts.manufacturers | Only identified real manufacturers; many raw values were model/serial values. |
| Maintenance requests | 10 | validation-report.json counts.maintenance_requests | Created from matched work-order evidence. |
| Work orders | 10 | validation-report.json counts.work_orders | 10 of 13 source work orders matched imported assets. |
| PM plans | 3 | validation-report.json counts.pm_plans | Created from matched PM/PV evidence. |
| PM schedules | 14 | validation-report.json counts.pm_schedules | Imported PM/PV evidence rows. |
| PM completions | 14 | validation-report.json counts.pm_completions | Completion evidence linked to imported schedules. |
| Training sessions | 12 | validation-report.json counts.training_sessions | Imported from training verification records. |
| Staff training records | 12 | validation-report.json counts.staff_training_records | One staff record per imported training evidence row. |
| Disposal requests | 5 | validation-report.json counts.disposal_requests | Generated from assets marked To Be Disposed. |
| Calibration records | 0 | validation-report.json counts.calibration_records | No row-level calibration results imported. |
| Acceptance testing records | 0 | import-report.json skipped Acceptance Testing | Blank/template-only; no operational records imported. |
| Reliability/analytics records | 165 | validation-report.json counts.equipment_reliability_metrics | Initialized for active assets but immature because maintenance event/downtime history is absent. |
| Risk scores | 165 | validation-report.json counts.equipment_risk_scores | System-computed FMEA rows for active assets. |
| Replacement scores | 165 | validation-report.json counts.replacement_priority_scores | System-computed RPI rows for active assets. |

## D. Department Distribution

CSV: `extracted-tables/department-distribution.csv`

| Department | Equipment Count | Percentage of 170 | Notes |
| --- | --- | --- | --- |
| Eye Department | 50 | 29.4% | Final normalized/imported department grouping |
| Laboratory | 38 | 22.4% | Final normalized/imported department grouping |
| Emergency Department | 23 | 13.5% | Final normalized/imported department grouping |
| Operating Theater | 11 | 6.5% | Final normalized/imported department grouping |
| Specialty OPD | 9 | 5.3% | Final normalized/imported department grouping |
| Dialysis Center | 6 | 3.5% | Final normalized/imported department grouping |
| ICU | 6 | 3.5% | Final normalized/imported department grouping |
| Maternal and Child Health | 6 | 3.5% | Final normalized/imported department grouping |
| Inpatient Ward | 5 | 2.9% | Final normalized/imported department grouping |
| NICU | 5 | 2.9% | Final normalized/imported department grouping |
| Radiology and Imaging | 5 | 2.9% | Final normalized/imported department grouping |
| Central Sterilization | 3 | 1.8% | Final normalized/imported department grouping |
| Pharmacy | 3 | 1.8% | Final normalized/imported department grouping |

## E. Category Distribution

CSV: `extracted-tables/category-distribution.csv`

| Equipment Category | Equipment Count | Percentage | Notes |
| --- | --- | --- | --- |
| Laboratory Equipment | 49 | 28.8% | Criticality: high |
| Surgical Equipment | 25 | 14.7% | Criticality: high |
| Respiratory and Ventilation | 22 | 12.9% | Criticality: critical |
| Ophthalmology Equipment | 17 | 10.0% | Criticality: high |
| Patient Monitoring | 13 | 7.6% | Criticality: critical |
| Diagnostic Imaging | 12 | 7.1% | Criticality: high |
| Neonatology Equipment | 9 | 5.3% | Criticality: critical |
| Sterilization Equipment | 9 | 5.3% | Criticality: high |
| Vital Signs and Diagnostic | 4 | 2.4% | Criticality: high |
| Dental Equipment | 3 | 1.8% | Criticality: medium |
| Renal Dialysis Equipment | 3 | 1.8% | Criticality: critical |
| ENT Equipment | 2 | 1.2% | Criticality: medium |
| Physiotherapy Equipment | 2 | 1.2% | Criticality: low |

## F. Condition/Status Distribution

CSV: `extracted-tables/condition-status-distribution.csv`

| Condition / Status | Count | Percentage | Interpretation |
| --- | --- | --- | --- |
| functional / active | 153 | 90.0% | Imported as active functional equipment. |
| non_functional / active | 12 | 7.1% | Imported as non-functional active equipment needing attention. |
| decommissioned / inactive | 5 | 2.9% | Mapped from source status "To Be Disposed"; inactive and pending disposal review. |

## G. Manufacturer Summary

CSV: `extracted-tables/manufacturer-summary.csv`

| Manufacturer | Equipment Count | Notes |
| --- | --- | --- |
| Unknown / not identified | 154 | Manufacturer/Brand source column often contained model/serial values; original raw values preserved in notes where applicable. |
| Helmer | 4 | Identified by import pipeline manufacturer normalization. |
| Yuyue | 2 | Identified by import pipeline manufacturer normalization. |
| Cepheid | 1 | Identified by import pipeline manufacturer normalization. |
| CISA | 1 | Identified by import pipeline manufacturer normalization. |
| Fazzini | 1 | Identified by import pipeline manufacturer normalization. |
| Gima | 1 | Identified by import pipeline manufacturer normalization. |
| Keeler | 1 | Identified by import pipeline manufacturer normalization. |
| Riester | 1 | Identified by import pipeline manufacturer normalization. |
| Rossmax | 1 | Identified by import pipeline manufacturer normalization. |
| Sakura | 1 | Identified by import pipeline manufacturer normalization. |
| Stryker | 1 | Identified by import pipeline manufacturer normalization. |
| Tuttnauer | 1 | Identified by import pipeline manufacturer normalization. |

## H. Work Order / Maintenance Evidence Summary

Imported work-order evidence:

| Metric | Count | Interpretation |
| --- | --- | --- |
| Source work-order rows | 13 | Rows found in workbook Work Orders sheet. |
| Imported maintenance requests | 10 | Created from matched source work orders. |
| Imported work orders | 10 | 10 matched work orders imported. |
| Skipped work orders | 3 | Skipped because no matching asset was found. |
| Open imported work orders | 3 | Imported rows still requiring workflow action. |

Work orders by department:

| Department | Work Order Count | Notes |
| --- | --- | --- |
| Maternal and Child Health | 7 | Department inferred from matched asset. |
| Eye Department | 2 | Department inferred from matched asset. |
| Emergency Department | 1 | Department inferred from matched asset. |

Work orders by status:

| Status | Count | Interpretation |
| --- | --- | --- |
| completed | 7 | Imported historical completed corrective work |
| open | 3 | Imported open/incomplete work order state |

Work orders by priority:

| Priority | Count | Interpretation |
| --- | --- | --- |
| medium | 7 | Priority derived from source urgency/usability impact mapping. |
| high | 3 | Priority derived from source urgency/usability impact mapping. |

Skipped work orders:

| Sheet | Row | Reason | Interpretation |
| --- | --- | --- | --- |
| Work Orders | 4 | No matching asset for OR Light | Skipped during matching/import; not counted as imported work order. |
| Work Orders | 7 | No matching asset for Patient Bed | Skipped during matching/import; not counted as imported work order. |
| Work Orders | 8 | No matching asset for Patient Bed | Skipped during matching/import; not counted as imported work order. |

CSVs: `work-orders-by-department.csv`, `work-orders-by-status.csv`, `work-orders-by-priority.csv`, `skipped-work-orders.csv`

## I. PM / Performance Verification Evidence Summary

Performance verification records are treated as PM/performance verification evidence. Do **not** claim hospital-wide PM compliance because the evidence is limited to the imported matched PM/PV rows.

| Metric | Count | Interpretation |
| --- | --- | --- |
| Performance verification source records | 13 | Treated as PM/performance verification evidence where matched to equipment. |
| Preventive maintenance source records | 2 | One of two PM source rows was matched/imported; one was skipped due to missing asset match. |
| Imported PM plans | 3 | Plans created from matched PM/PV equipment. |
| Imported PM schedules | 14 | All imported schedules are completion-backed evidence rows, not hospital-wide future PM coverage. |
| Imported PM completions | 14 | Completion rows linked to imported schedules. |
| PM compliance metrics rows | 0 | No stored PM compliance metric rows in validation report; avoid hospital-wide PM compliance claims. |

PM/PV evidence detail:

| Type | Name | Count | Notes |
| --- | --- | --- | --- |
| Schedule status | completed | 14 | Imported PM/PV schedule status |
| Completion department | Inpatient Ward | 8 | Department of matched asset for imported PM/PV evidence |
| Completion department | ICU | 5 | Department of matched asset for imported PM/PV evidence |
| Completion department | Emergency Department | 1 | Department of matched asset for imported PM/PV evidence |
| Completion category | Respiratory and Ventilation | 13 | Category of matched asset for imported PM/PV evidence |
| Completion category | Patient Monitoring | 1 | Category of matched asset for imported PM/PV evidence |

CSV: `extracted-tables/pm-evidence-summary.csv`, `extracted-tables/pm-summary-menelik.csv`

## J. Training Evidence Summary

| Training Area / Equipment | Sessions / Records | Trainee Count if available | Notes |
| --- | --- | --- | --- |
| Oxygen Concentrator — Operational Training | 5 | 5 | Source department Adult Emergency in workbook; trainer/date recorded where available (date 2015-10-02). |
| Patient Monitor — Operational Training | 4 | 4 | Source department Adult Emergency in workbook; trainer/date recorded where available (date 2015-10-02). |
| Suction Machine — Operational Training | 3 | 3 | Source department Adult Emergency in workbook; trainer/date recorded where available (date 2015-10-02). |

CSV: `extracted-tables/training-evidence-summary.csv`

## K. Disposal Evidence Summary

| Disposal Evidence | Count | Source | Interpretation |
| --- | --- | --- | --- |
| Disposal requests generated from "To Be Disposed" assets | 5 | import-report.json + normalized/disposal-requests.json | Pending disposal review, not completed disposal. |
| Pending disposal requests | 5 | disposal_requests.status | Review queue state after import. |
| disposed_assets rows | 0 | validation-report.json / disposed_assets | No completed disposal evidence unless rows are created later. |

CSV: `extracted-tables/disposal-evidence-summary.csv`

## L. Calibration and Acceptance Limitation Table

| Source | Available Data | Imported Count | Reason |
| --- | --- | --- | --- |
| Calibration | Placeholder/report-cover information only | 0 | No row-level calibration results were available in the cleaned workbook. |
| Acceptance Testing | Blank/template-only acceptance test sheet | 0 | No operational acceptance test records were available for import. |
| Dashboard | Workbook summary dashboard | 0 | Summary only, not source operational data. |

CSV: `extracted-tables/limited-skipped-sources.csv`

## M. Chapter 5 Figure/Chart Data Recommendations

Do not reuse old demo figures. Generate new figures later from these CSVs only:

| Suggested Chart Title | Data Table Source | CSV File | Why It Replaces Old Demo Figure |
| --- | --- | --- | --- |
| Menelik II Equipment Distribution by Department | Department distribution table | department-distribution.csv | Replaces old demo dataset department chart with 170 real imported Menelik assets. |
| Menelik II Equipment Condition Distribution | Condition/status table | condition-status-distribution.csv | Shows real functional/non-functional/decommissioned distribution. |
| Imported Workflow Evidence by Module | Workflow module count table | workflow-module-counts.csv | Shows actual Menelik records imported per module. |
| Work Orders by Department or Priority | Work order tables | work-orders-by-department.csv or work-orders-by-priority.csv | Replaces old maintenance workload claims with matched Menelik work-order evidence. |
| PM / Performance Verification Evidence Summary | PM evidence summary | pm-evidence-summary.csv | Prevents false hospital-wide PM compliance claims. |
| Disposal Requests Generated from Inventory Status | Disposal evidence summary | disposal-evidence-summary.csv | Reports 5 pending disposal requests from real To Be Disposed inventory status. |

Remove or replace these old Chapter 5 figures:

- Old demo dataset department chart: replace with `department-distribution.csv`.
- Old demo FMEA ranking: replace with `risk-ranking-menelik.csv` only if Chapter 5 explains initialized risk scores and limited history.
- Old demo PM compliance chart: remove or replace with PM/PV evidence summary; do not claim hospital-wide compliance.
- Old demo RPI ranking: replace with `replacement-priority-menelik.csv` only with the initialized-score limitation.
- Old demo composite score chart: replace with `equipment-health-menelik.csv` only if explaining defaulted/maturing inputs.
