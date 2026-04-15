import { type ChatLlmProvider, type ChatProviderName } from '@/types/chatbot';
import { groqProvider } from './groq-provider';
import { ollamaProvider } from './ollama-provider';
import { stubProvider } from './stub-provider';

const PROVIDERS: Record<ChatProviderName, ChatLlmProvider> = {
  stub: stubProvider,
  ollama: ollamaProvider,
  groq: groqProvider,
};

function resolveProviderName() {
  const configured = (process.env.CHAT_PROVIDER ?? 'stub').toLowerCase();
  if (configured === 'groq') return 'groq';
  if (configured === 'ollama') return 'ollama';
  return 'stub';
}

export function getChatProvider() {
  const providerName = resolveProviderName();
  return PROVIDERS[providerName];
}
