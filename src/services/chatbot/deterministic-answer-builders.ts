import type {
  AssistantContent,
  CapabilityId,
  ChatContextRefs,
  ChatDecision,
  ChatEvidence,
  ChatModuleContext,
  ClassifiedRequest,
  UserChatProfile,
} from '@/types/chatbot';
import { getCapabilityResponseDefaults } from './capability-response-defaults';
import { getCopilotRoleCategory } from './copilot-rbac';

type ToolResultLike = {
  ok?: boolean;
  toolName?: string;
  data?: unknown;
  evidenceSignals?: unknown[];
  sourceTables?: unknown[];
  routeLinks?: Array<{ label?: unknown; href?: unknown; type?: unknown }>;
  warnings?: unknown[];
  deniedReason?: unknown;
  staleDataWarning?: unknown;
};

export type DeterministicAnswerParams = {
  capability: CapabilityId;
  decision: ChatDecision;
  profile: UserChatProfile;
  message: string;
  classified?: ClassifiedRequest;
  contextRefs?: ChatContextRefs;
  moduleContext?: ChatModuleContext;
  blocks: Record<string, unknown>;
  evidence: ChatEvidence;
};

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function count(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function sentenceList(items: string[], max = 4) {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, max);
}

function uniqueStrings(items: unknown[], max: number, maxLen = 220) {
  return Array.from(
    new Set(
      items
        .map((item) => text(item).slice(0, maxLen))
        .filter(Boolean)
    )
  ).slice(0, max);
}

function toolResults(blocks: Record<string, unknown>): ToolResultLike[] {
  const trace = asRecord(blocks.formalToolTrace);
  return asRows(trace?.results) as ToolResultLike[];
}

function toolData(blocks: Record<string, unknown>, name: string): unknown {
  return toolResults(blocks).find((result) => result.toolName === name)?.data;
}

function pageContext(blocks: Record<string, unknown>, moduleContext?: ChatModuleContext): ChatModuleContext {
  const fromTool = asRecord(toolData(blocks, 'read_current_page_context'));
  return {
    ...(fromTool ?? {}),
    ...(moduleContext ?? {}),
  } as ChatModuleContext;
}

