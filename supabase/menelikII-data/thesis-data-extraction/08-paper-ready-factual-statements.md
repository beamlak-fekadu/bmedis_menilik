# Paper-Ready Factual Statements

## 1. Menelik Data Source Paragraph
BMEDIS was configured using real Menelik II Comprehensive Specialized Hospital biomedical equipment management records reconstructed from the workbook `Menelik_II_Medical_Equipment_Management.xlsx`. The workbook contained eight sheets, including equipment inventory, work orders, performance verification, preventive maintenance, training records, calibration, acceptance testing, and a dashboard summary. [Evidence: inspection-report.json, supabase/menelikII-data/README.md]

## 2. Data Cleaning/Import Paragraph
The import pipeline inspected the workbook, normalized ward names into operational departments, generated short asset codes in the `{DEPT}-{NNNN}` format, preserved original Menelik inventory numbers in asset notes where available, and tagged imported assets with `source='menelik_ii_2018ec_import'`. [Evidence: scripts/inspect-menelik-workbook.ts, scripts/import-menelik-data.ts, validation-report.json]

## 3. Imported Dataset Summary Paragraph
The Menelik deployment contains 170 equipment assets, 13 departments, 13 equipment categories, 12 identified manufacturers, 10 maintenance requests, 10 work orders, 3 PM plans, 14 PM schedules, 14 PM completions, 12 training sessions, 12 staff training records, and 5 disposal requests. [Evidence: import-report.json, validation-report.json]

## 4. Asset-Code Traceability Paragraph
All imported asset codes passed the `{DEPT}-{NNNN}` validation rule, and 168 of the 170 assets preserved an original Menelik inventory number in the notes field. This provides operational readability while retaining traceability back to the hospital's inventory records. [Evidence: validation-report.json, normalized/equipment-assets.json]

## 5. Work-Order Evidence Paragraph
The Work Orders sheet contained 13 source rows. Ten rows were matched to imported assets and converted into maintenance requests and corrective work orders; three rows were skipped because no matching asset was found for one OR Light and two Patient Bed records. [Evidence: inspection-report.json, import-report.json, normalized/work-orders.json]

## 6. PM/Performance Verification Evidence Paragraph
Performance verification records were treated as PM/performance verification evidence during import. The final deployment contains 3 PM plans, 14 PM schedules, and 14 PM completions, but this evidence should not be interpreted as hospital-wide PM compliance because the source records are limited. [Evidence: import-report.json, validation-report.json, normalized/performance-verification-records.json, normalized/pm-records.json]

## 7. Training Evidence Paragraph
The training module was populated with 12 training sessions and 12 staff training records from Menelik training verification records, covering Oxygen Concentrator, Patient Monitor, and Suction Machine operational training evidence. [Evidence: validation-report.json, normalized/training-records.json]

## 8. Disposal Request Evidence Paragraph
Five assets marked "To Be Disposed" in the Menelik inventory were converted into disposal requests. These records represent pending disposal review and should not be described as completed disposal because the deployment contains zero disposed_assets rows. [Evidence: import-report.json, validation-report.json, normalized/disposal-requests.json]

## 9. Calibration Limitation Paragraph
The calibration workflow is implemented in BMEDIS, but the Menelik workbook did not contain row-level calibration results. The calibration sheet contained placeholder/report-cover information only, so no calibration records or calibration requests were imported from the current dataset. [Evidence: inspection-report.json, import-report.json, validation-report.json]

## 10. Analytics Maturity Paragraph
The import completed an analytics refresh and initialized reliability, FMEA risk, and replacement-priority records for active assets. However, longitudinal indicators such as MTBF, MTTR, availability, PM compliance, calibration compliance, and replacement priority should be interpreted as baseline or maturing outputs because the imported dataset contains limited operational history and no imported maintenance_events or downtime_logs rows. [Evidence: import-report.json, validation-report.json, 04-menelik-analytics-results.md]

## 11. Validation/Build Paragraph
Post-import validation reported the deployment as presentation-ready with 17 passing checks, 1 warning, and 0 failures. The warning was that 7 legacy demo email profiles still existed, while 7/7 Menelik role emails were present. During the extraction pass, `npm run lint` exited successfully and `npm run build` completed successfully with TypeScript finished and 54/54 static pages generated. [Evidence: validation-report.json, 06-validation-and-testing-results.md]

## 12. Discussion Limitation Paragraph
The Menelik deployment demonstrates that BMEDIS can initialize a hospital-level biomedical equipment system from incomplete real hospital records. The main limitation is not system functionality, but source data completeness: calibration, acceptance testing, spare parts, procurement, and long-term reliability evidence require continued operational use or future data import. [Evidence: import-report.json, validation-report.json, paper-update-notes.md]

## 13. Conclusion Update Paragraph
The final thesis should conclude that BMEDIS progressed from a demonstration dataset into a Menelik II Hospital real-data deployment foundation, with verified equipment registry, workflow evidence, role setup, and initialized decision support. It should also recommend continued data capture to strengthen calibration compliance, PM compliance, stock/procurement analytics, and longitudinal reliability metrics. [Evidence: validation-report.json, import-report.json, extracted-data.json]
