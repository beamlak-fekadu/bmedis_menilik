import {
  CopilotActionDraftSchema,
  type CopilotActionDraft,
  type CopilotActionField,
  type CopilotActionKind,
  type CopilotActionExecutionMode,
  type CopilotActionRiskLevel,
} from '@/types/copilot-actions';
import type {
  CapabilityId,
  ChatModuleContext,
  UserChatProfile,
} from '@/types/chatbot';
import {
  canCreateCopilotDraft,
  canReadCopilotDepartment,
  getCopilotRoleCategory,
} from './copilot-rbac';

// Heuristic intent matching for action draft proposals.
// The copilot suggests drafts only when the user message clearly intends one.
// Drafts are PROPOSALS — server validation + user confirmation still gate execution.
const MAINTENANCE_INTENT_PATTERNS = [
  /\b(?:create|request|log|file|open|submit|draft|report|raise)\s+(?:a\s+)?(?:maintenance|repair|corrective|fault|issue|problem)\b/i,
  /\bhelp me (?:report|file|submit|raise)\b.*\b(?:problem|issue|fault|maintenance|repair)\b/i,
  /\b(?:create|request|file|submit|draft|raise)\b.*\b(?:maintenance request|corrective request|repair request)\b/i,
];
const CALIBRATION_INTENT_PATTERNS = [
  /\b(?:create|request|schedule|draft|raise|submit)\s+(?:a\s+)?calibration\b/i,
];
const TRAINING_INTENT_PATTERNS = [
  /\b(?:request|need|schedule|draft)\s+(?:training|in[- ]?service|orientation)\b/i,
  /\btraining\s+(?:on|for|request)\b/i,
];
const REORDER_INTENT_PATTERNS = [
  /\b(?:create|draft|submit|request|raise|prepare)\b.*\b(?:reorder|re-order|restock|procurement|purchase|procure)\b/i,
  /\b(?:reorder|re-order|restock|procure|purchase)\b/i,
];
const MAINTENANCE_NOTE_PATTERNS = [
  /\b(?:log|record|add|draft)\s+(?:a\s+)?(?:maintenance|service|repair|inspection)\s+(?:note|event|entry)\b/i,
  /\b(?:event note|service note|maintenance log)\b/i,
];
const CLOSURE_NOTE_PATTERNS = [
  /\b(?:closure|completion|hand[- ]?off|wrap[- ]?up)\s+note\b/i,
  /\b(?:close|complete|finish)\s+(?:the\s+)?work\s+order\b/i,
];
const DEPARTMENT_REPORT_PATTERNS = [
  /\b(?:report|raise|file|submit|escalate)\s+(?:a\s+)?(?:problem|issue|fault|concern)\b/i,
  /\bproblem\s+with\s+(?:the\s+)?(?:equipment|asset|device|machine)\b/i,
];

const SUMMARY_INTENT_PATTERNS = [
  /\b(?:write|draft|prepare|copy|compose|rewrite)\b.*\b(?:summary|note|update|brief|director|management)\b/i,
  /\bmake this (?:shorter|clearer|more formal)\b/i,
];
const OPEN_RECORD_PATTERNS = [
  /\b(?:open|show|take me to|go to)\b.*\b(?:asset|record|evidence|profile)\b/i,
  /\bopen the evidence\b/i,
];

interface DraftBuildContext {
  profile: UserChatProfile;
  capability: CapabilityId;
  message: string;
  moduleContext?: ChatModuleContext;
  contextRefs?: { equipmentId?: string; workOrderId?: string; departmentId?: string };
  evidenceSignals: string[];
}

function randomId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  // Server runtime fallback — node always has crypto, but be safe.
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((rx) => rx.test(text));
}

function pickRoleRequired(roles: string[]): string[] {
  const filtered = roles.filter(Boolean);
  return filtered.slice(0, 8);
}

function clean(value: string | undefined | null, maxLen = 600) {
  if (!value) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, maxLen);
}

