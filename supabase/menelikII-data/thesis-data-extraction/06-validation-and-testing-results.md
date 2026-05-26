# Validation and Testing Results

## Existing Evidence and Checks

| Check | Command | Result | Evidence Source | Thesis Wording |
| --- | --- | --- | --- | --- |
| inspect:menelik | npm run inspect:menelik | Existing report present; inspectedAt 2026-05-26T04:25:02.150Z | inspection-report.json | Workbook structure and source sheet counts were inspected before import. |
| import:menelik:dry-run | npm run import:menelik:dry-run | Existing dry-run report 2026-05-26T09:47:11.120Z; analyticsRefresh=skipped (dry-run) | dry-run-report.json | A dry run normalized the workbook and previewed import counts without DB writes. |
| import:menelik | npm run import:menelik | Existing live import report 2026-05-26T09:49:14.950Z; analyticsRefresh=completed | import-report.json | The Menelik dataset was loaded into the deployment and analytics refresh completed. |
| validate:menelik | npm run validate:menelik | Run during extraction; exit code 0. Verdict PRESENTATION READY; 17 passed, 1 warning, 0 failed. validation-report.json updated at 2026-05-26T12:23:23.385Z. | Current command run + validation-report.json | Post-import validation found the deployment presentation-ready with one warning about legacy demo email profiles. |
| lint | npm run lint | Run during extraction; exit code 0. ESLint completed with no reported errors or warnings. | Current command run | The codebase passed lint during the extraction pass. |
| build | npm run build | Run during extraction; exit code 0. Next.js 16.2.4 compiled successfully, TypeScript finished, and static generation completed 54/54 pages. Warning only: middleware file convention is deprecated in favor of proxy. | Current command run | The production build completed successfully with 54/54 static pages generated. |
| test:chatbot | npm run test:chatbot | Available npm script; not run in this extraction pass. | package.json | Do not claim chatbot test pass unless separately run. |
| test:system-fix | npm run test:system-fix | Available npm script; not run in this extraction pass. | package.json | Do not claim system test pass unless separately run. |

## npm Scripts Available

| Script | Command |
| --- | --- |
| dev | next dev |
| build | next build |
| start | next start |
| lint | eslint |
| test:chatbot | tsx --test src/services/chatbot/__tests__/*.test.ts |
| test:system-fix | tsx --test src/services/chatbot/__tests__/*.test.ts src/services/notifications/__tests__/*.test.ts src/services/metrics/__tests__/*.test.ts src/services/__tests__/*.test.ts src/utils/developer-lab/__tests__/*.test.ts src/utils/maintenance/__tests__/*.test.ts src/utils/analytics/__tests__/*.test.ts src/utils/decision-support/__tests__/*.test.ts src/lib/rbac/__tests__/*.test.ts src/lib/offline/__tests__/*.test.ts src/actions/__tests__/*.test.ts |
| setup:demo-users | tsx scripts/setup-demo-users.ts |
| setup:menelik-users | tsx scripts/setup-menelik-users.ts |
| inspect:menelik | tsx scripts/inspect-menelik-workbook.ts |
| import:menelik:dry-run | tsx scripts/import-menelik-data.ts --dry-run |
| import:menelik | tsx scripts/import-menelik-data.ts |
| validate:menelik | tsx scripts/validate-menelik-data.ts |
| storybook | storybook dev -p 6006 |
| build-storybook | storybook build |

## Validation Report Checks

| Name | Status | Detail |
| --- | --- | --- |
| Equipment assets >= 160 | pass | 170 equipment assets |
| Departments with equipment >= 10 | pass | 13 departments have equipment |
| Condition variety >= 2 | pass | Conditions found: functional, non_functional, decommissioned |
| Work orders >= 10 | pass | 10 work orders |
| PM/PV evidence rows >= 10 | pass | 14 PM schedule/evidence rows |
| Training sessions >= 10 | pass | 12 training sessions |
| No orphaned department FK | pass | 0 assets with invalid department_id |
| No orphaned category FK | pass | 0 assets with invalid category_id |
| Profile department_id valid | pass | All profile department_ids are valid |
| Condition values valid | pass | 0 assets with invalid condition |
| Source-tagged assets | pass | 170 assets tagged with source='menelik_ii_2018ec_import' |
| No duplicate asset codes | pass | No duplicates |
| Asset codes match format {DEPT}-{NNNN} | pass | All codes match pattern |
| Original inventory numbers in notes | pass | 168 assets have original inventory number in notes |
| No demo email profiles | warn | 7 profiles with demo email |
| Menelik role emails exist | pass | 7/7 Menelik emails found in profiles |
| Disposal requests match decommissioned assets | pass | 5 disposal requests for 5 decommissioned assets |
| No disposed_assets from import | pass | 0 disposed_assets rows |

## Warnings / Failures

- Warnings: 1. Detail: No demo email profiles: 7 profiles with demo email.
- Failures: 0.
- Requested extraction-pass checks completed: `npm run validate:menelik`, `npm run lint`, and `npm run build` all exited with code 0.
- Build warning to preserve honestly: Next.js reported the `middleware` file convention is deprecated and recommends `proxy`.
