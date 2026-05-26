# Thesis Paper Update Notes — Menelik II Hospital Real Data

## Recommended Wording

### System Configuration

> BMEDIS was configured with real Menelik II Comprehensive Specialized Hospital
> biomedical equipment management records. Available records included a
> first-round equipment inventory (170 assets across 13 clinical departments),
> selected corrective maintenance work orders, performance verification and
> preventive maintenance evidence, and user/biomedical personnel training
> records. Calibration and acceptance testing records were referenced but not
> available in structured form for import.

### Data Completeness

> Because reliability and trend-based indicators such as MTBF, MTTR,
> availability ratio, PM compliance trends, calibration history, replacement
> priority index, and maintenance burden require accumulated operational
> history, BMEDIS distinguishes between immediately available real-data
> outputs and maturing indicators that strengthen as more routine operational
> records are entered through the system.

### Immediately Available Outputs

> The following outputs are immediately available based on imported Menelik II
> Hospital records:
>
> - Equipment registry with 170 biomedical assets across 13 clinical departments
> - Equipment condition distribution (functional, non-functional, decommissioned)
> - Department-level equipment distribution and category breakdown
> - 10 corrective maintenance work orders with fault descriptions and corrective actions
> - 15 preventive maintenance and performance verification evidence records
> - 12 training records with named trainees and training topics
> - Baseline risk priority numbers (RPN) computed from initial equipment assessment

### Maturing Indicators

> The following decision-support indicators are computed but require additional
> operational history to reach statistical significance:
>
> - Mean Time Between Failures (MTBF) — requires >= 2 failure events per asset
> - Mean Time To Repair (MTTR) — requires completed repair duration records
> - Equipment availability ratio — derived from MTBF and MTTR
> - PM compliance percentage — currently based on 15 imported records, not
>   hospital-wide PM program coverage
> - Replacement Priority Index (RPI) — computed but limited by missing lifecycle
>   cost and maintenance burden history
> - Calibration compliance — no structured calibration records available for import

### Deployment Demonstration

> The deployment demonstrates that real Ethiopian hospital records can
> initialize BMEDIS and that continued operational use of the system's
> maintenance request, work order, PM, calibration, and training workflows
> will progressively strengthen all decision-support indicators. The system
> is designed to surface honest empty states for indicators with insufficient
> data rather than presenting misleading analytics.

## Key Numbers for Tables/Charts

| Metric | Value |
|---|---|
| Total equipment assets | 170 |
| Departments | 13 |
| Condition: Functional | ~145 |
| Condition: Non-Functional | ~20 |
| Condition: Decommissioned (To Be Disposed) | ~5 |
| Work orders imported | 10 |
| PM/PV evidence records | 15 |
| Training sessions | 12 |
| Calibration records | 0 (placeholder only) |
| WHO equipment categories | 13 |
| Identified manufacturers | 12 |

## Do Not Say

- "Demo data was used for evaluation"
- "Simulated hospital records"
- "Generated test data"
- "Fully complete analytics"
- "Hospital-wide PM compliance"