function safeDraft(input: Partial<CopilotActionDraft> & {
  kind: CopilotActionKind;
  title: string;
  description: string;
  executionMode: CopilotActionExecutionMode;
  riskLevel: CopilotActionRiskLevel;
}): CopilotActionDraft | null {
  const candidate: CopilotActionDraft = {
    id: input.id ?? randomId(input.kind),
    kind: input.kind,
    title: input.title.slice(0, 160),
    description: input.description.slice(0, 600),
    roleRequired: input.roleRequired ?? [],
    riskLevel: input.riskLevel,
    executionMode: input.executionMode,
    payload: input.payload ?? {},
    fields: input.fields ?? [],
    evidenceUsed: input.evidenceUsed ?? [],
    sourceRoute: input.sourceRoute,
    contextRefs: input.contextRefs ?? {},
    validationWarnings: input.validationWarnings ?? [],
    blockedReason: input.blockedReason,
    confirmationRequired: input.confirmationRequired ?? true,
    createdAt: input.createdAt ?? new Date().toISOString(),
    primaryRoute: input.primaryRoute,
    primaryRouteLabel: input.primaryRouteLabel,
  };
  const parsed = CopilotActionDraftSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function deriveDescription(message: string, fallback: string) {
  const text = clean(message, 600);
  if (!text) return fallback;
  // Avoid copying raw user input that contains anything that looks like SQL or HTML.
  if (/<[a-z][^>]*>/i.test(text) || /;\s*(?:drop|delete|update)\s+/i.test(text)) return fallback;
  return text;
}

function buildMaintenanceRequestDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!canCreateCopilotDraft(ctx.profile, 'maintenance_request')) return null;
  if (!matchesAny(ctx.message, MAINTENANCE_INTENT_PATTERNS)) return null;
  const assetId = ctx.contextRefs?.equipmentId ?? ctx.moduleContext?.selectedRecordId;
  const fields: CopilotActionField[] = [
    { name: 'fault_description', label: 'Reported fault', value: clean(ctx.message, 600) ?? '', editable: true, required: true,
      helpText: 'Edit before submitting. Server requires at least 10 characters.' },
    { name: 'urgency', label: 'Urgency', value: 'medium', editable: true, required: true,
      helpText: 'low / medium / high / critical' },
    { name: 'reported_condition', label: 'Reported condition', value: 'needs_repair', editable: true, required: false,
      helpText: 'functional_issue / needs_repair / non_functional' },
  ];
  if (assetId) {
    fields.unshift({ name: 'asset_id', label: 'Asset ID', value: assetId, editable: false, required: true });
  }
  const warnings: string[] = [];
  if (!assetId) warnings.push('No asset is currently linked — pick one before confirming.');
  const evidence = ctx.evidenceSignals.length ? ctx.evidenceSignals.slice(0, 6) : [];
  if (ctx.moduleContext?.selectedRecordLabel) evidence.unshift(`Selected record: ${ctx.moduleContext.selectedRecordLabel}`);
  return safeDraft({
    kind: 'maintenance_request_create',
    title: 'Draft corrective maintenance request',
    description: 'Prepare a corrective maintenance request from your conversation. You will review and confirm before submission.',
    riskLevel: 'medium',
    executionMode: 'confirm_then_execute',
    fields,
    payload: {
      asset_id: assetId ?? null,
      fault_description: clean(ctx.message, 600) ?? '',
      urgency: 'medium',
      reported_condition: 'needs_repair',
      reported_condition_source: 'copilot',
    },
    evidenceUsed: evidence,
    contextRefs: { assetId, departmentId: ctx.contextRefs?.departmentId },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    validationWarnings: warnings,
    roleRequired: pickRoleRequired(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user']),
    primaryRoute: '/maintenance/requests/new?source=copilot',
    primaryRouteLabel: 'Open full request form',
  });
}

function buildCalibrationRequestDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!canCreateCopilotDraft(ctx.profile, 'calibration_request')) return null;
  if (!matchesAny(ctx.message, CALIBRATION_INTENT_PATTERNS)) return null;
  const assetId = ctx.contextRefs?.equipmentId ?? ctx.moduleContext?.selectedRecordId;
  const warnings = assetId ? [] : ['No asset is currently linked — pick one before confirming.'];
  return safeDraft({
    kind: 'calibration_request_create',
    title: 'Draft calibration request',
    description: 'Prepare a calibration request linked to this asset.',
    riskLevel: 'low',
    executionMode: 'confirm_then_execute',
    fields: [
      { name: 'asset_id', label: 'Asset ID', value: assetId ?? '', editable: false, required: true },
      { name: 'urgency', label: 'Urgency', value: 'medium', editable: true, required: true },
      { name: 'notes', label: 'Notes', value: clean(ctx.message, 400) ?? '', editable: true, required: false },
    ],
    payload: {
      asset_id: assetId ?? null,
      urgency: 'medium',
      notes: clean(ctx.message, 400) ?? null,
    },
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    contextRefs: { assetId },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    validationWarnings: warnings,
    roleRequired: pickRoleRequired(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user']),
    primaryRoute: '/calibration?source=copilot',
    primaryRouteLabel: 'Open calibration module',
  });
}

function buildTrainingRequestDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!canCreateCopilotDraft(ctx.profile, 'training_request')) return null;
  if (!matchesAny(ctx.message, TRAINING_INTENT_PATTERNS)) return null;
  const assetId = ctx.contextRefs?.equipmentId ?? ctx.moduleContext?.selectedRecordId;
  return safeDraft({
    kind: 'training_request_create',
    title: 'Draft training request',
    description: 'Prepare a training request for this equipment or category.',
    riskLevel: 'low',
    executionMode: 'confirm_then_execute',
    fields: [
      { name: 'asset_id', label: 'Asset ID', value: assetId ?? '', editable: false, required: false,
        helpText: 'Optional — leave blank for category-level training.' },
      { name: 'training_type', label: 'Training type', value: 'equipment_operation', editable: true, required: true },
      { name: 'description', label: 'Description', value: clean(ctx.message, 400) ?? '', editable: true, required: true,
        helpText: 'Server requires at least 10 characters.' },
    ],
    payload: {
      asset_id: assetId ?? null,
      training_type: 'equipment_operation',
      description: clean(ctx.message, 400) ?? '',
    },
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    contextRefs: { assetId, departmentId: ctx.contextRefs?.departmentId },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    roleRequired: pickRoleRequired(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user']),
    primaryRoute: '/training?source=copilot',
    primaryRouteLabel: 'Open training module',
  });
}

function buildReorderDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!canCreateCopilotDraft(ctx.profile, 'procurement_request')) return null;
  if (!matchesAny(ctx.message, REORDER_INTENT_PATTERNS)) return null;
  const justification = clean(ctx.message, 400) ?? 'Reorder requested via copilot draft';
  return safeDraft({
    kind: 'reorder_request_create',
    title: 'Draft procurement request',
    description: 'Prepare a procurement request based on your conversation. Server requires at least 15 characters of justification.',
    riskLevel: 'medium',
    executionMode: 'confirm_then_execute',
    fields: [
      { name: 'title', label: 'Title', value: 'Reorder request', editable: true, required: true },
      { name: 'justification', label: 'Justification', value: justification, editable: true, required: true,
        helpText: 'At least 15 characters.' },
      { name: 'priority', label: 'Priority', value: 'medium', editable: true, required: false },
    ],
    payload: {
      title: 'Reorder request',
      justification,
      priority: 'medium',
    },
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    contextRefs: { departmentId: ctx.contextRefs?.departmentId },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    validationWarnings: ['Procurement approval is online-only and not part of this draft.'],
    roleRequired: pickRoleRequired(['developer', 'admin', 'bme_head', 'store_user', 'technician']),
    primaryRoute: '/procurement?source=copilot',
    primaryRouteLabel: 'Open procurement module',
  });
}

function buildMaintenanceEventNoteDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!canCreateCopilotDraft(ctx.profile, 'work_order_note')) return null;
  if (!matchesAny(ctx.message, MAINTENANCE_NOTE_PATTERNS)) return null;
  const workOrderId = ctx.contextRefs?.workOrderId ?? ctx.moduleContext?.selectedRecordId;
  const assetId = ctx.contextRefs?.equipmentId;
  if (!workOrderId && !assetId) return null;
  const note = clean(ctx.message, 600) ?? '';
  return safeDraft({
    kind: 'maintenance_event_note',
    title: 'Draft maintenance event note',
    description: 'Prepare a maintenance event note for an existing work order or asset.',
    riskLevel: 'low',
    executionMode: 'confirm_then_execute',
    fields: [
      { name: 'work_order_id', label: 'Work order ID', value: workOrderId ?? '', editable: false, required: false },
      { name: 'asset_id', label: 'Asset ID', value: assetId ?? '', editable: false, required: true },
      { name: 'event_type', label: 'Event type', value: 'inspection', editable: true, required: true },
      { name: 'notes', label: 'Note', value: note, editable: true, required: true },
    ],
    payload: {
      work_order_id: workOrderId ?? null,
      asset_id: assetId ?? null,
      event_type: 'inspection',
      notes: note,
    },
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    contextRefs: { assetId, workOrderId },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    roleRequired: pickRoleRequired(['developer', 'admin', 'bme_head', 'technician']),
    primaryRoute: workOrderId ? `/maintenance/work-orders/${workOrderId}` : undefined,
    primaryRouteLabel: workOrderId ? 'Open work order' : undefined,
  });
}

function buildWorkOrderClosureNoteDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!canCreateCopilotDraft(ctx.profile, 'work_order_note')) return null;
  if (!matchesAny(ctx.message, CLOSURE_NOTE_PATTERNS)) return null;
  const workOrderId = ctx.contextRefs?.workOrderId ?? ctx.moduleContext?.selectedRecordId;
  if (!workOrderId) return null;
  const note = clean(ctx.message, 600) ?? 'Drafted via copilot. Technician must review before final closure.';
  return safeDraft({
    kind: 'work_order_closure_note',
    title: 'Draft work order closure note',
    description: 'Closure note draft only. Final closure is performed in the work order detail page with the completion modal.',
    riskLevel: 'low',
    executionMode: 'draft_only',
    fields: [
      { name: 'work_order_id', label: 'Work order ID', value: workOrderId, editable: false, required: true },
      { name: 'closure_notes', label: 'Closure note draft', value: note, editable: true, required: true },
    ],
    payload: { work_order_id: workOrderId, closure_notes: note },
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    contextRefs: { workOrderId },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    validationWarnings: ['Copy this draft into the work order completion modal — final closure is online-only and not executed by the copilot.'],
    roleRequired: pickRoleRequired(['developer', 'admin', 'bme_head', 'technician']),
    primaryRoute: `/maintenance/work-orders/${workOrderId}`,
    primaryRouteLabel: 'Open work order',
  });
}

function buildDepartmentIssueReportDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  const roleCategory = getCopilotRoleCategory(ctx.profile);
  if (!['department_head', 'department_user'].includes(roleCategory)) return null;
  if (!matchesAny(ctx.message, DEPARTMENT_REPORT_PATTERNS) && !matchesAny(ctx.message, MAINTENANCE_INTENT_PATTERNS)) return null;
  // Department issue reports are corrective maintenance requests scoped to the department.
  if (!canReadCopilotDepartment(ctx.profile, ctx.profile.departmentId ?? null)) return null;
  const assetId = ctx.contextRefs?.equipmentId ?? ctx.moduleContext?.selectedRecordId;
  return safeDraft({
    kind: 'department_issue_report',
    title: 'Draft department equipment problem report',
    description: 'Send a corrective maintenance request scoped to your department.',
    riskLevel: 'medium',
    executionMode: 'confirm_then_execute',
    fields: [
      { name: 'asset_id', label: 'Asset ID', value: assetId ?? '', editable: false, required: true },
      { name: 'fault_description', label: 'Issue description', value: clean(ctx.message, 600) ?? '', editable: true, required: true,
        helpText: 'Server requires at least 10 characters.' },
      { name: 'urgency', label: 'Urgency', value: 'medium', editable: true, required: true },
    ],
    payload: {
      asset_id: assetId ?? null,
      fault_description: clean(ctx.message, 600) ?? '',
      urgency: 'medium',
      reported_condition: 'needs_repair',
      reported_condition_source: 'copilot',
    },
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    contextRefs: { assetId, departmentId: ctx.profile.departmentId ?? undefined },
    sourceRoute: ctx.moduleContext?.route ?? ctx.moduleContext?.pathname,
    validationWarnings: assetId ? [] : ['No asset is currently linked.'],
    roleRequired: pickRoleRequired(['department_head', 'department_user']),
    primaryRoute: '/maintenance/requests/new?source=copilot',
    primaryRouteLabel: 'Open full request form',
  });
}

function buildCopyManagementSummaryDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  if (!matchesAny(ctx.message, SUMMARY_INTENT_PATTERNS)) return null;
  return safeDraft({
    kind: 'copy_summary',
    title: 'Copy management note draft',
    description: 'Copy a draft summary suitable for management updates. No record is created.',
    riskLevel: 'low',
    executionMode: 'draft_only',
    evidenceUsed: ctx.evidenceSignals.slice(0, 4),
    fields: [
      { name: 'summary', label: 'Summary', value: clean(deriveDescription(ctx.message, 'Hospital operations summary'), 600) ?? '', editable: true, required: true },
    ],
    payload: { summary: deriveDescription(ctx.message, 'Hospital operations summary') },
    contextRefs: {},
    roleRequired: [],
    confirmationRequired: false,
  });
}

function buildOpenRecordDraft(ctx: DraftBuildContext): CopilotActionDraft | null {
  // Convenience open-record draft when the user references a specific asset/work order.
  const assetId = ctx.contextRefs?.equipmentId ?? ctx.moduleContext?.selectedRecordId;
  if (!assetId) return null;
  if (!matchesAny(ctx.message, OPEN_RECORD_PATTERNS)) return null;
  if (ctx.moduleContext?.selectedRecordType !== 'equipment_asset' && !ctx.contextRefs?.equipmentId) return null;
  return safeDraft({
    kind: 'open_record',
    title: 'Open asset profile',
    description: 'Open the exact asset profile in the equipment module.',
    riskLevel: 'low',
    executionMode: 'link_only',
    fields: [],
    payload: { asset_id: assetId },
    evidenceUsed: [],
    contextRefs: { assetId },
    roleRequired: [],
    confirmationRequired: false,
    primaryRoute: `/equipment/${assetId}`,
    primaryRouteLabel: 'Open asset profile',
  });
}

export function buildActionDraftsFromContext(ctx: DraftBuildContext): CopilotActionDraft[] {
  const drafts: CopilotActionDraft[] = [];
  const tryAdd = (draft: CopilotActionDraft | null) => {
    if (draft) drafts.push(draft);
  };
  // Order matters — prefer more specific/department-scoped actions first.
  tryAdd(buildDepartmentIssueReportDraft(ctx));
  tryAdd(buildMaintenanceRequestDraft(ctx));
  tryAdd(buildMaintenanceEventNoteDraft(ctx));
  tryAdd(buildWorkOrderClosureNoteDraft(ctx));
  tryAdd(buildCalibrationRequestDraft(ctx));
  tryAdd(buildTrainingRequestDraft(ctx));
  tryAdd(buildReorderDraft(ctx));
  tryAdd(buildCopyManagementSummaryDraft(ctx));
  tryAdd(buildOpenRecordDraft(ctx));
  // Dedupe by kind — only one draft per kind in the response.
  const seen = new Set<CopilotActionKind>();
  const unique: CopilotActionDraft[] = [];
  for (const draft of drafts) {
    if (seen.has(draft.kind)) continue;
    seen.add(draft.kind);
    unique.push(draft);
    if (unique.length >= 4) break;
  }
  return unique;
}

export function isOfflineCapableDraft(kind: CopilotActionKind): boolean {
  return (
    kind === 'maintenance_request_create' ||
    kind === 'maintenance_event_note' ||
    kind === 'calibration_request_create' ||
    kind === 'training_request_create' ||
    kind === 'reorder_request_create' ||
    kind === 'department_issue_report'
  );
}
