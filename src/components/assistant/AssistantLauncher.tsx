'use client';

import { Bot } from 'lucide-react';
import { useAssistantContext } from './AssistantProvider';
import { ASSISTANT_NAME } from '@/constants';

export function AssistantLauncher() {
  const { isOpen, openAssistant } = useAssistantContext();

  if (isOpen) return null;

  return (
    <button
      onClick={() => openAssistant()}
      className="assistant-launcher fixed bottom-5 right-5 z-[80] inline-flex items-center gap-2 rounded-full border border-[var(--assistant-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
      aria-label={`Open ${ASSISTANT_NAME}`}
    >
      <Bot className="h-4 w-4 text-[var(--assistant-accent)]" />
      Ask Assistant
    </button>
  );
}
