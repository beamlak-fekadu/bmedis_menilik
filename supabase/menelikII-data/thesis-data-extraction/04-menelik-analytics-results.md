# Menelik Analytics Results

## A. Reliability Metrics Summary

| Metric | Value | Evidence / Interpretation |
| --- | --- | --- |
| Reliability metric rows | 165 | validation-report.json / equipment_reliability_metrics query |
| MTBF non-null rows | 0 | Non-null mtbf_hours rows from equipment_reliability_metrics. |
| MTTR non-null rows | 0 | Non-null mttr_hours rows from equipment_reliability_metrics. |
| Availability non-null rows | 0 | Non-null availability_ratio rows from equipment_reliability_metrics. |
| Average MTBF hours | not available | Only meaningful if non-null rows exist. |
| Median MTBF hours | not available | Only meaningful if non-null rows exist. |
| Average MTTR hours | not available | Only meaningful if non-null rows exist. |
| Median MTTR hours | not available | Only meaningful if non-null rows exist. |
| Average availability | not available | Only meaningful if non-null rows exist. |
| Assets with insufficient reliability history | 165 | Rows missing failure/repair/MTBF/MTTR/availability evidence. |

Caution: imported `maintenance_events` and `downtime_logs` counts are both 0 / 0; reliability indicators are initialized and should mature through continued use.

## B. Risk Scores Summary

Risk score rows: 165

Risk bands:

| RiskBand | Count | PercentageOfRiskRows |
| --- | --- | --- |
| low | 149 | 90.3% |
| high | 13 | 7.9% |
| medium | 3 | 1.8% |

Top 10 CSV: `extracted-tables/risk-ranking-menelik.csv`

| rank | asset_code | asset_name | department | category | severity | occurrence | detectability | RPN | risk_level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ICU-0004 | Mechanical Ventilator | ICU | Respiratory and Ventilation | 9 | 6 | 6 | 324 | high |
| 2 | ED-0002 | Patient Monitor | Emergency Department | Patient Monitoring | 9 | 6 | 6 | 324 | high |
| 3 | ED-0017 | Suction Machine, Electrical | Emergency Department | Respiratory and Ventilation | 9 | 6 | 6 | 324 | high |
| 4 | EYE-0027 | Anesthesia Machine | Eye Department | Respiratory and Ventilation | 9 | 6 | 6 | 324 | high |
| 5 | ICU-0005 | Mechanical Ventilator | ICU | Respiratory and Ventilation | 9 | 6 | 6 | 324 | high |
| 6 | ICU-0006 | Mechanical Ventilator | ICU | Respiratory and Ventilation | 9 | 6 | 6 | 324 | high |
| 7 | LAB-0004 | Platelet Agitator | Laboratory | Laboratory Equipment | 8 | 6 | 6 | 288 | high |
| 8 | EYE-0019 | Indirect Ophthalmoscope | Eye Department | Ophthalmology Equipment | 8 | 6 | 6 | 288 | high |
| 9 | EYE-0042 | Steam Sterilizer | Eye Department | Sterilization Equipment | 8 | 6 | 6 | 288 | high |
| 10 | RAD-0003 | CT Scanner | Radiology and Imaging | Diagnostic Imaging | 8 | 6 | 6 | 288 | high |

## C. Replacement Priority Summary

Replacement priority rows: 165

Replacement bands:

| ReplacementBand | Count | Threshold |
| --- | --- | --- |
| monitor | 153 | RPI < 0.55 |
| review | 12 | 0.55 <= RPI < 0.70 |

Top 10 CSV: `extracted-tables/replacement-priority-menelik.csv`

