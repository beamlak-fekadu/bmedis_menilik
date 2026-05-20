/**
 * Claim-vs-evidence verification for BMEDIS Copilot.
 *
 * The provider (Gemini) sometimes produces confident, record-specific claims
 * that the retrieved system context does not support — e.g. "WO-9999 is in
 * progress", "Availability is 82%", or "ICU Ventilator #5 is offline". This
 * verifier:
 *
 *   1. Extracts record-like and numeric claims from the assistant summary,
 *      key_findings, and recommended_actions.
 *   2. Builds a flat evidence pool from tool results, page context, the
 *      selected entity, evidence_used / source_tables, and any deterministic
 *      grounding candidate.
 *   3. Removes / softens unsupported claims and, when a deterministic
 *      candidate is available, falls back to it for the structural fields
 *      (preserving links, limitations, decision, action drafts).
 *
 * Intentional design choices:
 *   - Never invents a replacement value. Removal is preferred over guessing.
 *   - General formula / conceptual content (e.g. "MTBF = operational time
 *     divided by failures") is preserved. Only record-specific and exact
 *     metric value claims are verified.
 *   - Failures are silent for developers — Developer roles can still see
 *     diagnostics via routing_explanation and limitations.
 */

import type { AssistantContent, ChatEvidence, UserChatProfile } from '@/types/chatbot';

export interface ClaimVerificationInput {
  assistant: AssistantContent;
  deterministic: AssistantContent | null;
  evidence: ChatEvidence;
  contextBlocks: Record<string, unknown> | undefined;
  profile?: Pick<UserChatProfile, 'roleNames'> | null;
}

export interface ClaimVerificationResult {
  assistant: AssistantContent;
  unsupportedClaims: string[];
  fallbackApplied: boolean;
}

const WO_PATTERN = /\bWO[-\s]?[A-Z0-9]{3,10}\b/gi;
const REQUEST_PATTERN = /\b(MR|REQ|RQ)[-\s]?[A-Z0-9]{3,10}\b/gi;
const ASSET_CODE_PATTERN = /\b([A-Z]{2,5}-[A-Z0-9]{2,8}|EQ-[A-Z0-9]{2,8}|AST[-_]?[A-Z0-9]{2,8})\b/g;
// Percentages and availability/MTBF/MTTR numeric claims like "82%" or "MTBF of 1234 hours"
const PERCENT_PATTERN = /\b(\d{1,3}(?:\.\d{1,2})?)\s*%/g;

function normalizeId(value: string): string {
  return value.replace(/\s+/g, '-').toUpperCase().trim();
}

function safeJsonScan(value: unknown, depth = 0, acc: string[] = []): string[] {
  if (depth > 6) return acc;
  if (value == null) return acc;
  if (typeof value === 'string') {
    if (value.length <= 4000) acc.push(value);
    return acc;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    acc.push(String(value));
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 200)) safeJsonScan(item, depth + 1, acc);
    return acc;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) safeJsonScan(v, depth + 1, acc);
  }
  return acc;
}

interface EvidencePool {
  blob: string;
  workOrderNumbers: Set<string>;
  requestNumbers: Set<string>;
  assetCodes: Set<string>;
  percents: Set<string>;
}

