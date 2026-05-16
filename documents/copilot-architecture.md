# BMERMS Copilot Architecture

Last updated: 2026-05-16

## Current Pipeline

The copilot is built around `/api/chat`. The route authenticates the user, resolves the linked profile and all assigned roles, persists the user message, and calls `orchestrateAssistantResponse()` in `src/services/chatbot/assistant-orchestrator.ts`.

The orchestrator performs classification, entity resolution, role-scoped context retrieval, safety evaluation, prompt construction, Gemini generation, provider-output normalization, deterministic fallback, telemetry logging, usage logging, memory updates, and final `AssistantContent` validation.

## Role Behavior And Scope

Copilot role helpers live in `src/services/chatbot/copilot-rbac.ts`. They map the final 8 roles:

- `developer`: full system visibility and developer diagnostics.
- `admin`: broad operational visibility without developer-only raw internals.
- `bme_head`: broad operational command and decision support.
- `technician`: assigned work, safe troubleshooting, and technician context where allowed.
- `store_user`: logistics, stock, procurement, and blocker context only.
- `department_head`: department-scoped readiness, equipment, requests, compliance, and work status.
- `department_user`: department-scoped request/status help.
- `viewer`: read-only executive oversight.

Users may have multiple roles. Helpers choose the broadest safe read category, but department-scoped helpers still require department match before exposing department records. Chat UI does not expose raw routing/tool/provider traces by default.

## Gemini Provider Flow

The provider is `src/services/chatbot/providers/gemini-provider.ts`, using Gemini through the OpenAI-compatible chat completions API. It sends JSON mode for structured capabilities and plain text mode for short intro/general responses.

The app never logs API keys. Raw provider output is not logged by default. Controlled raw debug remains behind `CHAT_DEBUG_RAW_PROVIDER=true`.

## Robust Output Parsing

`src/services/chatbot/assistant-response-pipeline.ts` always returns a schema-safe `AssistantContent`.

Parser recovery handles:

- markdown fenced JSON
- strict JSON strings
- JSON embedded in surrounding text
- common safe repairs such as trailing commas and smart quotes
- object/scalar shape mismatches
- empty, HTML/error-like, partial, or plain-text output

Parser metadata is attached under provider metadata:

- `parserStrategy`
- `parserRecoveryUsed`
- `parserFailureReason`
- `rawContentLength`
- `structuredValidationPassed`
- `deterministicFallbackUsed`

If provider output fails but retrieved system context exists, the orchestrator uses `buildDeterministicStructuredFallback()` to answer from validated context. If both provider and context are unavailable, it returns a limited AI-unavailable response.

## App-Tracked Gemini Usage

Usage is tracked in `copilot_usage_events` from migration `00047_copilot_usage_tracking.sql`.

This is app-tracked Gemini usage: requests made by BMERMS to Gemini. It is not the Google AI Studio billing dashboard. If Gemini returns token usage metadata, the app stores provider-reported token fields. If not, it estimates tokens with a documented approximation of one token per four characters and marks the row as `estimated`.

Limits are configured in `src/services/chatbot/usage-limits.ts`:

- `COPILOT_DAILY_REQUEST_LIMIT_PER_USER`
- `COPILOT_DAILY_TOKEN_LIMIT_PER_USER`
- `COPILOT_MONTHLY_TOKEN_LIMIT_GLOBAL`
- `COPILOT_SOFT_WARNING_PERCENT`
- `COPILOT_HARD_LIMIT_ENABLED`

Hard blocking is off unless `COPILOT_HARD_LIMIT_ENABLED=true`.

## Diagnostics

Developer Lab includes `AI Copilot Diagnostics`:

- provider configured status
- smoke test
- model
- requests/tokens today
- provider failures
- fallback events
- parser recoveries
- deterministic fallbacks
- blocked requests
- top capabilities
- role usage
- recent provider events
- recent telemetry detail

Actions live in `src/actions/copilot-diagnostics.actions.ts`.

## Safety And Integrity Rules

- No fake metrics, counts, statuses, work orders, stock, or usage.
- No exact Google Studio billing usage claims.
- No mutation execution in Phase 1.
- Unsafe internal repair, bypass, board-level, service-mode, and model-specific calibration instructions are blocked or limited.
- Department roles are scoped to their own department.
- Store users do not receive maintenance execution actions.
- Viewers are read-only.
- Developer raw diagnostics are gated.

