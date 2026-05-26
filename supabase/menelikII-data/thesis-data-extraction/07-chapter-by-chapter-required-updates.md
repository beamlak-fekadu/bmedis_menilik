# Chapter-by-Chapter Required Updates

## Abstract
Old issue: May describe simulation/demo dataset.
New evidence: Menelik II real-data deployment with 170 assets and imported workflow evidence.
Replacement facts: 170 assets, 13 departments, 10 work orders, 14 PM/PV schedules/completions, 12 training sessions, 5 pending disposal requests, 0 calibration/acceptance records.
Suggested wording points: State real hospital records initialized the system; decision-support analytics are baseline/maturing.
Do not say: Demo data, simulated data, complete operational history.

## Chapter 1
Old issue: Problem statement may imply only prototype/demo validation.
New evidence: Real Menelik records imported and validated.
Replacement facts: Use validation-report presentationReady=true and source_tag=menelik_ii_2018ec_import.
Suggested wording points: Position system as hospital-level implementation using real Ethiopian hospital data.
Do not say: Evaluation used only demo records.

## Chapter 2
Old issue: Literature review likely needs minimal change unless it references demo-only evaluation.
New evidence: No literature extraction needed from repo.
Replacement facts: Keep literature, but align claims with real-data implementation.
Suggested wording points: Emphasize data incompleteness as a real hospital implementation challenge.
Do not say: Real data was complete or uniformly structured.

## Chapter 3
Old issue: Formula/weight tables may drift from code.
New evidence: See 04b-formulas-and-weights.md.
Replacement facts: RPN=S×O×D; RPI weights 15/15/20/15/10/15/10; health weights 35/25/25/15; critical action bands 180/150/100.
Suggested wording points: Distinguish formulas implemented from indicators that require maturing operational data.
Do not say: Calibration compliance is computed from Menelik rows; none were imported.

## Chapter 4
Old issue: Methods may describe demo seeding rather than Menelik import.
New evidence: inspect/import/validate scripts and reports exist.
Replacement facts: Workbook path supabase/menelikII-data/Menelik_II_Medical_Equipment_Management.xlsx; scripts inspect/import/validate; imported source tag menelik_ii_2018ec_import; calibration/acceptance skipped with reasons.
Suggested wording points: Add data cleaning/import pipeline, department grouping, asset-code generation, source-tagging, limitations.
Do not say: Demo seed data is the final dataset.

## Chapter 5
Old issue: Biggest change; old simulation numbers and figures are obsolete.
New evidence: 01-chapter-5-replacement-data.md and extracted CSVs.
Replacement structure:

### 5.1 Menelik II Dataset Preparation and Import
Use source-sheet-summary.csv and skipped rows table.

### 5.2 Imported Equipment Registry Results
Use department/category/condition/manufacturer CSVs and asset-code/inventory preservation facts.

### 5.3 Imported Workflow Evidence Results
Use work orders, PM/PV, training, and disposal evidence tables.

### 5.4 Decision-Support and Analytics Initialization Results
Use risk-ranking, replacement-priority, health/readiness summaries with maturity cautions.

### 5.5 Limited or Unavailable Source Data
Use limited-skipped-sources.csv for calibration, acceptance, dashboard, plus PM compliance caution.

Do not say: 80 assets, 8 departments, 43 requests, 17 WOs, 149 PM schedules, 54 calibration records, 40 spare parts, 23 training sessions, 4 disposal requests, Jan 2024-Mar 2025 reliability period as final Menelik results.

## Chapter 6
Old issue: Old screenshots/counts/emails.
New evidence: 02-chapter-6-results-data.md.
Replacement facts: Use Menelik role emails, 170 assets, 10 WOs, 14 PM/PV, 0 calibration, initialized analytics.
Suggested wording points: State implemented modules separately from populated Menelik data.
Do not say: Command Center shows 81 equipment; calibration due is 54; @bmerms-demo.local accounts are final.

## Chapter 7
Old issue: Conclusion may understate real deployment or overstate mature analytics.
New evidence: Real import validates deployment initialization but exposes source limitations.
Replacement facts: System initialized real registry/workflows; future work should collect calibration, acceptance, spare parts, procurement, and longitudinal maintenance events.
Suggested wording points: Conclude that the system is ready as a real-data deployment foundation, not a finished longitudinal analytics study.
Do not say: Fully complete analytics or complete operational history.

## Appendix A
Old issue: Demo emails.
New evidence: setup-menelik-users.ts and validation report.
Replacement facts: developer@bmedis-menelik.local, bme.head@bmedis-menelik.local, department.head@bmedis-menelik.local, department.user@bmedis-menelik.local, technician@bmedis-menelik.local, store.user@bmedis-menelik.local, viewer@bmedis-menelik.local.
Suggested wording points: List roles and emails only.
Do not say: Passwords or environment values.