| rank | asset_code | asset_name | department | score_RPI | band | main_drivers |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ED-0002 | Patient Monitor | Emergency Department | 0.575 | review | System-computed: top drivers = availability(0.100), risk(0.150), failure(0.075) |
| 2 | ED-0017 | Suction Machine, Electrical | Emergency Department | 0.575 | review | System-computed: top drivers = availability(0.100), risk(0.150), failure(0.075) |
| 3 | ICU-0004 | Mechanical Ventilator | ICU | 0.575 | review | System-computed: top drivers = availability(0.100), risk(0.150), failure(0.075) |
| 4 | ICU-0005 | Mechanical Ventilator | ICU | 0.575 | review | System-computed: top drivers = availability(0.100), risk(0.150), failure(0.075) |
| 5 | ICU-0006 | Mechanical Ventilator | ICU | 0.575 | review | System-computed: top drivers = availability(0.100), risk(0.150), failure(0.075) |
| 6 | EYE-0027 | Anesthesia Machine | Eye Department | 0.575 | review | System-computed: top drivers = availability(0.100), risk(0.150), failure(0.075) |
| 7 | LAB-0004 | Platelet Agitator | Laboratory | 0.5577 | review | System-computed: top drivers = availability(0.100), risk(0.133), failure(0.075) |
| 8 | RAD-0003 | CT Scanner | Radiology and Imaging | 0.5577 | review | System-computed: top drivers = availability(0.100), risk(0.133), failure(0.075) |
| 9 | EYE-0042 | Steam Sterilizer | Eye Department | 0.5577 | review | System-computed: top drivers = availability(0.100), risk(0.133), failure(0.075) |
| 10 | RAD-0005 | X-Ray Machine w/ Fluoroscopy | Radiology and Imaging | 0.5577 | review | System-computed: top drivers = availability(0.100), risk(0.133), failure(0.075) |

## D. Equipment Health / Composite Score Summary

Health snapshot rows queried: 165

CSV: `extracted-tables/equipment-health-menelik.csv`

| group | rank | asset_code | asset_name | department | health_score | reliability_component | pm_component | risk_component | status_component |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| top | 1 | MCH-0001 | Cryotherapy Machine | Maternal and Child Health | 91.9 | 92 | 80 | 12 | 100 |
| top | 2 | EYE-0022 | Cryotherapy Machine | Eye Department | 91.9 | 92 | 80 | 12 | 100 |
| top | 3 | SOPD-0001 | Dental Unit | Specialty OPD | 91.7 | 92 | 80 | 20 | 100 |
| top | 4 | SOPD-0002 | Dental Unit | Specialty OPD | 91.7 | 92 | 80 | 20 | 100 |
| top | 5 | SOPD-0003 | Dental Unit | Specialty OPD | 91.7 | 92 | 80 | 20 | 100 |
| top | 6 | SOPD-0005 | ENT Chair (Powered) | Specialty OPD | 91.7 | 92 | 80 | 20 | 100 |
| top | 7 | SOPD-0006 | ENT Chair (Powered) | Specialty OPD | 91.7 | 92 | 80 | 20 | 100 |
| top | 8 | EYE-0029 | Microscope, Operating | Eye Department | 90.6 | 92 | 80 | 64 | 100 |
| top | 9 | EYE-0030 | Phaco Machine | Eye Department | 90.6 | 92 | 80 | 64 | 100 |
| top | 10 | EYE-0031 | Appasamy Infrared Laser | Eye Department | 90.6 | 92 | 80 | 64 | 100 |
| bottom | 1 | ICU-0006 | Mechanical Ventilator | ICU | 79.6 | 92 | 80 | 324 | 70 |
| bottom | 2 | ICU-0005 | Mechanical Ventilator | ICU | 79.6 | 92 | 80 | 324 | 70 |
| bottom | 3 | ICU-0004 | Mechanical Ventilator | ICU | 79.6 | 92 | 80 | 324 | 70 |
| bottom | 4 | EYE-0027 | Anesthesia Machine | Eye Department | 79.6 | 92 | 80 | 324 | 70 |
| bottom | 5 | ED-0017 | Suction Machine, Electrical | Emergency Department | 79.6 | 92 | 80 | 324 | 70 |
| bottom | 6 | ED-0002 | Patient Monitor | Emergency Department | 79.6 | 92 | 80 | 324 | 70 |
| bottom | 7 | LAB-0025 | Clinical Chemistry Analyzer | Laboratory | 80.5 | 92 | 80 | 288 | 70 |
| bottom | 8 | RAD-0005 | X-Ray Machine w/ Fluoroscopy | Radiology and Imaging | 80.5 | 92 | 80 | 288 | 70 |
| bottom | 9 | RAD-0003 | CT Scanner | Radiology and Imaging | 80.5 | 92 | 80 | 288 | 70 |
| bottom | 10 | EYE-0042 | Steam Sterilizer | Eye Department | 80.5 | 92 | 80 | 288 | 70 |