## Phase 1 Implemented

- Central copilot RBAC helpers.
- Role-scoped task loaders and context checks.
- Hardened provider parser and metadata.
- Deterministic structured fallback for provider/parser failures.
- App-tracked Gemini usage and configurable soft/hard limits.
- AssistantPanel usage status.
- Developer Lab Copilot Diagnostics.
- Added planned/fallback capabilities for QR, offline sync, reports, metric debug, copilot diagnostics, and usage status.

## Phase 2 Page Awareness

Phase 2 adds a client-side context bridge at `src/components/assistant/AssistantPageContextBridge.tsx`. Pages register bounded context into `AssistantProvider`, including module/page labels, route, selected record identity, active tab/filter/search, visible counts, page summaries, evidence links, QR token hints, offline queue hints, and page-specific quick prompts.

The bridge intentionally does not send table rows or sensitive payloads to the model. It sends lightweight context only. Server-side tools still fetch authoritative records using RBAC and RLS.

Covered page families include:

- Command Center role views
- Equipment list and equipment detail
- Maintenance list, maintenance request detail, and work order detail
- Requests Hub
- PM, calibration, spare parts, logistics, procurement, training, replacement, disposal, alerts, calendar, reports, report detail, offline sync
- QR coverage, QR scan history, QR field scan landing
- Developer Lab

Role-specific quick prompts now combine page prompts, role prompts, and module prompts in `AssistantPanel`.

## Formal Tool Contracts

Formal read-only tool metadata lives in:

- `src/services/chatbot/tools/tool-types.ts`
- `src/services/chatbot/tools/tool-registry.ts`
- `src/services/chatbot/tools/tool-executor.ts`
- `src/services/chatbot/route-link-builder.ts`

Tools define name, category, read/draft/write classification, allowed roles, required context, source tables, max rows, return shape, failure behavior, and evidence labels. The executor validates role permission and required context before any query, returns `deniedReason` instead of throwing where possible, and returns evidence signals, source tables, warnings, and exact route links.

Phase 2 tools are read-only. Developer diagnostic tool names are registered, but diagnostic execution remains gated to developer and smoke-test execution stays in the Developer Lab server action.

## Evidence And Links

`AssistantContent` now supports explicit:

- `evidence_used`
- `links`
- `limitations`
- `data_freshness`
- `source_tables`

The response pipeline, deterministic fallback, UI message card, and copy formatting all preserve these fields. Links are rendered as safe Next.js links/buttons; raw HTML is never rendered.

## QR And Offline Integration

QR pages register QR module context, selected equipment, QR label status, role category hints, and exact equipment/QR links. Formal tools include `read_qr_asset_context` and `read_qr_scan_evidence`; scan evidence is operational/developer scoped.

Offline pages and offline-capable work order pages register queue status and offline route hints. Formal tools include `read_offline_sync_summary`; non-operational users are scoped to their own offline events where server data is queried.

## Phase 3 Action Drafts And Final Hardening

Phase 3 adds review-before-submit action drafts, role-scoped server execution, offline queueing, audit logging, and final usage hardening.

### Action draft model
- `src/types/copilot-actions.ts` defines `CopilotActionKind`, `CopilotActionDraft`, `CopilotActionResult`, and the strict Zod schema used at every boundary.
- Kinds:
  - `maintenance_request_create`
  - `calibration_request_create`
  - `training_request_create`
  - `reorder_request_create`
  - `maintenance_event_note`
  - `work_order_closure_note` (draft-only)
  - `department_issue_report`
  - `open_record`
  - `open_report`
  - `copy_summary`
  - `offline_queue_action`
- Execution modes: `link_only`, `draft_only`, `confirm_then_execute`, `online_only`, `offline_capable`.
- Drafts carry a sanitized payload, an editable/readonly field set, evidence used, validation warnings, role required, and a content-hash-free id. Server re-validates everything; raw LLM text is never trusted as payload.

### Draft generation
- `src/services/chatbot/action-draft-service.ts` runs server-side and is called by the orchestrator after the assistant payload is normalized.
- Drafts are proposed only when the user message clearly matches an intent (regex-based heuristics) AND `canCreateCopilotDraft()` permits the active role/draft type. Viewer never receives mutation drafts.
- Department roles only receive department-scoped drafts; the asset/department on the draft is locked to the actor's department.
- At most 4 drafts per response and one per kind.

