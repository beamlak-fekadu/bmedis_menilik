# Final Demo Bugfix Validation

Date: 2026-05-29

## Runtime And Branch Check

- Active repository: `/Users/beamlak/Desktop/bmedis_menilik/bmedis_menilik`
- Current branch: `main`
- Active validation server: `http://localhost:3001`
- Important finding: `localhost:3000` is not this runtime path in the current desktop session.
- Build output still reports `ƒ Proxy (Middleware)`, and the dev server logs show the middleware/proxy layer executing. The QR bug below was not caused by middleware being skipped.

## 1. QR Redirect Validation

Runtime path verified:

- Actual route: `src/app/qr/a/[token]/page.tsx`
- Actual QR token tested: `qra_UcIgOeSYbWuYgNyTdA75V6pc13phMiwO`
- Before fix, the route rendered `QrInvalidState` because unauthenticated RLS hid the matching `equipment_assets` row from `resolveQrLandingAsset`.
- Because the QR route thought the token was not found, the browser-visible login link was plain `/login`, so no `returnTo` was ever preserved.
- The dashboard auth guard now performs unauthenticated redirects from an effect instead of calling `router.push` during render.

Fix verified on `localhost:3001`:

- Opened `http://localhost:3001/qr/a/qra_UcIgOeSYbWuYgNyTdA75V6pc13phMiwO` while logged out.
- Observed QR login screen with link: `/login?returnTo=%2Fqr%2Fa%2Fqra_UcIgOeSYbWuYgNyTdA75V6pc13phMiwO`
- Logged in as `department.user@bmerms-demo.local`.
- Browser landed on the exact QR route: `/qr/a/qra_UcIgOeSYbWuYgNyTdA75V6pc13phMiwO`
- Page rendered asset context for `IPW-0001 · Patient Monitor/Screen`; no rescan was needed.

Deployment URL behavior:

- QR canonical URL generation now falls back to the stable thesis Vercel host `https://bmedis-menilik.vercel.app` when explicit `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` is missing in production.
- The fallback does not use arbitrary Vercel branch URLs.

## 2. Corrective Maintenance Validation

Not re-tested in this focused pass. Previous runtime notes still apply:

- Technician completion UI calls `updateWorkOrderAction`.
- Offline completion replay also calls `updateWorkOrderAction`.
- The intended canonical action updates work order, linked request, equipment state, reliability evidence, analytics, notifications, and revalidations.

Manual acceptance for the full corrective workflow still needs a fresh browser run after the currently requested QR/readiness/Hanna fixes.

## 3. Notification Validation

Not re-tested in this focused pass.

Expected event keys remain:

- `work_order.completed:<workOrderId>`
- `work_order.part_requested:<needId>`
- `work_order.part_issued:<needId>` or `work_order.part_issued:<issueId>`

## 4. Spare-Part Request / Issue Validation

Not re-tested in this focused pass.

Runtime paths previously identified:

- Work-order parts panel calls `declareWorkOrderPartNeededAction`.
- Store stock issue modal calls `createStockIssueAction`.

## 5. Viewer PMC Validation

Not re-tested in this focused pass.

Expected source:

- BME Head PM page and Viewer compliance page use the same live department PM compliance helper based on `pm_schedules`.

## 6. Profile Setup Flicker Validation

Not re-tested in this focused pass.

Expected behavior:

- `Profile Setup Required` appears only after a definite missing profile/role/error state, not during normal profile loading.

## 7. Readiness Opacity Validation

Runtime path verified:

- Actual route: `src/app/(dashboard)/command/page.tsx`
- Actual component: `src/app/(dashboard)/command/_components/CommandCenterInteractive.tsx`
- Browser role: BME Head on `/command`

Fix verified on `localhost:3001`:

- The top readiness explanation now renders with `opacity: 1`, foreground color `rgb(241, 245, 249)`, and visible surface background.
- The inner “Readiness % counts only essential equipment” explanation also renders with `opacity: 1`, foreground color `rgb(241, 245, 249)`, and visible surface background.
- Browser screenshot confirmed both explanations are readable without hover in dark mode.

## 8. Hanna Account Validation

Runtime path verified:

- Actual BME Head command-center workload source: `fetchTechnicianWorkload` from `src/app/(dashboard)/command/_lib/command-center-data`, delegating to `fetchCurrentTechnicianWorkload` in `src/services/metrics/workload.service.ts`.
- Actual UI component: `src/app/(dashboard)/command/_components/WorkloadAssignment.tsx`.

Database before cleanup:

- `hanna.g@menelikii.gov.et`, `Hanna Gebremedhin`, `is_active=true`, `user_id=null`
- `technician@bmedis-menelik.local`, `Hanna Gebremedhin`, `is_active=true`, auth-linked

Database after cleanup:

