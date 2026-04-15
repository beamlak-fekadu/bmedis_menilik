import { z } from 'zod';

export const CHAT_INTENTS = [
  'maintenance_tip',
  'troubleshooting',
  'work_order_help',
  'equipment_lookup',
  'analytics_explanation',
  'calibration_or_logistics',
  'too_detailed',
  'unsafe',
  'out_of_scope',
] as const;

export const CHAT_DECISIONS = ['answer', 'limited_answer', 'check_manual', 'escalate', 'refuse'] as const;
export const ANSWER_BASIS = ['system_data', 'manual_or_sop', 'general_safe_guidance', 'insufficient_data'] as const;
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export const CHAT_PROVIDERS = ['stub', 'ollama', 'groq'] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];
export type ChatDecision = (typeof CHAT_DECISIONS)[number];
export type AnswerBasis = (typeof ANSWER_BASIS)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type ChatProviderName = (typeof CHAT_PROVIDERS)[number];
export type ChatMessageRole = 'user' | 'assistant';
export type ChatModelMessageRole = 'system' | 'user' | 'assistant';

export const ChatContextRefsSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(3).max(2000),
  sessionId: z.string().uuid().optional(),
  contextRefs: ChatContextRefsSchema.optional(),
});

export const AssistantContentSchema = z.object({
  decision: z.enum(CHAT_DECISIONS),
  summary: z.string().max(2000),
  likely_causes: z.array(z.string().max(300)).max(8).default([]),
  troubleshooting_steps: z.array(z.string().max(400)).max(10).default([]),
  maintenance_tips: z.array(z.string().max(400)).max(10).default([]),
  required_tools_or_parts: z.array(z.string().max(200)).max(10).default([]),
  escalation_recommendation: z.string().max(600).optional(),
  reason_for_limit: z.string().max(600).optional(),
  answer_basis: z.enum(ANSWER_BASIS),
  confidence: z.enum(CONFIDENCE_LEVELS),
  escalation_required: z.boolean().default(false),
});

export const ChatResponseSchema = z.object({
  sessionId: z.string().uuid(),
  intent: z.enum(CHAT_INTENTS),
  decision: z.enum(CHAT_DECISIONS),
  blocked: z.boolean(),
  assistant: AssistantContentSchema,
});

export type ChatContextRefs = z.infer<typeof ChatContextRefsSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AssistantContent = z.infer<typeof AssistantContentSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export interface ClassifiedRequest {
  intent: ChatIntent;
  reasons: string[];
}

export interface UserChatProfile {
  profileId: string;
  roleNames: string[];
  departmentId: string | null;
}

export interface ChatEvidence {
  equipment: Record<string, unknown> | null;
  workOrder: Record<string, unknown> | null;
  department: Record<string, unknown> | null;
  maintenanceHistory: Record<string, unknown>[];
  pmSnapshot: Record<string, unknown> | null;
  calibrationStatus: Record<string, unknown> | null;
  logisticsSnapshot: Record<string, unknown> | null;
  analyticsSnapshot: Record<string, unknown> | null;
  manualOrSopTexts: string[];
  evidenceSignals: string[];
  deniedContextRefs: Array<'equipment' | 'work_order' | 'department'>;
  accessDenied: boolean;
}

export interface SafetyEvaluation {
  decision: ChatDecision;
  blocked: boolean;
  answerBasis: AnswerBasis;
  confidence: ConfidenceLevel;
  reason: string;
  escalationRequired: boolean;
}

export interface ChatModelMessage {
  role: ChatModelMessageRole;
  content: string;
}

export interface LlmGenerateParams {
  messages: ChatModelMessage[];
  requiredDecision: ChatDecision;
  intent: ChatIntent;
}

export interface LlmProviderResult {
  assistant: AssistantContent;
  provider: ChatProviderName;
  model: string;
}

export interface ChatLlmProvider {
  name: ChatProviderName;
  generate(params: LlmGenerateParams): Promise<LlmProviderResult>;
}
