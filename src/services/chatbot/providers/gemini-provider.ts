import {
  type ChatLlmProvider,
  type ChatModelMessage,
  type LlmGenerateParams,
  type LlmProviderResult,
} from '@/types/chatbot';
import { normalizeProviderOutput } from './normalize-provider-output';

interface GeminiResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }>;
}

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function debugRawProviderLogs() {
  return (process.env.CHAT_DEBUG_RAW_PROVIDER ?? '').toLowerCase() === 'true';
}

function toOpenAiMessages(messages: ChatModelMessage[]) {
  return messages
    .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

async function requestGeminiWithRetry(
  url: string,
  apiKey: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  retries: number
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Gemini request failed (${response.status}): ${details || 'No response body'}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delayMs = 300 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini request failed after retries.');
}

export const geminiProvider: ChatLlmProvider = {
  name: 'gemini',
  async generate(params: LlmGenerateParams): Promise<LlmProviderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
    }

    const baseUrl = process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai/';
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const timeoutMs = readNumberEnv('GEMINI_TIMEOUT_MS', 30000);
    const retries = Math.max(0, readNumberEnv('GEMINI_RETRY_COUNT', 1));
    const temperature = Number(process.env.GEMINI_TEMPERATURE ?? 0.1);
    const maxCompletionTokens = readNumberEnv('GEMINI_MAX_COMPLETION_TOKENS', 900);
    const shouldDebugRaw = debugRawProviderLogs();

    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await requestGeminiWithRetry(
      url,
      apiKey,
      {
        model,
        temperature,
        response_format: { type: 'json_object' },
        max_completion_tokens: maxCompletionTokens,
        messages: toOpenAiMessages(params.messages),
      },
      timeoutMs,
      retries
    );

    const rawResponseText = await response.text();
    const parsedPayload = (() => {
      try {
        return JSON.parse(rawResponseText) as GeminiResponse;
      } catch {
        return null;
      }
    })();
    const modelText = parsedPayload?.choices?.[0]?.message?.content ?? rawResponseText;
    const normalized = normalizeProviderOutput(modelText, params.requiredDecision);

    if (shouldDebugRaw) {
      console.info('[chatbot][gemini][raw-response]', {
        provider: 'gemini',
        modelConfigured: model,
        modelReturned: parsedPayload?.model ?? model,
        finishReason: parsedPayload?.choices?.[0]?.finish_reason ?? null,
        responseId: parsedPayload?.id ?? null,
      });
    }

    return {
      assistant: normalized.assistant,
      provider: 'gemini',
      model: parsedPayload?.model ?? model,
      providerMetadata: {
        parser: normalized.metadata,
        finishReason: parsedPayload?.choices?.[0]?.finish_reason ?? null,
        responseId: parsedPayload?.id ?? null,
        retries,
        maxCompletionTokens,
        nonJsonProviderBody: parsedPayload ? false : true,
      },
    };
  },
};
