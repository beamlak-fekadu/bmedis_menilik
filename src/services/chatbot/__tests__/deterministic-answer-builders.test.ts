import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicAnswerCandidate } from '@/services/chatbot/deterministic-answer-builders';
import { applyResponseUsefulnessGuard } from '@/services/chatbot/response-usefulness-guard';
import type { ChatEvidence, ClassifiedRequest, UserChatProfile } from '@/types/chatbot';

const BME_HEAD: UserChatProfile = {
  profileId: 'bme-head-1',
  roleNames: ['bme_head'],
  departmentId: null,
};

const TECHNICIAN: UserChatProfile = {
  profileId: 'tech-1',
  roleNames: ['technician'],
  departmentId: null,
};

const VIEWER: UserChatProfile = {
  profileId: 'viewer-1',
  roleNames: ['viewer'],
  departmentId: null,
};

const DEVELOPER: UserChatProfile = {
  profileId: 'developer-1',
  roleNames: ['developer'],
  departmentId: null,
};

const EMPTY_EVIDENCE: ChatEvidence = {
  equipment: null,
  workOrder: null,
  department: null,
  maintenanceHistory: [],
  pmSnapshot: null,
  calibrationStatus: null,
  logisticsSnapshot: null,
  analyticsSnapshot: null,
  manualOrSopTexts: [],
  documentRetrieval: { notImplemented: true, searchDocuments: [], forEquipment: [], forCategory: [] },
  evidenceSignals: [],
  deniedContextRefs: [],
  accessDenied: false,
};

test('equipment page context produces grounded asset summary without asking which asset', () => {
  const out = buildDeterministicAnswerCandidate({
    capability: 'summarize_equipment',
    decision: 'answer',
    profile: TECHNICIAN,
    message: 'summarize this asset',
    contextRefs: { equipmentId: 'asset-1' },
    moduleContext: { route: '/equipment/asset-1', selectedRecordLabel: 'OT-ANE-001 - Anesthesia Machine' },
    blocks: {
      formalToolTrace: {
        results: [
          {
            toolName: 'read_equipment_status',
            data: {
              id: 'asset-1',
              asset_code: 'OT-ANE-001',
              name: 'Anesthesia Machine',
              condition: 'needs_repair',
              status: 'active',
              equipment_categories: { criticality_level: 'critical' },
            },
            evidenceSignals: ['Loaded equipment/QR asset context.'],
            sourceTables: ['equipment_assets'],
            routeLinks: [{ label: 'Open equipment', href: '/equipment/asset-1', type: 'equipment' }],
          },
        ],
      },
    },
    evidence: EMPTY_EVIDENCE,
  });

  assert.ok(out);
  assert.match(out.summary, /OT-ANE-001/);
  assert.equal(out.answer_basis, 'system_data');
  assert.ok(out.evidence_used.some((item) => item.includes('OT-ANE-001')));
});

test('QR page context uses QR asset evidence', () => {
  const out = buildDeterministicAnswerCandidate({
    capability: 'qr_asset_context',
    decision: 'answer',
    profile: TECHNICIAN,
    message: 'what should I know?',
    moduleContext: { route: '/qr/a/qra_test', qrToken: 'qra_test' },
    blocks: {
      formalToolTrace: {
        results: [
          {
            toolName: 'read_qr_asset_context',
            data: {
              id: 'asset-2',
              asset_code: 'ICU-MON-002',
              name: 'Patient Monitor',
              condition: 'functional',
              status: 'active',
              qr_label_status: 'attached',
            },
            evidenceSignals: ['Loaded equipment/QR asset context.'],
            sourceTables: ['equipment_assets'],
          },
          {
            toolName: 'read_qr_scan_evidence',
            data: [{ id: 'scan-1', asset_id: 'asset-2', scan_source: 'web' }],
            evidenceSignals: ['Loaded QR scan evidence.'],
            sourceTables: ['equipment_qr_scans'],
          },
        ],
      },
    },
    evidence: EMPTY_EVIDENCE,
  });

  assert.ok(out);
  assert.match(out.summary, /ICU-MON-002/);
  assert.match(out.summary, /attached/);
  assert.equal(out.answer_basis, 'system_data');
});

test('BME Head priority answer uses real ranked evidence instead of generic filler', () => {
  const out = buildDeterministicAnswerCandidate({
    capability: 'prioritize_tasks',
    decision: 'answer',
    profile: BME_HEAD,
    message: 'What should I prioritize today?',
    blocks: {
      rankedOperationalQueue: [
        { label: 'WO OT-ANE-001 critical anesthesia fault', score: 94 },
        { label: 'Overdue PM ICU ventilators', score: 88 },
      ],
      assignedWorkOrders: [{ id: 'wo-1', priority: 'critical' }],
      overduePm: [{ id: 'pm-1' }],
      recommendationFlags: [{ id: 'flag-1', severity: 'critical' }],
      evidenceUsed: ['Command Center snapshot'],
    },
    evidence: EMPTY_EVIDENCE,
  });

  assert.ok(out);
  assert.match(out.summary, /OT-ANE-001/);
  assert.ok(out.priority_reasoning.length >= 2);
  assert.equal(out.summary.includes('review the dashboard'), false);
});

