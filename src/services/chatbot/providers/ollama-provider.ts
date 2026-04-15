import {
  AssistantContentSchema,
  type ChatLlmProvider,
  type ChatModelMessage,
  type ChatProviderName,
  type LlmGenerateParams,
  type LlmProviderResult,
} from '@/types/chatbot';

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

function extractJsonPayload(raw: string) {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  return raw.trim();
}

function toOllamaMessages(messages: ChatModelMessage[]) {
  return messages
    .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export const ollamaProvider: ChatLlmProvider = {
  name: 'ollama',
  async generate(params: LlmGenerateParams): Promise<LlmProviderResult> {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'gemma3';
    const temperature = Number(process.env.OLLAMA_TEMPERATURE ?? 0.1);
    const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 30000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          options: { temperature },
          messages: toOllamaMessages(params.messages),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as OllamaChatResponse;
      const modelText = payload.message?.content ?? '';
      const parsed = JSON.parse(extractJsonPayload(modelText)) as unknown;
      const validated = AssistantContentSchema.parse(parsed);

      return {
        assistant: validated.decision === params.requiredDecision
          ? validated
          : { ...validated, decision: params.requiredDecision },
        provider: 'ollama' as ChatProviderName,
        model,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
