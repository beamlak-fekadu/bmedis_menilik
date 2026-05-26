# Menelik II Hospital — Real Data Import

This folder contains the real Menelik II Comprehensive Specialized Hospital
biomedical equipment management records and the import pipeline that loads
them into the BMEDIS Supabase database.

## Data Source

The workbook `Menelik_II_Medical_Equipment_Management.xlsx` was reconstructed
from physical hospital records: paper binders, photographed logsheets, and
the hospital's first-round equipment inventory (2018 Ethiopian Calendar).

The data is incomplete and reflects the actual record-keeping state of a
real Ethiopian hospital. Missing fields, ambiguous dates, and inconsistent
naming are expected and handled by the import pipeline.

## Import Pipeline

```bash
# 1. Inspect workbook (read-only analysis)
npm run inspect:menelik

# 2. Dry run (normalize + validate, no DB writes)
npm run import:menelik:dry-run

# 3. Live import (clears old data, imports Menelik records)
npm run import:menelik

# 4. Post-import validation
npm run validate:menelik
```

## What Gets Imported

| Source Sheet | Target Tables | Records |
|---|---|---|
| Equipment Inventory | equipment_assets, departments, equipment_categories, manufacturers | 170 assets |
| Work Orders | maintenance_requests, work_orders | ~10 matched |
| Performance Verification | pm_plans, pm_schedules, pm_completions | ~13 records |
| Preventive Maintenance | pm_plans, pm_schedules, pm_completions | ~2 records |
| Training Records | training_sessions, staff_training_records | ~12 records |
| Calibration | (skipped — placeholder only) | 0 |
| Acceptance Testing | (skipped — blank template) | 0 |
| Dashboard | (skipped — summary only) | 0 |

## What Is Preserved

- Auth users, profiles, roles, user_roles (login accounts)
- Audit logs
- Reference configuration (failure codes, calibration types, PM templates)
- Schema and migrations

## Department Grouping

36 raw ward/room values from the workbook are grouped into 13 departments:

| Department | Equipment Count |
|---|---|
| Eye Department | 50 |
| Laboratory | 38 |
| Emergency Department | 23 |
| Operating Theater | 11 |
| Specialty OPD | 9 |
| ICU | 6 |
| Maternal and Child Health | 6 |
| Dialysis Center | 6 |
| Radiology and Imaging | 5 |
| NICU | 5 |
| Inpatient Ward | 5 |
| Central Sterilization | 3 |
| Pharmacy | 3 |

## Limitations

- **Calibration**: Only a placeholder row referencing a physical cover page. No
  usable calibration records were imported.
- **Dates**: DD/MM/YYYY dates in the 2015–2019 range may be Ethiopian Calendar.
  Original values are stored in notes; date fields are left null when ambiguous.
- **Manufacturers**: ~85% of the "Manufacturer/Brand" column values are actually
  model numbers or serial numbers. The import identifies ~12 real manufacturers
  and sets the rest to null with the original value in notes.
- **Analytics**: MTBF, MTTR, availability, and replacement priority indicators
  require accumulated operational history. The imported work orders and PM
  records provide a starting point but are insufficient for trend analysis.
- **PM Compliance**: Based on 15 records (13 PV + 2 PM), not hospital-wide.
- **Asset Matching**: 3 of 13 work orders could not be matched to inventory
  assets (OR Light, Patient Bed x2) because those items are not in the
  biomedical equipment inventory.

## Reports

- `inspection-report.json` — Workbook structure and quality analysis
- `dry-run-report.json` — Normalization preview (no DB writes)
- `import-report.json` — Final import results with counts and matching
- `validation-report.json` — Post-import integrity and readiness checks
- `normalized/` — Intermediate JSON files for each table
