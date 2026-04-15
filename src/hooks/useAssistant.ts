'use client';

import { useAssistantContext } from '@/components/assistant/AssistantProvider';

export function useAssistant() {
  return useAssistantContext();
}
