import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { classifyChatRequest } from '@/services/chatbot/classifier-service';
import { buildChatEvidence } from '@/services/chatbot/context-service';
import { generateAssistantContent } from '@/services/chatbot/llm-service';
import { buildPromptPayload } from '@/services/chatbot/prompt-service';
import { evaluateSafetyDecision, STANDARD_RESPONSES } from '@/services/chatbot/safety-service';
import { ChatRequestSchema, ChatResponseSchema, type AssistantContent, type ChatDecision, type UserChatProfile } from '@/types/chatbot';

function buildBlockedAssistantContent(decision: ChatDecision, reason: string): AssistantContent {
  return {
    decision,
    summary: reason,
    likely_causes: [],
    troubleshooting_steps: [],
    maintenance_tips: [],
    required_tools_or_parts: [],
    escalation_recommendation: decision === 'escalate' ? STANDARD_RESPONSES.escalate : undefined,
    reason_for_limit: reason,
    answer_basis: 'insufficient_data',
    confidence: 'low',
    escalation_required: decision === 'escalate',
  };
}

async function getUserChatProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, department_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return { supabase, user, profile: null };

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', profile.id);

  const roleNames = (userRoles ?? [])
    .map((row: Record<string, unknown>) => (row.roles as { name?: string } | null)?.name)
    .filter(Boolean) as string[];

  const chatProfile: UserChatProfile = {
    profileId: profile.id,
    roleNames: roleNames.length ? roleNames : ['viewer'],
    departmentId: profile.department_id as string | null,
  };

  return { supabase, user, profile: chatProfile };
}

async function ensureChatSession(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profileId: string;
  sessionId?: string;
  messagePreview: string;
  contextRefs?: { equipmentId?: string; workOrderId?: string; departmentId?: string };
}) {
  const { supabase, profileId, sessionId, messagePreview, contextRefs } = params;

  if (sessionId) {
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', profileId)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
  }

  const title = messagePreview.slice(0, 80);
  const { data: created, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: profileId,
      title,
      equipment_id: contextRefs?.equipmentId ?? null,
      work_order_id: contextRefs?.workOrderId ?? null,
      department_id: contextRefs?.departmentId ?? null,
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error('Failed to create chat session');
  }

  return created.id as string;
}

async function insertChatMessage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  decision?: ChatDecision;
  intent?: string;
  answerBasis?: string;
  confidence?: string;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, ...payload } = params;
  const { error } = await supabase.from('chat_messages').insert({
    session_id: payload.sessionId,
    role: payload.role,
    content: payload.content,
    decision: payload.decision ?? null,
    intent: payload.intent ?? null,
    answer_basis: payload.answerBasis ?? null,
    confidence: payload.confidence ?? null,
    metadata: payload.metadata ?? null,
  });

  if (error) {
    console.error('[chatbot] chat_messages insert failed', { error: error.message });
  }
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getUserChatProfile();

  if (!user || !profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { message, sessionId, contextRefs } = parsed.data;
  const classified = classifyChatRequest(message);

  console.info('[chatbot] intent classified', { intent: classified.intent, reasons: classified.reasons });

  const session = await ensureChatSession({
    supabase,
    profileId: profile.profileId,
    sessionId,
    messagePreview: message,
    contextRefs,
  });

  await insertChatMessage({
    supabase,
    sessionId: session,
    role: 'user',
    content: message,
    intent: classified.intent,
    metadata: {
      contextRefs: contextRefs ?? null,
      classificationReasons: classified.reasons,
    },
  });

  const evidence = await buildChatEvidence(supabase, contextRefs, profile, classified.intent);
  const safety = evaluateSafetyDecision(message, classified.intent, profile, evidence);

  console.info('[chatbot] safety decision', {
    intent: classified.intent,
    decision: safety.decision,
    blocked: safety.blocked,
    reason: safety.reason,
  });

  if (safety.blocked) {
    const blockedAssistant = buildBlockedAssistantContent(safety.decision, safety.reason);
    await insertChatMessage({
      supabase,
      sessionId: session,
      role: 'assistant',
      content: blockedAssistant.summary,
      decision: blockedAssistant.decision,
      intent: classified.intent,
      answerBasis: blockedAssistant.answer_basis,
      confidence: blockedAssistant.confidence,
      metadata: { blocked: true, assistant: blockedAssistant },
    });

    const blockedResponse = ChatResponseSchema.parse({
      sessionId: session,
      intent: classified.intent,
      decision: safety.decision,
      blocked: true,
      assistant: blockedAssistant,
    });

    return NextResponse.json(blockedResponse);
  }

  const prompt = buildPromptPayload({
    message,
    intent: classified.intent,
    decision: safety.decision,
    evidence,
  });

  try {
    const providerResult = await generateAssistantContent({
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt },
      ],
      requiredDecision: safety.decision,
      intent: classified.intent,
    });

    const finalAssistant: AssistantContent = {
      ...providerResult.assistant,
      answer_basis: providerResult.assistant.answer_basis ?? safety.answerBasis,
      confidence: providerResult.assistant.confidence ?? safety.confidence,
      escalation_required: providerResult.assistant.escalation_required || safety.escalationRequired,
    };

    await insertChatMessage({
      supabase,
      sessionId: session,
      role: 'assistant',
      content: finalAssistant.summary,
      decision: finalAssistant.decision,
      intent: classified.intent,
      answerBasis: finalAssistant.answer_basis,
      confidence: finalAssistant.confidence,
      metadata: {
        blocked: false,
        evidenceSignals: evidence.evidenceSignals,
        provider: providerResult.provider,
        providerModel: providerResult.model,
        assistant: finalAssistant,
      },
    });

    const responsePayload = ChatResponseSchema.parse({
      sessionId: session,
      intent: classified.intent,
      decision: finalAssistant.decision,
      blocked: false,
      assistant: finalAssistant,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('[chatbot] provider or schema failure', {
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackAssistant = buildBlockedAssistantContent('check_manual', STANDARD_RESPONSES.checkManual);
    await insertChatMessage({
      supabase,
      sessionId: session,
      role: 'assistant',
      content: fallbackAssistant.summary,
      decision: fallbackAssistant.decision,
      intent: classified.intent,
      answerBasis: fallbackAssistant.answer_basis,
      confidence: fallbackAssistant.confidence,
      metadata: { fallbackDueToError: true, assistant: fallbackAssistant },
    });

    const fallbackResponse = ChatResponseSchema.parse({
      sessionId: session,
      intent: classified.intent,
      decision: fallbackAssistant.decision,
      blocked: true,
      assistant: fallbackAssistant,
    });

    return NextResponse.json(fallbackResponse, { status: 200 });
  }
}
