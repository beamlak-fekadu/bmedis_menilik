# Thesis Data Extraction Summary

Generated: 2026-05-26T12:22:12.838Z

## Scope

This evidence pack extracts verified implementation, data, result, and limitation facts for rewriting the BMEDIS BSc thesis around the Menelik II Hospital real-data deployment. It intentionally does not rewrite the thesis, produce screenshots, generate figures, print environment values, or expose secrets.

## Source Files Found

- supabase/menelikII-data/Menelik_II_Medical_Equipment_Management.xlsx: yes
- supabase/menelikII-data/inspection-report.json: yes
- supabase/menelikII-data/dry-run-report.json: yes
- supabase/menelikII-data/import-report.json: yes
- supabase/menelikII-data/validation-report.json: yes
- supabase/menelikII-data/paper-update-notes.md: yes
- supabase/menelikII-data/README.md: yes

## High-Level Evidence

| Metric | Value | Evidence |
| --- | --- | --- |
| Workbook path | supabase/menelikII-data/Menelik_II_Medical_Equipment_Management.xlsx | inspection-report.json workbookPath |
| Workbook sheets | 8 | inspection-report.json summary.totalSheets |
| Final validation | PRESENTATION READY | validation-report.json presentationReady |
| Validation checks | 17 passed, 1 warning, 0 failed | validation-report.json summary |
| Live import mode | live | import-report.json mode |
| Analytics refresh | completed | import-report.json analyticsRefresh |
| Import source tag | menelik_ii_2018ec_import | scripts/import-menelik-data.ts + validation-report.json source-tagged check |
| DB query status | attempted; 0 query warnings/errors recorded | temporary extraction script read-only Supabase queries |
| Lint status | passed during extraction (`npm run lint`, exit code 0) | current command run |
| Build status | passed during extraction (`npm run build`, exit code 0; static pages 54/54) | current command run |

## Exact Menelik Import Counts

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

## Validation Cautions

- Validation is presentation-ready, but the report has one warning: 7 profiles with demo email.
- Calibration imported count is 0. The calibration sheet is placeholder/report-cover information only.
- Acceptance testing imported count is 0. The acceptance sheet is blank/template-only.
- PM/PV evidence is limited to imported source records and must not be described as hospital-wide mature PM compliance.
- Reliability metrics, replacement scores, and health/readiness snapshots are initialized decision-support outputs; mature longitudinal interpretation requires more operational history.

## Output Files

- 01-chapter-5-replacement-data.md
- 02-chapter-6-results-data.md
- 03-menelik-import-dataset-tables.md
- 04-menelik-analytics-results.md
- 04b-formulas-and-weights.md
- 05-workflow-module-result-counts.md
- 06-validation-and-testing-results.md
- 07-chapter-by-chapter-required-updates.md
- 08-paper-ready-factual-statements.md
- extracted-data.json
- extracted-tables/*.csv
