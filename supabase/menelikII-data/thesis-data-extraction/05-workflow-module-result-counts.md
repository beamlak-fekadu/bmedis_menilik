# Workflow Module Result Counts

| Module | Implemented? | Menelik Data Imported? | Record Count | Main Tables | Result Claim | Limitation |
| --- | --- | --- | --- | --- | --- | --- |
| Equipment registry | Yes | Yes | 170 | equipment_assets, departments, equipment_categories, manufacturers | Real Menelik equipment registry imported and source-tagged. | Manufacturer/model quality limited by source column quality. |
| Department/category/manufacturer setup | Yes | Yes | 13 departments; 13 categories; 12 manufacturers | departments, equipment_categories, manufacturers | Menelik ward/category normalization configured. | 36 raw ward labels grouped into 13 operational departments. |
| Maintenance requests | Yes | Yes | 10 | maintenance_requests | Matched work-order evidence created corrective requests. | Only matched historical records imported. |
| Work orders | Yes | Yes | 10 | work_orders | 10 corrective work orders imported. | 3 source work orders were skipped because no matching asset was found. |
| PM / performance verification | Yes | Yes | 14 | pm_plans, pm_schedules, pm_completions | Performance verification treated as PM/PV evidence. | Not hospital-wide PM compliance evidence. |
| Calibration | Yes | No | 0 | calibration_records, calibration_requests | Workflow implemented but Menelik workbook had no row-level records. | Do not show old 54 calibration records. |
| Spare parts | Yes | No | 0 | spare_parts, stock_receipts, stock_issues | Module implemented/configured. | No spare parts imported from current workbook. |
| Procurement | Yes | No | 0 | procurement_requests, specification_requests | Procurement workflow implemented. | No Menelik procurement rows verified from current import. |
| Training | Yes | Yes | 12 | training_sessions, staff_training_records | Training evidence imported. | Limited to 12 records from one photographed training verification source. |
| Disposal | Yes | Yes | 5 | disposal_requests, disposed_assets | Pending disposal requests generated for decommissioned assets. | No disposed_assets rows; disposal is pending review. |
| Reports | Yes | Uses live data | multiple report routes | reports service/actions/routes | Reports/export module implemented. | Manual export validation not proven unless command/test evidence exists. |
| Command Center / analytics | Yes | Initialized | 165 risk; 165 replacement; 165 reliability | analytics tables, snapshots, command loaders | Decision-support scores initialized from Menelik registry/workflow evidence. | Reliability/history-based analytics are immature due to limited event history. |
| QR/mobile | Yes | Operational route support | 0 | equipment_qr_scans, QR routes/actions | QR landing, labels, scan evidence, mobile/offline page support implemented. | QR label attachment/field validation not proven by this extraction. |
| Offline | Yes | Workflow support | 0 | offline_sync_events, public/sw.js, offline routes/libs | Offline queue/cache/replay evidence implemented. | Manual offline validation not claimed unless test/log evidence exists. |
| Notifications/Telegram | Yes | Workflow support | 0 | notifications, notification_events, telegram_connections | Notification engine and optional Telegram integration implemented. | Telegram depends on environment variables and recipient chat connections; do not expose values. |
| Copilot | Yes | Code/test support | not verified | chatbot services/actions/tests | Gemini-backed assistant/copilot implemented. | Do not claim expert manual validation unless source exists. |