## E. PM Compliance / PM Evidence Summary

Stored PM compliance metric rows: 0. Actual imported PM/PV schedules/completions: 14/14.

CSV: `extracted-tables/pm-summary-menelik.csv`

| Type | Name | Count | Notes |
| --- | --- | --- | --- |
| Schedule status | completed | 14 | Imported PM/PV schedule status |
| Completion department | Inpatient Ward | 8 | Department of matched asset for imported PM/PV evidence |
| Completion department | ICU | 5 | Department of matched asset for imported PM/PV evidence |
| Completion department | Emergency Department | 1 | Department of matched asset for imported PM/PV evidence |
| Completion category | Respiratory and Ventilation | 13 | Category of matched asset for imported PM/PV evidence |
| Completion category | Patient Monitoring | 1 | Category of matched asset for imported PM/PV evidence |

## F. Clinical Readiness / Department Readiness

Readiness rows queried: 13

CSV: `extracted-tables/department-readiness-menelik.csv`

| department | readiness_score | essential_total | essential_functional | source |
| --- | --- | --- | --- | --- |
| Dialysis Center | 100 | 6 | 6 | clinical_readiness_snapshots |
| NICU | 100 | 3 | 3 | clinical_readiness_snapshots |
| Specialty OPD | 100 | 4 | 4 | clinical_readiness_snapshots |
| Central Sterilization | 100 | 3 | 3 | clinical_readiness_snapshots |
| Operating Theater | 100 | 11 | 11 | clinical_readiness_snapshots |
| Pharmacy | 100 | 2 | 2 | clinical_readiness_snapshots |
| Inpatient Ward | 100 | 5 | 5 | clinical_readiness_snapshots |
| Maternal and Child Health | 100 | 5 | 5 | clinical_readiness_snapshots |
| Laboratory | 94.74 | 38 | 36 | clinical_readiness_snapshots |
| Eye Department | 93.88 | 49 | 46 | clinical_readiness_snapshots |
| Emergency Department | 90.91 | 22 | 20 | clinical_readiness_snapshots |
| Radiology and Imaging | 60 | 5 | 3 | clinical_readiness_snapshots |
| ICU | 40 | 5 | 2 | clinical_readiness_snapshots |

## G. Command Center Counts

CSV: `extracted-tables/command-center-summary-menelik.csv`

| Metric | Value | Evidence | Interpretation |
| --- | --- | --- | --- |
| Total equipment assets (all non-deleted) | 170 | equipment_assets / normalized equipment-assets.json | Inventory size for thesis dataset. |
| Active equipment assets | 165 | equipment_assets.status=active | Command Center active equipment basis where active-only views are used. |
| Functional active assets | 153 | equipment_assets.condition/status | Functional equipment in active registry. |
| Non-functional active assets | 12 | equipment_assets.condition/status | Active assets marked non-functional. |
| Open work orders | 3 | work_orders.status in open/assigned/in_progress/on_hold | Corrective work still open after import. |
| Critical/high open work orders | 0 | work_orders.priority on open rows | High urgency open corrective work. |
| Overdue PM | 0 | pm_schedules scheduled_date/status | Imported schedules are completed; no overdue PM from imported PM/PV evidence. |
| Calibration due | 0 | v_calibration_due when query succeeded | No Menelik calibration rows were imported; avoid old 54 calibration due claim. |
| Stock risks / blockers | 0 | spare_parts current_stock <= reorder_level | Workbook did not populate spare parts. |
| Replacement candidates (RPI >= 0.55) | 12 | replacement_priority_scores + src/utils/decision-support/replacement-thresholds.ts | Prototype planning threshold; not automatic replacement approval. |
| Strong replacement candidates (RPI >= 0.70) | 0 | replacement_priority_scores + replacement threshold | Strong planning pressure only. |
| Pending disposal requests | 5 | disposal_requests.status | Pending review, not completed disposal. |
