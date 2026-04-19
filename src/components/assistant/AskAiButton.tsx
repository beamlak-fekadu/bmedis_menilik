'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ChatContextRefs } from '@/types/chatbot';
import { useAssistant } from '@/hooks/useAssistant';

interface AskAiButtonProps {
  moduleLabel?: string;
  seedPrompt: string;
  contextRefs?: ChatContextRefs;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function AskAiButton({
  moduleLabel,
  seedPrompt,
  contextRefs,
  label = 'Ask Assistant',
  variant = 'outline',
  size = 'sm',
}: AskAiButtonProps) {
  const { openAssistant } = useAssistant();

  return (
    <Button
      variant={variant}
      size={size}
      className="border-[var(--assistant-accent-soft)] hover:border-[var(--assistant-accent)]"
      onClick={() => openAssistant({ moduleLabel, seedPrompt, contextRefs })}
    >
      <Sparkles className="h-4 w-4 text-[var(--assistant-accent)]" />
      {label}
    </Button>
  );
}
