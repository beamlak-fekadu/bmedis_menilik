'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Bot, MessageSquareText, Plus, Send, X } from 'lucide-react';
import { Button, EmptyState, Spinner, Textarea } from '@/components/ui';
import { AssistantContextChips } from './AssistantContextChips';
import { AssistantMessageCard } from './AssistantMessageCard';
import { useAssistantContext } from './AssistantProvider';

const QUICK_PROMPTS_BY_MODULE: Record<string, string[]> = {
  Equipment: [
    'Summarize this equipment status and history.',
    'What safe first-line checks should I do first?',
  ],
  Maintenance: [
    'Summarize this work order and suggest next safe steps.',
    'Generate concise closure notes for technician handoff.',
  ],
  'Preventive Maintenance': [
    'Explain the overdue PM concerns and likely impact.',
    'Generate PM tips for this equipment category.',
  ],
  Logistics: [
    'Explain possible stockout risks and next steps.',
    'Summarize spare-parts issues affecting maintenance.',
  ],
  'Decision Support': [
    'Explain why this item is high risk or high priority.',
    'Explain MTTR/MTBF and replacement priority in practical terms.',
  ],
  Reporting: ['Summarize key operational trends from this module.'],
  Operations: ['What should I check first based on current operations context?'],
};

export function AssistantPanel() {
  const {
    isOpen,
    sending,
    draftInput,
    messages,
    moduleLabel,
    closeAssistant,
    sendMessage,
    setDraftInput,
    contextRefs,
    clearContextRefs,
    startNewSession,
  } = useAssistantContext();
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = useMemo(
    () => QUICK_PROMPTS_BY_MODULE[moduleLabel] ?? QUICK_PROMPTS_BY_MODULE.Operations,
    [moduleLabel]
  );

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const onInputKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = async (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    await sendMessage();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[81] bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeAssistant}
      />

      <aside
        className={`assistant-panel fixed bottom-0 right-0 top-0 z-[82] w-full max-w-xl transform border-l border-[var(--assistant-accent-soft)] transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="assistant-panel-surface flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--assistant-accent-soft)] px-4 py-3">
            <div className="inline-flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[var(--assistant-accent)]" />
              <p className="text-sm font-semibold">Biomedical AI Copilot</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={startNewSession}>
                <Plus className="h-4 w-4" />
                New chat
              </Button>
              <Button variant="ghost" size="icon" onClick={closeAssistant}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <AssistantContextChips moduleLabel={moduleLabel} contextRefs={contextRefs} onClear={clearContextRefs} />
          </div>

          <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <EmptyState
                title="Ask for maintenance, PM, analytics, or troubleshooting help"
                description="The assistant is safety-gated and will refuse unsupported technical detail."
                icon={<Bot className="h-10 w-10 text-[var(--assistant-accent)]" />}
              />
            ) : (
              messages.map((message) => <AssistantMessageCard key={message.id} message={message} />)
            )}

            {sending && (
              <div className="assistant-panel-surface rounded-2xl border border-[var(--assistant-accent-soft)] p-4">
                <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Spinner size="sm" />
                  Generating response...
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--assistant-accent-soft)] px-4 py-4">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setDraftInput(prompt)}
                  className="rounded-full border border-[var(--assistant-accent-soft)] px-3 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              value={draftInput}
              onChange={(event) => setDraftInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Ask for safe operational guidance..."
              className="border-[var(--assistant-accent-soft)] bg-[var(--surface-1)]"
              disabled={sending}
            />
            <div className="flex justify-end">
              <Button onClick={() => void sendMessage()} loading={sending} disabled={!draftInput.trim() || sending}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
