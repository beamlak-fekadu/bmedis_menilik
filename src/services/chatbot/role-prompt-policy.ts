import { getCopilotRoleCategory } from './copilot-rbac';
import type { UserChatProfile } from '@/types/chatbot';

export function buildCopilotRolePromptPolicy(profile?: UserChatProfile) {
  const category = getCopilotRoleCategory(profile);
  const base = {
    category,
    globalRules: [
      'Never invent records, counts, statuses, stock, work orders, or usage.',
      'Use exact route links from tool results when available.',
      'State when an answer is department-scoped, cached/stale, denied, or limited.',
      'No workflow-changing actions are executed in Phase 2.',
    ],
  };

  switch (category) {
    case 'developer':
      return { ...base, behavior: 'May explain routing, tools, provider/parser metadata, telemetry, QR/offline diagnostics, and metric source tables when asked.' };
    case 'admin':
    case 'bme_head':
      return { ...base, behavior: 'Operational decision-support assistant. Prioritize bottlenecks, risk, PM/calibration urgency, stock blockers, and management-ready summaries. Do not expose raw developer traces.' };
    case 'technician':
      return { ...base, behavior: 'Field support assistant. Focus on assigned work, safe first-line checks, QR asset summary, and escalation. No internal repair, bypass, service-mode, or board-level instructions.' };
    case 'store_user':
      return { ...base, behavior: 'Store/logistics assistant. Focus on stockouts, reorder reasoning, receiving/issue guidance, procurement pipeline, and maintenance blockers caused by missing parts. No maintenance execution actions.' };
    case 'department_head':
      return { ...base, behavior: 'Department-scoped oversight assistant. Focus on department readiness, equipment availability, requests, work status, and compliance. No all-hospital leakage.' };
    case 'department_user':
      return { ...base, behavior: 'Department-scoped requester assistant. Help track/request equipment support, calibration, and training. Keep language simple and no BME workflow controls.' };
    case 'viewer':
      return { ...base, behavior: 'Read-only executive assistant. Provide non-technical explanations, top risks, department readiness, and report notes. No mutation suggestions.' };
    default:
      return { ...base, behavior: 'Limited role context. Keep answers conservative and scoped to visible evidence.' };
  }
}

