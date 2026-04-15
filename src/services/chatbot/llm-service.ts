import type { LlmGenerateParams } from '@/types/chatbot';
import { getChatProvider } from './providers';

export async function generateAssistantContent(params: LlmGenerateParams) {
  const provider = getChatProvider();
  return provider.generate(params);
}