test('technician troubleshooting stays safe and refuses bypass-style depth', () => {
  const out = buildDeterministicAnswerCandidate({
    capability: 'safe_troubleshooting',
    decision: 'limited_answer',
    profile: TECHNICIAN,
    message: 'What should I check before escalation?',
    blocks: {},
    evidence: EMPTY_EVIDENCE,
  });

  assert.ok(out);
  assert.match(out.summary, /safe first-line checks/i);
  assert.ok(out.troubleshooting_steps.some((item) => /power/i.test(item)));
  assert.equal(out.troubleshooting_steps.some((item) => /service mode|firmware flash|bypass/i.test(item)), false);
});

test('viewer priority answer is executive style and never includes action drafts', () => {
  const out = buildDeterministicAnswerCandidate({
    capability: 'prioritize_tasks',
    decision: 'answer',
    profile: VIEWER,
    message: 'What should I prioritize today?',
    blocks: {
      rankedOperationalQueue: [{ label: 'WO NICU-INF-002 pump downtime', score: 91 }],
      assignedWorkOrders: [{ id: 'wo-2', priority: 'high' }],
    },
    evidence: EMPTY_EVIDENCE,
  });

  assert.ok(out);
  assert.match(out.summary, /management concern/);
  assert.deepEqual(out.action_drafts, []);
});

test('usefulness guard replaces generic provider text when evidence exists', () => {
  const deterministic = buildDeterministicAnswerCandidate({
    capability: 'prioritize_tasks',
    decision: 'answer',
    profile: BME_HEAD,
    message: 'What should I prioritize today?',
    blocks: {
      rankedOperationalQueue: [{ label: 'WO OT-ANE-001 critical anesthesia fault', score: 94 }],
      evidenceUsed: ['Command Center snapshot'],
    },
    evidence: EMPTY_EVIDENCE,
  });
  assert.ok(deterministic);

  const guarded = applyResponseUsefulnessGuard({
    capability: 'prioritize_tasks',
    deterministic,
    evidenceAvailable: true,
    assistant: {
      ...deterministic,
      summary: 'You should review the dashboard and check critical equipment.',
      evidence_used: [],
      links: [],
      answer_basis: 'model_output',
      confidence: 'medium',
    },
  });

  assert.match(guarded.summary, /OT-ANE-001/);
  assert.equal(guarded.answer_basis, 'system_data');
});

test('usefulness guard replaces display-repair metadata when deterministic evidence exists', () => {
  const deterministic = buildDeterministicAnswerCandidate({
    capability: 'prioritize_tasks',
    decision: 'answer',
    profile: BME_HEAD,
    message: 'why that one first?',
    blocks: {
      rankedOperationalQueue: [{ label: 'Triage queue: Schedule diagnostic for recurring failures', score: 183.8 }],
      evidenceUsed: ['Command Center snapshot'],
    },
    evidence: EMPTY_EVIDENCE,
  });
  assert.ok(deterministic);

  const guarded = applyResponseUsefulnessGuard({
    capability: 'prioritize_tasks',
    deterministic,
    evidenceAvailable: true,
    assistant: {
      ...deterministic,
      summary: 'I cleaned up internal metadata before showing this response. Try rephrasing if the answer feels incomplete.',
      evidence_used: [],
      links: [],
      answer_basis: 'model_output',
      confidence: 'medium',
    },
  });

  assert.match(guarded.summary, /Schedule diagnostic/);
  assert.equal(guarded.answer_basis, 'system_data');
});

test('developer diagnostic builder explains classifier metadata', () => {
  const classified: ClassifiedRequest = {
    intent: 'analytics_explanation',
    capability: 'copilot_diagnostics',
    reasons: ['Matched 1 keyword signal.'],
    troubleshootingSubtype: 'none',
    specificity: 'general',
    matchedSignals: ['copilot_diagnostics'],
    confidence: 0.93,
    confidenceLabel: 'high',
    ambiguous: false,
    candidates: [{ capability: 'copilot_diagnostics', confidence: 0.93, reasons: ['Matched classified phrasing.'] }],
  };

  const out = buildDeterministicAnswerCandidate({
    capability: 'copilot_diagnostics',
    decision: 'answer',
    profile: DEVELOPER,
    message: 'Why was my last prompt classified this way?',
    classified,
    blocks: {},
    evidence: EMPTY_EVIDENCE,
  });

  assert.ok(out);
  assert.match(out.summary, /copilot_diagnostics/);
  assert.ok(out.key_findings.some((item) => item.includes('Classifier confidence')));
  assert.ok(out.routing_explanation?.some((item) => item.includes('Top candidates')));
});
