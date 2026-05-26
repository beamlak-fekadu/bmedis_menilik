# Menelik Import Dataset Tables

## Report Paths

| Item | Path | Found |
| --- | --- | --- |
| workbook | supabase/menelikII-data/Menelik_II_Medical_Equipment_Management.xlsx | yes |
| inspection | supabase/menelikII-data/inspection-report.json | yes |
| dryRun | supabase/menelikII-data/dry-run-report.json | yes |
| import | supabase/menelikII-data/import-report.json | yes |
| validation | supabase/menelikII-data/validation-report.json | yes |
| notes | supabase/menelikII-data/paper-update-notes.md | yes |
| readme | supabase/menelikII-data/README.md | yes |

## Workbook Sheet Counts

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

## Imported Counts

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

## Skipped Rows / Sources

| Sheet | Row | Reason |
| --- | --- | --- |
| Work Orders | 4 | No matching asset for OR Light |
| Work Orders | 7 | No matching asset for Patient Bed |
| Work Orders | 8 | No matching asset for Patient Bed |
| Preventive Maintenance | 5 | No matching asset for Dialysis Monitor / Medical Monitor |
| Calibration | 0 | Calibration sheet contained only placeholder/report-cover information; no row-level calibration records were imported. |
| Acceptance Testing | 0 | Blank template — no real acceptance test data |
| Dashboard | 0 | Summary only — not source operational data |

## Distributions

See CSVs in `extracted-tables/`:

- `department-distribution.csv`
- `category-distribution.csv`
- `condition-status-distribution.csv`
- `manufacturer-summary.csv`
- `source-sheet-summary.csv`
- `imported-dataset-summary.csv`
