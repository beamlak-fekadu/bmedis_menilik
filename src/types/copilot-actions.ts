import { z } from 'zod';

export const COPILOT_ACTION_KINDS = [
  'maintenance_request_create',
  'calibration_request_create',
  'training_request_create',
  'reorder_request_create',
  'maintenance_event_note',
  'work_order_closure_note',
  'department_issue_report',
  'open_record',
  'open_report',
  'copy_summary',
  'offline_queue_action',
] as const;

export type CopilotActionKind = typeof COPILOT_ACTION_KINDS[number];

export const COPILOT_ACTION_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type CopilotActionRiskLevel = typeof COPILOT_ACTION_RISK_LEVELS[number];

export const COPILOT_ACTION_EXECUTION_MODES = [
  'link_only',
  'draft_only',
  'confirm_then_execute',
  'online_only',
  'offline_capable',
] as const;
export type CopilotActionExecutionMode = typeof COPILOT_ACTION_EXECUTION_MODES[number];

export const COPILOT_ACTION_RESULT_STATUSES = [
  'proposed',
  'confirmed',
  'executed',
  'queued_offline',
  'blocked',
  'failed',
  'conflict',
] as const;
export type CopilotActionResultStatus = typeof COPILOT_ACTION_RESULT_STATUSES[number];

export const CopilotActionContextRefsSchema = z.object({
  assetId: z.string().max(120).optional(),
  workOrderId: z.string().max(120).optional(),
  departmentId: z.string().max(120).optional(),
  requestId: z.string().max(120).optional(),
  partId: z.string().max(120).optional(),
  reportType: z.string().max(80).optional(),
  qrToken: z.string().max(160).optional(),
});
export type CopilotActionContextRefs = z.infer<typeof CopilotActionContextRefsSchema>;

export const CopilotActionFieldSchema = z.object({
  name: z.string().max(80),
  label: z.string().max(120),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  editable: z.boolean().default(false),
  required: z.boolean().default(false),
  helpText: z.string().max(240).optional(),
});
export type CopilotActionField = z.infer<typeof CopilotActionFieldSchema>;

// Minimal, sanitized payload shape sent server-side.
// Server validates this with strict Zod against the existing server action.
export const CopilotActionPayloadSchema = z.record(
  z.string().max(80),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);
export type CopilotActionPayload = z.infer<typeof CopilotActionPayloadSchema>;

export const CopilotActionDraftSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(COPILOT_ACTION_KINDS),
  title: z.string().max(160),
  description: z.string().max(600),
  roleRequired: z.array(z.string().max(40)).max(8).default([]),
  riskLevel: z.enum(COPILOT_ACTION_RISK_LEVELS),
  executionMode: z.enum(COPILOT_ACTION_EXECUTION_MODES),
  payload: CopilotActionPayloadSchema.default({}),
  fields: z.array(CopilotActionFieldSchema).max(20).default([]),
  evidenceUsed: z.array(z.string().max(240)).max(10).default([]),
  sourceRoute: z.string().max(250).optional(),
  contextRefs: CopilotActionContextRefsSchema.default({}),
  validationWarnings: z.array(z.string().max(240)).max(8).default([]),
  blockedReason: z.string().max(240).optional(),
  confirmationRequired: z.boolean().default(true),
  createdAt: z.string().max(40),
  // Where to send the user after confirmation if no exact record route returned.
  primaryRoute: z.string().max(250).optional(),
  primaryRouteLabel: z.string().max(120).optional(),
});
export type CopilotActionDraft = z.infer<typeof CopilotActionDraftSchema>;

export const CopilotActionResultSchema = z.object({
  status: z.enum(COPILOT_ACTION_RESULT_STATUSES),
  message: z.string().max(600).optional(),
  createdRecordId: z.string().max(120).optional(),
  createdRecordRoute: z.string().max(250).optional(),
  auditId: z.string().max(120).optional(),
  error: z.string().max(600).optional(),
  conflictReason: z.string().max(240).optional(),
  existingRecordId: z.string().max(120).optional(),
  existingRecordRoute: z.string().max(250).optional(),
});
export type CopilotActionResult = z.infer<typeof CopilotActionResultSchema>;

export const CopilotExecuteDraftRequestSchema = z.object({
  draft: CopilotActionDraftSchema,
  sessionId: z.string().max(120).optional(),
  messageId: z.string().max(120).optional(),
  overrides: CopilotActionPayloadSchema.optional(),
});
export type CopilotExecuteDraftRequest = z.infer<typeof CopilotExecuteDraftRequestSchema>;
