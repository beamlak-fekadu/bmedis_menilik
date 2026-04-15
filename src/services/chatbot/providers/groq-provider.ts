import {
  AssistantContentSchema,
  type ChatLlmProvider,
  type ChatModelMessage,
  type ChatProviderName,
  type LlmGenerateParams,
  type LlmProviderResult,
} from '@/types/chatbot';

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function extractJsonPayload(raw: string) {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  return raw.trim();
}

function toGroqMessages(messages: ChatModelMessage[]) {
  return messages
    .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export const groqProvider: ChatLlmProvider = {
  name: 'groq',
  async generate(params: LlmGenerateParams): Promise<LlmProviderResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required when CHAT_PROVIDER=groq');
    }

    const baseUrl = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1';
    const model = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant';
    const temperature = Number(process.env.GROQ_TEMPERATURE ?? 0.1);
    const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS ?? 30000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: 'json_object' },
          messages: toGroqMessages(params.messages),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Groq request failed (${response.status}): ${details || 'No response body'}`);
      }

      const payload = (await response.json()) as GroqResponse;
      const modelText = payload.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(extractJsonPayload(modelText)) as unknown;
      const validated = AssistantContentSchema.parse(parsed);

      return {
        assistant: validated.decision === params.requiredDecision
          ? validated
          : { ...validated, decision: params.requiredDecision },
        provider: 'groq' as ChatProviderName,
        model,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