function buildEvidencePool(input: ClaimVerificationInput): EvidencePool {
  const segments: string[] = [];
  const { evidence, deterministic, contextBlocks } = input;
  if (deterministic) {
    segments.push(
      deterministic.summary,
      ...deterministic.evidence_used,
      ...deterministic.key_findings,
      ...deterministic.priority_reasoning,
      ...deterministic.recommended_actions,
      ...deterministic.source_tables,
      ...deterministic.entities_referenced,
      ...deterministic.links.map((link) => `${link.label} ${link.href}`),
    );
  }
  if (evidence) {
    if (evidence.equipment) segments.push(...safeJsonScan(evidence.equipment));
    if (evidence.workOrder) segments.push(...safeJsonScan(evidence.workOrder));
    if (evidence.department) segments.push(...safeJsonScan(evidence.department));
    segments.push(...safeJsonScan(evidence.maintenanceHistory));
    if (evidence.pmSnapshot) segments.push(...safeJsonScan(evidence.pmSnapshot));
    if (evidence.calibrationStatus) segments.push(...safeJsonScan(evidence.calibrationStatus));
    if (evidence.logisticsSnapshot) segments.push(...safeJsonScan(evidence.logisticsSnapshot));
    if (evidence.analyticsSnapshot) segments.push(...safeJsonScan(evidence.analyticsSnapshot));
    if (Array.isArray(evidence.manualOrSopTexts)) segments.push(...evidence.manualOrSopTexts);
    if (Array.isArray(evidence.evidenceSignals)) segments.push(...evidence.evidenceSignals);
  }
  if (contextBlocks) segments.push(...safeJsonScan(contextBlocks));

  const blob = segments.join(' \n ').toUpperCase();
  const woMatches = (blob.match(/\bWO[-\s]?[A-Z0-9]{3,10}\b/g) ?? []).map(normalizeId);
  const requestMatches = (blob.match(/\b(MR|REQ|RQ)[-\s]?[A-Z0-9]{3,10}\b/g) ?? []).map(normalizeId);
  const assetMatches = (blob.match(/\b([A-Z]{2,5}-[A-Z0-9]{2,8}|EQ-[A-Z0-9]{2,8}|AST[-_]?[A-Z0-9]{2,8})\b/g) ?? []).map(normalizeId);
  const percentMatches = (blob.match(/\b(\d{1,3}(?:\.\d{1,2})?)\s*%/g) ?? []).map((p) => p.replace(/\s+/g, '').toUpperCase());

  return {
    blob,
    workOrderNumbers: new Set(woMatches),
    requestNumbers: new Set(requestMatches),
    assetCodes: new Set(assetMatches),
    percents: new Set(percentMatches),
  };
}

interface ExtractedClaims {
  workOrders: string[];
  requests: string[];
  assetCodes: string[];
  percents: string[];
}

function extractClaims(text: string): ExtractedClaims {
  const upper = text.toUpperCase();
  const workOrders = (upper.match(WO_PATTERN) ?? []).map(normalizeId);
  const requests = (upper.match(REQUEST_PATTERN) ?? []).map(normalizeId);
  // Asset-code pattern can collide with WO-/MR-/REQ-/RQ- so drop overlaps:
  const rawAssets = (upper.match(ASSET_CODE_PATTERN) ?? []).map(normalizeId);
  const assetCodes = rawAssets.filter((code) => !/^(WO|MR|REQ|RQ)-/.test(code));
  const percents = (upper.match(PERCENT_PATTERN) ?? []).map((p) => p.replace(/\s+/g, '').toUpperCase());
  return { workOrders, requests, assetCodes, percents };
}

function isSupported(claim: string, pool: Set<string>): boolean {
  if (pool.has(claim)) return true;
  // Also support prefix match (e.g. WO-001234 vs WO-001234X)
  for (const known of pool) {
    if (known.startsWith(claim) || claim.startsWith(known)) return true;
  }
  return false;
}

function softenSummary(summary: string, removed: string[]): string {
  let next = summary;
  for (const claim of removed) {
    const safeClaim = claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`\\b${safeClaim}\\b`, 'gi'), '[record not retrieved]');
  }
  return next;
}

function arrayHasAnyClaim(arr: string[], claims: string[]): boolean {
  if (claims.length === 0) return false;
  const blob = arr.join(' ').toUpperCase();
  return claims.some((c) => blob.includes(c));
}

