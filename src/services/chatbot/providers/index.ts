import { type ChatLlmProvider, type ChatProviderName } from '@/types/chatbot';
import { geminiProvider } from './gemini-provider';

const PROVIDERS: Record<ChatProviderName, ChatLlmProvider> = {
  gemini: geminiProvider,
};

function resolveProviderName() {
  const configured = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase();
  return (configured === 'gemini' ? 'gemini' : 'gemini') as ChatProviderName;
}

export function getChatProvider() {
  const providerName = resolveProviderName();
  return PROVIDERS[providerName];
}