### Confirmation UI
- `src/components/assistant/CopilotActionCard.tsx` renders draft cards inside `AssistantMessageCard`. Each card shows risk badge, execution-mode badge, validation warnings, evidence used, and clear Open/Copy/Review-and-submit affordances.
- `CopilotActionConfirmDialog.tsx` opens a real Modal listing readonly linked context and editable fields. Editable fields are limited by the draft definition; the dialog cannot override readonly context such as asset IDs or department IDs.
- Server still validates fields again — the dialog is review-only, not authority.

### Server executor
- `src/actions/copilot-actions.actions.ts` exposes `executeCopilotActionDraftAction(input)`.
- It re-authenticates the user, re-checks role via `canCreateCopilotDraft`, re-checks department scope for `department_head`/`department_user`, refuses `draft_only`/`link_only`, and merges only declared-editable overrides as primitive values.
- It calls existing server actions (`createMaintenanceRequestAction`, `createCalibrationRequestAction`, `createTrainingRequestAction`, `createProcurementRequestAction`, `createMaintenanceEventAction`) — no business rule is duplicated.
- Duplicate-open-request responses are surfaced as `status: 'conflict'` with an exact existing record link.
- Every successful execution writes an `audit_logs` row with `action='copilot.draft.executed.<kind>'`, the chat session id, message id, draft id, role category, evidence used, and source route.

### Offline integration
- `src/components/assistant/copilot-offline.ts` maps offline-capable kinds (`maintenance_request_create`, `department_issue_report`, `maintenance_event_note`, `calibration_request_create`, `training_request_create`, `reorder_request_create`) to existing offline `OfflineActionType`s.
- When the browser is offline and the kind is offline-capable, the card's Confirm button queues the draft via `enqueueOfflineAction()` — the same Phase 2/3 IndexedDB queue + sync engine path. The Sync Review Center remains the resolution surface.
- All other kinds (procurement approval, disposal, QR token admin, settings/security, analytics refresh, final closure/assignment, replacement decisions) remain online-only and not queueable.

### Usage hardening
- AssistantPanel now shows a soft warning band when near the configured daily limit, and a hard-stop band when `COPILOT_HARD_LIMIT_ENABLED=true` and the limit is reached. Deterministic local responses still work while the provider is paused.
- Hard-limit handling lives in the orchestrator: the Gemini call is skipped and a `limited_answer` is returned with `usageHardLimited: true` provider metadata. Local intro responses are not counted.

### Developer diagnostics
- The Copilot Diagnostics section in Developer Lab now shows: action drafts executed today, breakdown by draft kind, parser recoveries, fallback rate, blocked-request count, and recent telemetry.
- Action draft execution count is derived from `audit_logs` rows where `action LIKE 'copilot.draft.executed.%'`, scoped to the actor unless the viewer is developer/admin/bme_head.

### Data integrity and security
- Server re-validates draft payload and re-checks role before any write.
- No mutation occurs without user confirmation in the dialog.
- No client-supplied values can change readonly fields like asset id, department id, work order id.
- Procurement/disposal/QR token/user/settings/security/analytics/final closure/assignment/replacement actions are never executable from copilot drafts.
- All actions go through existing server actions, so RLS, capability matrix, duplicate prevention, condition sync, audit logging, and revalidation all apply.

### Tests
Added `src/services/chatbot/__tests__/copilot-action-drafts.test.ts` covering: viewer never gets mutation drafts, BME head gets maintenance request drafts with Zod-valid payload, department user is auto-scoped, technician gets maintenance-event-note draft, store user gets reorder draft, non-mutation intent yields no mutations, and offline capability mapping. The existing 122 chatbot tests still pass (total 129 after Phase 3).

### Honest limitations
- Heuristic draft proposal is regex-based and may miss creative phrasings; users can also start the action from the module page directly.
- The copilot never assigns work orders, closes them finally, or approves procurement/disposal.
- The QR Phase 6 scan log is unchanged; copilot drafts do not write scan rows.
- Browser-level offline behavior (service worker, IndexedDB) was not re-validated in a live browser as part of this pass; manual QA still required.