- Legacy row changed to `removed.hanna.legacy@menelikii.gov.et`, `is_active=false`, `user_id=null`, `job_title=Legacy Biomedical Technician`
- BMEDIS Menelik Hanna stayed active: `technician@bmedis-menelik.local`, auth-linked
- No `technician@bmerms-demo.local` auth user was present to delete in this database.

RLS check:

- Signed in with Supabase anon client as `bme.head@bmerms-demo.local`.
- The technician roster query returned only one active technician row: `technician@bmedis-menelik.local`.
- No RLS error was returned.

Browser result on `localhost:3001`:

- BME Head `/command` → Work Queue & assignment → Technician availability shows one Hanna card.
- No legacy Hanna email appears in the UI.

## 9. Stock Dashboard Validation

Not re-tested in this focused pass.

Expected behavior:

- Store dashboard should not show the fake “3 approved items to issue” card/list.

## 10. Replacement Watchlist Rank Ordering Validation

Runtime path verified:

- Actual BME Head card route: `src/app/(dashboard)/command/page.tsx`
- Source view: `v_replacement_decision`
- Source score/rank table behind the view: `replacement_priority_scores`
- Full Command Center ranking route: `src/app/(dashboard)/command/drilldown/[type]/page.tsx`
- Replacement module ranking surface: `src/app/(dashboard)/replacement/page.tsx`

Fix applied:

- Sorting is guarded in both SQL and TypeScript for the Command Center watchlist and Command Center replacement drilldown.
- SQL query order: `replacement_rank ASC NULLS LAST`, then `replacement_priority_index DESC`, then `asset_code ASC`.
- TypeScript order before display limiting: stored global `rank` / `replacement_rank` ascending when present, then RPI descending via `rpi` / `replacement_priority_index` / `priority_index`, then asset code/name/id ascending.
- The BME Head top-five card still displays the stored global rank badge. It does not renumber rows locally.

Before behavior:

- `/command` ordered replacement rows by RPI only, filtered candidates, and then applied `slice(0, 5)`.
- Assets with equal or effectively tied RPI values could render stored ranks in a confusing sequence such as `1, 5, 3, 2, 6`.

After behavior:

- `/command` sorts eligible replacement candidates by global rank before applying the top-five limit.
- If ranks 1–5 are all eligible, the watchlist should display `1, 2, 3, 4, 5`.
- If an eligible rank is excluded by the candidate threshold, the watchlist remains sorted, for example `1, 2, 3, 5, 6`.
- RPI badges and key driver text are unchanged.

Manual validation step:

- Sign in as BME Head and open `/command`.
- In “Replacement watchlist — top 5 candidates,” confirm the rank badges are ascending.
- Click “Full ranking” and confirm the replacement ranking opens and remains ordered by stored rank.

## Exact Commands Run

```bash
pwd
git branch --show-current
rg -n "NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" .env.local
npm run dev
node -e "<service-role Supabase query for Hanna profiles and QR-token assets>"
node -e "<service-role exact legacy Hanna cleanup and before/after print>"
node -e "<anon BME Head RLS workload roster query>"
npm run test:system-fix
npm run build
npx tsx --test src/utils/decision-support/__tests__/replacement-ranking.test.ts
```

Browser checks run on `localhost:3001`:

- Opened logged-out QR route and inspected visible login link.
- Submitted the QR login form with department-user credentials.
- Confirmed final URL and asset text on the QR page.
- Logged in as BME Head.
- Confirmed readiness explanation contrast from computed browser styles.
- Confirmed Work Queue & assignment shows a single Hanna technician availability card.
- Re-ran `npm run build` after moving the dashboard unauthenticated redirect into an effect.
- Confirmed BME Head `/command` replacement watchlist shows rank badges `1, 2, 3, 4, 5`, keeps `RPI 57/100`, and exposes `/command/drilldown/replacement` as the Full ranking link.
- Confirmed `/command/drilldown/replacement` opens to “Lifecycle Decisions” with replacement candidate rows.
- Confirmed `/replacement` opens to “Replacement Priority” for the BME Head role.

## Results

- `npm run test:system-fix`: passed, 615 tests.
- `npm run build`: passed.
- `npx tsx --test src/utils/decision-support/__tests__/replacement-ranking.test.ts`: passed, 2 tests.
- QR manual browser acceptance on `localhost:3001`: passed.
- Readiness explanation manual browser visibility on `localhost:3001`: passed.
- Hanna duplicate workload manual browser check on `localhost:3001`: passed.
- Replacement watchlist manual browser check on `localhost:3001`: passed.
- Replacement page manual browser check on `localhost:3001`: passed.

## Known Limitations

- The full corrective-maintenance completion workflow was not re-run in this focused pass.
- Stock/spare-part notifications, viewer PMC, profile flicker, and stock dashboard were not re-tested in this focused pass.
- Remote Vercel deployment must be redeployed before the QR route/admin resolution and stable Vercel QR base behavior are visible at `https://bmedis-menilik.vercel.app`.
- The real Supabase database row was updated from this run; the migration file was also updated so the same cleanup can be applied to other environments.