export function verifyAssistantClaimsAgainstEvidence(input: ClaimVerificationInput): ClaimVerificationResult {
  const { assistant, deterministic } = input;
  if (!assistant) {
    return { assistant, unsupportedClaims: [], fallbackApplied: false };
  }

  // Skip verification for purely conceptual/general responses without records.
  const decision = assistant.decision;
  if (decision === 'refuse' || decision === 'escalate' || decision === 'check_manual') {
    return { assistant, unsupportedClaims: [], fallbackApplied: false };
  }

  const pool = buildEvidencePool(input);
  const candidateText = [
    assistant.title ?? '',
    assistant.summary,
    ...assistant.key_findings,
    ...assistant.recommended_actions,
    ...assistant.priority_reasoning,
    ...assistant.actions,
    ...assistant.insights,
    ...assistant.recommendations,
  ].join(' \n ');

  const claims = extractClaims(candidateText);

  const unsupportedWorkOrders = claims.workOrders.filter((claim) => !isSupported(claim, pool.workOrderNumbers));
  const unsupportedRequests = claims.requests.filter((claim) => !isSupported(claim, pool.requestNumbers));
  const unsupportedAssets = claims.assetCodes.filter((claim) => !isSupported(claim, pool.assetCodes));

  // Percent claims: only treat a claim as "unsupported" when the assistant
  // *quotes* a specific value (e.g. "is 82%") that the evidence pool does
  // not contain. We deliberately don't strip every percentage — formula
  // explanations (e.g. "PMC = completed/scheduled × 100%") are fine.
  const percentClaims = claims.percents.filter((p) => /^\d+(\.\d+)?%$/.test(p));
  const unsupportedPercents = percentClaims.filter((claim) => {
    if (pool.percents.has(claim)) return false;
    // Treat conceptual percentages 100%/0% as fine.
    if (claim === '100%' || claim === '0%') return false;
    // Only flag percentages that are attached to a metric word in the assistant text.
    const re = new RegExp(`(MTBF|MTTR|availability|uptime|compliance|PMC|risk|score)[^.!?\\n]{0,32}${claim.replace('%', '\\s*%')}`, 'i');
    return re.test(candidateText);
  });

  const allUnsupported = [
    ...unsupportedWorkOrders,
    ...unsupportedRequests,
    ...unsupportedAssets,
    ...unsupportedPercents,
  ];

  if (allUnsupported.length === 0) {
    return { assistant, unsupportedClaims: [], fallbackApplied: false };
  }

  // Heuristic: if the summary itself confidently states an unsupported record
  // and a deterministic candidate exists, fall back to deterministic.
  const summaryNamesUnsupportedRecord =
    arrayHasAnyClaim([assistant.summary], unsupportedWorkOrders) ||
    arrayHasAnyClaim([assistant.summary], unsupportedRequests) ||
    arrayHasAnyClaim([assistant.summary], unsupportedAssets);
  const shouldFallback = Boolean(deterministic) && summaryNamesUnsupportedRecord;

  if (shouldFallback && deterministic) {
    const limitationText = `The previous draft mentioned ${allUnsupported.slice(0, 4).join(', ')}; these are not retrieved in the current BMEDIS context, so the answer was replaced with verified system data.`;
    return {
      assistant: {
        ...deterministic,
        decision: assistant.decision,
        action_drafts: assistant.action_drafts ?? [],
        limitations: Array.from(new Set([...(deterministic.limitations ?? []), limitationText])).slice(0, 8),
        reason_for_limit: assistant.reason_for_limit ?? 'Provider draft referenced unverified records.',
      },
      unsupportedClaims: allUnsupported,
      fallbackApplied: true,
    };
  }

  // Soften the summary in place without inventing replacements.
  const softenedSummary = softenSummary(assistant.summary, allUnsupported);
  const softenedKeyFindings = assistant.key_findings.map((line) => softenSummary(line, allUnsupported));
  const softenedRecommended = assistant.recommended_actions.map((line) => softenSummary(line, allUnsupported));
  const softenedInsights = assistant.insights.map((line) => softenSummary(line, allUnsupported));
  const softenedRecs = assistant.recommendations.map((line) => softenSummary(line, allUnsupported));
  const limitationText = `Mentioned ${allUnsupported.slice(0, 4).join(', ')} not retrieved in the current BMEDIS context.`;

  return {
    assistant: {
      ...assistant,
      summary: softenedSummary,
      key_findings: softenedKeyFindings,
      recommended_actions: softenedRecommended,
      insights: softenedInsights,
      recommendations: softenedRecs,
      limitations: Array.from(new Set([...(assistant.limitations ?? []), limitationText])).slice(0, 8),
    },
    unsupportedClaims: allUnsupported,
    fallbackApplied: false,
  };
}
