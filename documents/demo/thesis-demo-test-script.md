# Thesis Demo Test Script

Use this script for supervisor and biomedical engineering stakeholder demos.

## Pre-demo setup

1. Apply migrations through `00014_memis2_rls_and_refresh.sql`.
2. Run seed sequence including `11_post_upgrade_baseline.sql`.
3. Start app and log in as `admin`.
4. Navigate to `/dashboard/analytical`.

## Demo flow (happy path)

1. **Analytical Dashboard**
   - Show KPI cards, chart cards, alerts, and maintenance burden overview.
2. **Work Order Dashboard**
   - Open `/dashboard/work-orders`.
   - Show total requests, completed/open/overdue summaries, and tracking table.
3. **Requests Hub**
   - Open `/requests`.
   - Demonstrate request categories (installation, procurement, training, maintenance, calibration, disposal).
4. **Procurement Tracking**
   - Open `/procurement`.
   - Create a procurement request and show it appears in pipeline table.
5. **Helpdesk Escalation**
   - Open `/helpdesk`.
   - Explain unresolved escalations and follow-up visibility.
6. **Decision Support Center**
   - Open `/decision-support`.
   - Show:
     - what-to-fix-next ranking
     - explainable equipment health score
     - clinical readiness by department
     - capacity vs backlog
   - Click **Refresh Snapshots** and confirm data refresh flow.
7. **Offline Technician Flow**
   - Open a work order detail.
   - Queue offline action, then sync queue.
   - Explain retry behavior and telemetry logging.

## Exception path checks (high-value)

- Submit maintenance request with too-short fault description -> validation warning.
- Try duplicate equipment code -> duplicate guardrail rejection.
- Introduce failed sync simulation (network/API error) -> queue item retained with retry metadata.

## Demo completion criteria

- All major hub routes load and are navigable.
- Decision-support views are populated and explainable.
- Offline queue visibly supports pending + sync + failed retry behavior.
- Platform shows MEMIS 2.0 coverage + advanced decision support differentiation.