function routeLinks(blocks: Record<string, unknown>, moduleContext?: ChatModuleContext) {
  const fromBlocks = Array.isArray(blocks.routeLinks) ? blocks.routeLinks : [];
  const fromTools = toolResults(blocks).flatMap((result) => result.routeLinks ?? []);
  const fromPage = moduleContext?.availableEvidenceLinks ?? [];
  const links = [...fromBlocks, ...fromTools, ...fromPage]
    .map((item) => {
      const row = asRecord(item);
      const label = text(row?.label).slice(0, 120);
      const href = text(row?.href).slice(0, 250);
      const type = text(row?.type).slice(0, 60);
      return label && href.startsWith('/') ? { label, href, type: type || undefined } : null;
    })
    .filter(Boolean) as Array<{ label: string; href: string; type?: string }>;

  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function sourceTables(blocks: Record<string, unknown>) {
  const fromBlocks = Array.isArray(blocks.sourceTables) ? blocks.sourceTables : [];
  const fromTools = toolResults(blocks).flatMap((result) => result.sourceTables ?? []);
  return uniqueStrings([...fromBlocks, ...fromTools], 12, 120);
}

function evidenceLabels(params: DeterministicAnswerParams) {
  const { blocks, evidence, moduleContext } = params;
  const equipment = getEquipment(blocks, evidence);
  const workOrder = getWorkOrder(blocks, evidence);
  const page = pageContext(blocks, moduleContext);
  const labels: string[] = [];

  const assetLabel = [text(equipment?.asset_code), text(equipment?.name)].filter(Boolean).join(' - ');
  if (assetLabel) labels.push(`Asset ${assetLabel}`);
  if (workOrder) labels.push(`Work order ${text(workOrder.work_order_number, text(workOrder.id, 'selected work order'))}`);
  if (page.selectedRecordLabel) labels.push(text(page.selectedRecordLabel));
  if (page.pageLabel) labels.push(text(page.pageLabel));

  return uniqueStrings(
    [
      ...labels,
      ...(Array.isArray(blocks.evidenceUsed) ? blocks.evidenceUsed : []),
      ...(evidence.evidenceSignals ?? []),
      ...toolResults(blocks).flatMap((result) => result.evidenceSignals ?? []),
    ],
    8
  );
}

function limitations(blocks: Record<string, unknown>, extra: string[] = []) {
  return uniqueStrings(
    [
      ...extra,
      ...(Array.isArray(blocks.toolWarnings) ? blocks.toolWarnings : []),
      ...toolResults(blocks).flatMap((result) => [
        ...(result.warnings ?? []),
        result.deniedReason,
        result.staleDataWarning,
      ]),
    ],
    6
  );
}

function sanitizeDecision(decision: ChatDecision): ChatDecision {
  return decision === 'refuse' || decision === 'escalate' || decision === 'check_manual' ? 'limited_answer' : decision;
}

function hasRecordData(params: DeterministicAnswerParams) {
  const { blocks, evidence, moduleContext } = params;
  return Boolean(
    getEquipment(blocks, evidence) ||
      getWorkOrder(blocks, evidence) ||
      asRows(blocks.rankedOperationalQueue).length ||
      asRows(blocks.assignedWorkOrders).length ||
      asRows(blocks.overduePm).length ||
      asRows(blocks.recommendationFlags).length ||
      asRows(blocks.lowStockParts).length ||
      asRows(blocks.procurementPipeline).length ||
      asRows(toolData(blocks, 'read_stock_blockers')).length ||
      asRows(toolData(blocks, 'read_procurement_pipeline')).length ||
      asRows(toolData(blocks, 'read_equipment_history')).length ||
      asRows(toolData(blocks, 'read_qr_scan_evidence')).length ||
      asRecord(toolData(blocks, 'read_offline_sync_summary')) ||
      moduleContext?.pageSummary ||
      moduleContext?.visibleCounts ||
      (evidence.evidenceSignals ?? []).length
  );
}

function baseAssistant(
  params: DeterministicAnswerParams,
  patch: Partial<AssistantContent> & { summary: string }
): AssistantContent {
  const defaults = getCapabilityResponseDefaults(params.capability);
  const recordBacked = hasRecordData(params);
  return {
    decision: sanitizeDecision(params.decision),
    title: patch.title ?? defaults.title,
    intelligence_mode: patch.intelligence_mode ?? defaults.intelligence_mode,
    summary: patch.summary.slice(0, 2000),
    key_findings: sentenceList(patch.key_findings ?? [], 8),
    recommended_actions: sentenceList(patch.recommended_actions ?? [], 8),
    priority_reasoning: sentenceList(patch.priority_reasoning ?? [], 8),
    likely_causes: sentenceList(patch.likely_causes ?? [], 6),
    troubleshooting_steps: sentenceList(patch.troubleshooting_steps ?? [], 8),
    maintenance_tips: sentenceList(patch.maintenance_tips ?? [], 8),
    required_tools_or_parts: sentenceList(patch.required_tools_or_parts ?? [], 6),
    actions: sentenceList(patch.actions ?? patch.recommended_actions ?? [], 8),
    insights: sentenceList(patch.insights ?? patch.key_findings ?? [], 8),
    recommendations: sentenceList(patch.recommendations ?? patch.recommended_actions ?? [], 8),
    escalation_guidance: patch.escalation_guidance,
    escalation_recommendation: patch.escalation_recommendation,
    reason_for_limit: patch.reason_for_limit,
    answer_basis: patch.answer_basis ?? (recordBacked ? 'system_data' : 'general_safe_guidance'),
    confidence: patch.confidence ?? (recordBacked ? 'medium' : 'low'),
    escalation_required: Boolean(patch.escalation_required),
    entities_referenced: uniqueStrings(patch.entities_referenced ?? evidenceLabels(params), 10),
    follow_up_suggestions: sentenceList(patch.follow_up_suggestions ?? defaults.follow_up_suggestions, 4),
    proactive_signals: sentenceList(patch.proactive_signals ?? [], 3),
    routing_explanation: sentenceList(patch.routing_explanation ?? [], 8),
    evidence_used: uniqueStrings(patch.evidence_used ?? evidenceLabels(params), 10),
    links: patch.links ?? routeLinks(params.blocks, params.moduleContext),
    limitations: uniqueStrings([...(patch.limitations ?? []), ...limitations(params.blocks)], 6),
    data_freshness: patch.data_freshness ?? (recordBacked ? 'Current scoped BMERMS records and page context.' : undefined),
    source_tables: uniqueStrings(patch.source_tables ?? sourceTables(params.blocks), 12),
    action_drafts: [],
  };
}

function getEquipment(blocks: Record<string, unknown>, evidence: ChatEvidence) {
  return (
    asRecord(toolData(blocks, 'read_equipment_status')) ??
    asRecord(toolData(blocks, 'read_qr_asset_context')) ??
    asRecord(blocks.equipment) ??
    asRecord(evidence.equipment)
  );
}

function getWorkOrder(blocks: Record<string, unknown>, evidence: ChatEvidence) {
  return asRecord(toolData(blocks, 'read_work_order_status')) ?? asRecord(blocks.workOrder) ?? asRecord(evidence.workOrder);
}

function assetName(asset: Record<string, unknown> | null) {
  if (!asset) return 'this asset';
  return [text(asset.asset_code), text(asset.name)].filter(Boolean).join(' - ') || text(asset.id, 'this asset');
}

function summarizeStatusFields(row: Record<string, unknown> | null, fields: string[]) {
  if (!row) return [];
  return fields
    .map((field) => {
      const value = text(row[field]);
      return value ? `${field.replace(/_/g, ' ')}: ${value}` : '';
    })
    .filter(Boolean);
}

function buildOperationalPriorityAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const { blocks, profile } = params;
  const queue = asRows(blocks.rankedOperationalQueue).slice(0, 4);
  const workOrders = asRows(blocks.assignedWorkOrders);
  const overduePm = asRows(blocks.overduePm);
  const flags = asRows(blocks.recommendationFlags);
  const lowStock = asRows(blocks.lowStockParts).length ? asRows(blocks.lowStockParts) : asRows(toolData(blocks, 'read_stock_blockers'));
  const roleCategory = getCopilotRoleCategory(profile);

  if (!queue.length && !workOrders.length && !overduePm.length && !flags.length && !lowStock.length) return null;

  const first = queue[0];
  const firstLabel = text(first?.label, workOrders[0] ? `work order ${text(workOrders[0].work_order_number, text(workOrders[0].id))}` : 'the highest-risk open signal');
  const summary =
    roleCategory === 'viewer'
      ? `Based on current system records, the main management concern is ${firstLabel}. I found operational pressure from ${workOrders.length} active work order(s), ${overduePm.length} overdue PM item(s), and ${flags.length} recommendation flag(s).`
      : `Based on current system records, start with ${firstLabel}. After that, review the remaining active work, overdue PM, and any stock blockers that can delay service restoration.`;

  const reasoning = queue.length
    ? queue.map((item) => `${text(item.label, 'Priority item')} ${item.score != null ? `(score ${text(item.score)})` : ''}`.trim())
    : [
        workOrders.length ? `${workOrders.length} active work order(s) are in scope.` : '',
        overduePm.length ? `${overduePm.length} PM item(s) are overdue.` : '',
        flags.length ? `${flags.length} recommendation flag(s) are open.` : '',
        lowStock.length ? `${lowStock.length} stock blocker(s) may delay work.` : '',
      ].filter(Boolean);

  const actions =
    roleCategory === 'store_user'
      ? [
          lowStock.length ? 'Start with stockout and low-stock rows that are linked to active work.' : 'Review stock blockers before procurement follow-up.',
          'Open the linked evidence instead of creating maintenance execution work from the store role.',
        ]
      : [
          queue[0] ? `Open ${text(queue[0].label)} and confirm owner, blocker, and next action.` : 'Open the highest-urgency record and confirm ownership.',
          lowStock.length ? 'Coordinate with store/procurement for stock blockers before assigning technician time.' : '',
          overduePm.length ? 'Schedule overdue PM after active safety or downtime work is controlled.' : '',
        ].filter(Boolean);

  return baseAssistant(params, {
    summary,
    key_findings: [
      workOrders.length ? `${workOrders.length} active/assigned work order(s) are visible in this scope.` : '',
      overduePm.length ? `${overduePm.length} overdue PM item(s) are visible.` : '',
      flags.length ? `${flags.length} recommendation flag(s) are visible.` : '',
      lowStock.length ? `${lowStock.length} low-stock or stockout row(s) may block service.` : '',
    ].filter(Boolean),
    priority_reasoning: reasoning,
    recommended_actions: actions,
    confidence: queue.length ? 'high' : 'medium',
    intelligence_mode: 'prioritization',
  });
}

function buildAssetContextAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const { blocks, evidence, profile } = params;
  const asset = getEquipment(blocks, evidence);
  const history = asRows(toolData(blocks, 'read_equipment_history')).length
    ? asRows(toolData(blocks, 'read_equipment_history'))
    : evidence.maintenanceHistory;
  const analytics = asRecord(blocks.focusedAssetAnalytics);
  const roleCategory = getCopilotRoleCategory(profile);

  if (!asset && !history.length && !analytics) return null;

  const name = assetName(asset);
  const condition = text(asset?.condition, 'condition not recorded');
  const status = text(asset?.status, 'status not recorded');
  const category = asRecord(asset?.equipment_categories);
  const criticality = text(category?.criticality_level);
  const qrStatus = text(asset?.qr_label_status);
  const riskScores = asRows(analytics?.riskScores);
  const reliabilityMetrics = asRows(analytics?.reliabilityMetrics);
  const replacementPriority = asRows(analytics?.replacementPriority);

  const summaryParts = [`Based on current system records, ${name} is marked ${condition} with status ${status}.`];
  if (criticality) summaryParts.push(`Its category criticality is ${criticality}.`);
  if (history.length) summaryParts.push(`I found ${history.length} recent maintenance event(s) linked to it.`);
  if (riskScores.length || reliabilityMetrics.length || replacementPriority.length) {
    summaryParts.push('Risk, reliability, or replacement evidence is available for review.');
  }
  if (qrStatus && params.capability === 'qr_asset_context') summaryParts.push(`The QR label state is ${qrStatus}.`);

  const actions =
    roleCategory === 'technician'
      ? [
          'Check the latest work/order history before inspection so you do not duplicate an existing repair path.',
          'Create or update a corrective request only if you observe a new fault or condition change.',
        ]
      : roleCategory === 'department_user' || roleCategory === 'department_head'
        ? [
            'Report a new problem only if the department is observing a current fault.',
            'Use the linked asset evidence to avoid duplicate requests.',
          ]
        : [
            'Review linked work, PM, calibration, and risk evidence before changing operational priority.',
            'Open the asset profile for the full record trail.',
          ];

  return baseAssistant(params, {
    summary: summaryParts.join(' '),
    key_findings: [
      ...summarizeStatusFields(asset, ['asset_code', 'name', 'condition', 'status', 'qr_label_status']),
      criticality ? `criticality: ${criticality}` : '',
      history.length ? `${history.length} recent maintenance event(s) retrieved.` : '',
      riskScores.length ? `${riskScores.length} risk score row(s) available.` : '',
      reliabilityMetrics.length ? `${reliabilityMetrics.length} reliability metric row(s) available.` : '',
      replacementPriority.length ? `${replacementPriority.length} replacement priority row(s) available.` : '',
    ].filter(Boolean),
    recommended_actions: actions,
    confidence: asset ? 'high' : 'medium',
    intelligence_mode: 'synthesis',
  });
}

function buildWorkOrderAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const { blocks, evidence, profile } = params;
  const wo = getWorkOrder(blocks, evidence);
  if (!wo) return null;

  const number = text(wo.work_order_number, text(wo.id, 'this work order'));
  const status = text(wo.status, 'status not recorded');
  const priority = text(wo.priority, 'priority not recorded');
  const type = text(wo.work_type);
  const roleCategory = getCopilotRoleCategory(profile);
  const asset = asRecord(wo.equipment_assets);
  const assetLabel = assetName(asset);

  const summary = `Based on the retrieved work-order record, ${number} is ${status} with ${priority} priority${type ? ` for ${type} work` : ''}${asset ? ` on ${assetLabel}` : ''}. The useful next step is to confirm the current blocker, owner, and completion criteria before changing status.`;

  return baseAssistant(params, {
    summary,
    key_findings: summarizeStatusFields(wo, ['work_order_number', 'status', 'priority', 'work_type', 'created_at']),
    recommended_actions:
      roleCategory === 'technician'
        ? ['Confirm the observed fault and document only verified work.', 'Escalate if parts, vendor support, or safety risk blocks progress.']
        : ['Open the exact work order and confirm assignment/blocker state.', 'Use the work-order trail as the evidence record for follow-up.'],
    confidence: 'high',
    intelligence_mode: 'synthesis',
  });
}

function buildDepartmentStatusAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const readiness = asRows(toolData(params.blocks, 'read_department_readiness')).length
    ? asRows(toolData(params.blocks, 'read_department_readiness'))
    : asRows(params.blocks.readinessSnapshot);
  const flags = asRows(params.blocks.recommendationFlags);
  const overduePm = asRows(params.blocks.overduePm);
  if (!readiness.length && !flags.length && !overduePm.length) return null;

  const latest = readiness[0];
  const readinessScore = latest?.readiness_score != null ? `${Math.round(count(latest.readiness_score) * 100)}%` : '';
  const summary = readinessScore
    ? `Based on current readiness records, the latest department readiness score is ${readinessScore}. The main follow-up is to address equipment issues, overdue PM, and high-severity flags that reduce clinical readiness.`
    : `Based on current scoped records, I found ${flags.length} recommendation flag(s) and ${overduePm.length} overdue PM item(s) affecting readiness.`;

  return baseAssistant(params, {
    summary,
    key_findings: [
      readinessScore ? `Latest readiness score: ${readinessScore}.` : '',
      latest?.essential_total != null ? `${text(latest.essential_functional, '0')} of ${text(latest.essential_total)} essential assets are functional in the latest snapshot.` : '',
      flags.length ? `${flags.length} recommendation flag(s) are visible.` : '',
      overduePm.length ? `${overduePm.length} overdue PM item(s) are visible.` : '',
    ].filter(Boolean),
    recommended_actions: ['Open the lowest-readiness evidence first.', 'Resolve active work and compliance blockers before treating the score as recovered.'],
    confidence: readiness.length ? 'high' : 'medium',
  });
}

function buildStockBlockerAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const lowStock = asRows(toolData(params.blocks, 'read_stock_blockers')).length
    ? asRows(toolData(params.blocks, 'read_stock_blockers'))
    : asRows(params.blocks.lowStockParts);
  const procurement = asRows(toolData(params.blocks, 'read_procurement_pipeline')).length
    ? asRows(toolData(params.blocks, 'read_procurement_pipeline'))
    : asRows(params.blocks.procurementPipeline);
  if (!lowStock.length && !procurement.length) return null;

  const first = lowStock[0];
  const firstLabel = first ? `${text(first.part_code)} ${text(first.name)}`.trim() : '';
  const summary = firstLabel
    ? `Based on current stock records, start with ${firstLabel}. It has ${text(first.current_stock, 'unknown')} on hand against a reorder level of ${text(first.reorder_level, 'unknown')}, so it is the clearest stock blocker in the retrieved rows.`
    : `Based on current logistics records, I found ${procurement.length} procurement row(s) that may affect service restoration.`;

  return baseAssistant(params, {
    summary,
    key_findings: [
      lowStock.length ? `${lowStock.length} low-stock or stockout row(s) were retrieved.` : '',
      procurement.length ? `${procurement.length} procurement pipeline row(s) were retrieved.` : '',
      first?.deficit != null ? `Top deficit: ${text(first.deficit)}.` : '',
    ].filter(Boolean),
    recommended_actions: [
      lowStock.length ? 'Open spare parts and resolve stockout/low-stock rows tied to active work first.' : '',
      procurement.length ? 'Track existing procurement before drafting a duplicate request.' : '',
      'Use exact stock/procurement evidence rather than guessing part availability.',
    ].filter(Boolean),
    confidence: 'high',
  });
}

function buildTroubleshootingAnswer(params: DeterministicAnswerParams): AssistantContent {
  const checks = asRows(params.blocks.tier1Troubleshooting)
    .map((row) => text(row.check || row.step))
    .filter(Boolean);
  const safeChecks = checks.length
    ? checks
    : [
        'Confirm the power source, plug, socket, cable, and battery state.',
        'Inspect external accessories, probes, connectors, and visible damage.',
        'Check for overheating, blocked ventilation, cleaning issues, and displayed error messages.',
        'Review PM/calibration status and recent work history before escalation.',
      ];

  return baseAssistant(params, {
    title: 'Safe First-Line Troubleshooting',
    summary:
      'I can help with safe first-line checks, but not internal repair, alarm bypass, service mode, firmware, or manufacturer-specific calibration steps. Start with external checks and system history, then escalate if the fault persists or affects clinical safety.',
    troubleshooting_steps: safeChecks,
    recommended_actions: [
      'Stop using the equipment clinically if there is any safety concern.',
      'Record the observed symptom, displayed message, and checks already completed.',
      'Escalate to a qualified biomedical engineer or vendor for internal repair or calibration work.',
    ],
    escalation_guidance: 'Escalate when safe external checks do not restore function, when alarms/safety functions are involved, or when the equipment is critical for care.',
    confidence: checks.length ? 'medium' : 'low',
    answer_basis: hasRecordData(params) ? 'system_data' : 'general_safe_guidance',
    intelligence_mode: 'troubleshooting',
  });
}

function buildOfflineSyncAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const summary = asRecord(toolData(params.blocks, 'read_offline_sync_summary'));
  const rows = asRows(summary?.rows);
  const queueStatus = asRecord(summary?.pageQueueStatus) ?? asRecord(params.moduleContext?.queueStatus);
  if (!summary && !queueStatus) return null;

  const conflicts = rows.filter((row) => lower(row.resolution_status).includes('conflict') || lower(row.sync_status).includes('conflict'));
  const failed = rows.filter((row) => lower(row.sync_status).includes('fail') || lower(row.reported_status).includes('fail'));
  const queued = queueStatus?.queued != null ? count(queueStatus.queued) : rows.filter((row) => lower(row.sync_status).includes('queued')).length;

  return baseAssistant(params, {
    summary: `Based on the offline sync context, I found ${queued} queued item(s), ${failed.length} failed item(s), and ${conflicts.length} conflict item(s) in the available scope. Review conflicts before replaying or trusting the queue as fully synchronized.`,
    key_findings: [
      `Queued: ${queued}.`,
      `Failed: ${failed.length}.`,
      `Conflicts needing review: ${conflicts.length}.`,
      queueStatus?.lastSyncedAt ? `Last synced: ${text(queueStatus.lastSyncedAt)}.` : '',
    ].filter(Boolean),
    recommended_actions: ['Open offline sync and resolve conflicts first.', 'Retry failed rows only after confirming the source record and duplicate risk.'],
    confidence: 'high',
  });
}

function buildQrAssetAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const asset = getEquipment(params.blocks, params.evidence);
  const scans = asRows(toolData(params.blocks, 'read_qr_scan_evidence'));
  const page = pageContext(params.blocks, params.moduleContext);
  if (!asset && !page.qrToken && !scans.length) return null;

  const name = assetName(asset);
  const labelStatus = text(asset?.qr_label_status, page.qrToken ? 'QR token available from page context' : 'QR status unavailable');
  const revoked = Boolean(asset?.qr_revoked_at);
  const summary = asset
    ? `Based on the QR-linked asset context, ${name} has QR label status ${labelStatus}${revoked ? ' and the token is revoked' : ''}. I found ${scans.length} recent QR scan row(s) in the permitted evidence.`
    : `I can see this is a QR page, but the full linked asset record was not available in the current context. I can still use the page context and any scan evidence that loaded.`;

  return baseAssistant(params, {
    summary,
    key_findings: [
      asset ? `Asset: ${name}.` : '',
      `QR label status: ${labelStatus}.`,
      revoked ? 'QR token is revoked.' : '',
      scans.length ? `${scans.length} recent scan row(s) loaded.` : '',
    ].filter(Boolean),
    recommended_actions: [
      revoked ? 'Do not rely on this label for live workflow; open QR coverage or asset evidence.' : 'Use the linked asset profile for exact maintenance, PM, and calibration evidence.',
      'Create a corrective request only if inspection finds a new current fault.',
    ],
    confidence: asset ? 'high' : 'medium',
  });
}

function buildReportSummaryAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const report = asRecord(toolData(params.blocks, 'read_report_snapshot')) ?? pageContext(params.blocks, params.moduleContext);
  const reportType = text(report.reportType ?? params.moduleContext?.reportType);
  const pageSummary = text(report.pageSummary ?? params.moduleContext?.pageSummary);
  const counts = asRecord(report.visibleCounts ?? params.moduleContext?.visibleCounts);
  if (!reportType && !pageSummary && !counts) return null;

  const countFindings = counts
    ? Object.entries(counts)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${text(value)}`)
        .slice(0, 5)
    : [];
  return baseAssistant(params, {
    summary: pageSummary
      ? `Based on this report page, ${pageSummary}`
      : `Based on the current report context${reportType ? ` for ${reportType}` : ''}, summarize the visible evidence first and treat missing drilldown data as unavailable rather than inferred.`,
    key_findings: [reportType ? `Report type: ${reportType}.` : '', ...countFindings].filter(Boolean),
    recommended_actions: ['Open the report evidence link for the underlying rows.', 'Use exported report data for formal decisions or audit evidence.'],
    confidence: pageSummary || countFindings.length ? 'medium' : 'low',
  });
}

function buildDeveloperDiagnosticAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const roleCategory = getCopilotRoleCategory(params.profile);
  if (roleCategory !== 'developer') return null;
  const formalTrace = asRecord(params.blocks.formalToolTrace);
  const selectedTools = Array.isArray(formalTrace?.selectedTools) ? formalTrace.selectedTools.map((item) => text(item)).filter(Boolean) : [];
  const reasons = params.classified?.reasons ?? [];
  const signals = params.classified?.matchedSignals ?? [];
  const candidates = params.classified?.candidates
    ?.slice(0, 4)
    .map((candidate) => `${candidate.capability} (${candidate.confidence.toFixed(2)})`) ?? [];
  const routing = params.classified
    ? [
        `Capability: ${params.classified.capability}.`,
        `Intent: ${params.classified.intent}.`,
        `Classifier confidence: ${params.classified.confidenceLabel} (${params.classified.confidence.toFixed(2)}).`,
        reasons.length ? `Matched reason: ${reasons.slice(0, 2).join(' ')}` : '',
        signals.length ? `Matched signal(s): ${signals.slice(0, 4).join(', ')}.` : '',
        candidates.length ? `Top candidates: ${candidates.join(', ')}.` : '',
        params.classified.fallbackReason ? `Fallback flag: ${params.classified.fallbackReason}.` : '',
      ].filter(Boolean)
    : [];
  if (!selectedTools.length && !routing.length) return null;

  return baseAssistant(params, {
    summary:
      params.classified
        ? `Based on the classifier metadata for this turn, this prompt is routed to ${params.classified.capability}. The main driver is ${reasons[0] ?? signals[0] ?? 'the highest-scoring capability match'}, and developer diagnostics are kept ahead of page-context overrides so routing details do not get swallowed by the current module.`
        : 'Developer diagnostic view: the answer was routed from classifier signals, page context, and the selected read-only copilot tools. Raw provider output stays out of the normal response surface.',
    key_findings: [...routing, selectedTools.length ? `Tools selected: ${selectedTools.join(', ')}.` : ''].filter(Boolean),
    recommended_actions: ['Use Developer Lab for full telemetry and smoke-test actions.', 'Check source tables and tool warnings before treating missing data as a product bug.'],
    routing_explanation: routing,
    confidence: 'high',
  });
}

function buildConceptualAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  const msg = params.message.toLowerCase();
  if (/\brpn\b/.test(msg)) {
    return baseAssistant(params, {
      summary:
        'RPN means Risk Priority Number. In biomedical equipment management, it is a risk-ranking score that combines severity, occurrence, and detectability so the team can compare which equipment risks deserve attention first.',
      key_findings: ['Higher RPN means higher relative risk.', 'RPN is a prioritization aid, not an automatic approval or replacement decision.'],
      recommended_actions: ['Use RPN alongside clinical criticality, downtime, PM/calibration evidence, and parts availability.'],
      answer_basis: 'general_safe_guidance',
      confidence: 'high',
    });
  }
  if (/\bmttr\b/.test(msg)) {
    return baseAssistant(params, {
      summary:
        'MTTR means Mean Time To Repair. It estimates how long repair work usually takes after a failure is reported, so high MTTR can point to repair bottlenecks, parts delays, vendor dependency, or slow diagnosis.',
      recommended_actions: ['Compare MTTR with work-order history and stock/procurement blockers before deciding why it is high.'],
      answer_basis: 'general_safe_guidance',
      confidence: 'high',
    });
  }
  if (/\bmtbf\b/.test(msg)) {
    return baseAssistant(params, {
      summary:
        'MTBF means Mean Time Between Failures. In BMERMS it helps show reliability: lower MTBF means the equipment is failing more often and may need closer PM, user training review, or replacement evidence review.',
      recommended_actions: ['Use MTBF with failure history, PM compliance, criticality, and replacement score evidence.'],
      answer_basis: 'general_safe_guidance',
      confidence: 'high',
    });
  }
  if (/\bpm compliance\b|\bpreventive maintenance\b/.test(msg)) {
    return baseAssistant(params, {
      summary:
        'PM compliance describes how well scheduled preventive maintenance is being completed on time. For hospital equipment, low PM compliance can increase downtime, safety risk, and calibration or inspection gaps.',
      recommended_actions: ['Prioritize overdue PM for critical clinical areas and equipment with active failures or risk flags.'],
      answer_basis: 'general_safe_guidance',
      confidence: 'high',
    });
  }
  if (/\bhow do i use (this page|this system|bmerms)\b|\bwhat can (this|the) page do\b/.test(msg)) {
    const page = pageContext(params.blocks, params.moduleContext);
    return baseAssistant(params, {
      summary: `Use this page to review ${text(page.pageLabel || page.moduleLabel, 'the current BMERMS workflow')}, check the visible evidence, and open the exact linked records before taking action. I can summarize what is visible here or explain which record to open next.`,
      recommended_actions: ['Ask “summarize this page” for a quick readout.', 'Ask “what should I prioritize?” when you need an operational order.', 'Ask “help me report this problem” only when you want a draft action.'],
      answer_basis: hasRecordData(params) ? 'system_data' : 'system_capabilities',
      confidence: 'medium',
    });
  }
  return null;
}

function buildViewerExecutiveAnswer(params: DeterministicAnswerParams): AssistantContent | null {
  if (getCopilotRoleCategory(params.profile) !== 'viewer') return null;
  const priority = buildOperationalPriorityAnswer(params);
  if (priority) {
    return {
      ...priority,
      summary: priority.summary.replace('start with', 'the first management concern is'),
      recommended_actions: ['Open evidence links for the underlying records.', 'Use this as a management summary, not a mutation workflow.'],
      action_drafts: [],
    };
  }
  return null;
}

export function buildDeterministicAnswerCandidate(params: DeterministicAnswerParams): AssistantContent | null {
  const developer = buildDeveloperDiagnosticAnswer(params);
  if (developer && (params.capability === 'copilot_diagnostics' || params.capability === 'metric_debug' || /classified|classifier|telemetry|provider|parser|usage/i.test(params.message))) {
    return developer;
  }

  const conceptual = buildConceptualAnswer(params);
  if (conceptual && !hasRecordData(params)) return conceptual;

  if (params.capability === 'safe_troubleshooting' || params.classified?.troubleshootingSubtype === 'safe_general_troubleshooting') {
    return buildTroubleshootingAnswer(params);
  }

  if (params.capability === 'qr_asset_context' || params.moduleContext?.qrToken || params.moduleContext?.route?.startsWith('/qr/a/')) {
    const answer = buildQrAssetAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'offline_sync_status' || params.moduleContext?.route?.startsWith('/offline-sync')) {
    const answer = buildOfflineSyncAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'report_summary' || params.moduleContext?.reportType || params.moduleContext?.route?.startsWith('/reports')) {
    const answer = buildReportSummaryAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'logistics_status' || params.capability === 'procurement_status') {
    const answer = buildStockBlockerAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'summarize_work_order') {
    const answer = buildWorkOrderAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'summarize_equipment' || params.capability === 'explain_equipment_risk') {
    const answer = buildAssetContextAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'summarize_department_readiness' || params.capability === 'explain_pm_status') {
    const answer = buildDepartmentStatusAnswer(params);
    if (answer) return answer;
  }

  if (params.capability === 'prioritize_tasks' || params.capability === 'my_tasks' || params.moduleContext?.route?.startsWith('/command')) {
    const viewer = buildViewerExecutiveAnswer(params);
    if (viewer) return viewer;
    const answer = buildOperationalPriorityAnswer(params);
    if (answer) return answer;
  }

  const page = pageContext(params.blocks, params.moduleContext);
  if (page.pageSummary || page.visibleCounts || page.selectedRecordLabel || page.pageDataHints?.length) {
    return baseAssistant(params, {
      summary: page.pageSummary
        ? `Based on the current page context, ${page.pageSummary}`
        : `Based on the current page context, this is ${text(page.selectedRecordLabel || page.pageLabel || page.moduleLabel, 'the active BMERMS page')}. I can summarize the visible records, explain the evidence, or help draft an action when you explicitly ask for one.`,
      key_findings: [
        page.selectedRecordLabel ? `Selected record: ${page.selectedRecordLabel}.` : '',
        ...(page.pageDataHints ?? []).slice(0, 4),
        ...Object.entries(page.visibleCounts ?? {})
          .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${text(value)}`)
          .slice(0, 4),
      ].filter(Boolean),
      recommended_actions: ['Open exact evidence links before acting.', 'Ask for a draft only when you want the copilot to prepare a request, note, or report.'],
      confidence: 'medium',
    });
  }

  return conceptual;
}

export function deterministicAnswerForPrompt(answer: AssistantContent | null) {
  if (!answer) return null;
  return {
    summary: answer.summary,
    key_findings: answer.key_findings.slice(0, 5),
    recommended_actions: answer.recommended_actions.slice(0, 5),
    priority_reasoning: answer.priority_reasoning.slice(0, 5),
    troubleshooting_steps: answer.troubleshooting_steps.slice(0, 5),
    evidence_used: answer.evidence_used.slice(0, 6),
    links: answer.links.slice(0, 5),
    limitations: answer.limitations.slice(0, 4),
    source_tables: answer.source_tables.slice(0, 8),
    answer_basis: answer.answer_basis,
    confidence: answer.confidence,
  };
}
