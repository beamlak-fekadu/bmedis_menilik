'use client';

import { AlertTriangle, Bot, ClipboardCopy, UserCircle2 } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import type { AssistantUiMessage } from './AssistantProvider';
import type { AssistantContent } from '@/types/chatbot';
import { useToast } from '@/components/ui/Toast';
import { ASSISTANT_NAME } from '@/constants';

const BASIS_BADGE_VARIANT: Record<string, 'default' | 'info' | 'purple' | 'warning'> = {
  system_data: 'info',
  manual_or_sop: 'purple',
  general_safe_guidance: 'default',
  insufficient_data: 'warning',
};

const CONFIDENCE_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

function buildCopyText(assistant: AssistantContent) {
  const sections = [
    assistant.title ? `Title: ${assistant.title}` : '',
    `Summary: ${assistant.summary}`,
    assistant.key_findings.length ? `Key findings:\n- ${assistant.key_findings.join('\n- ')}` : '',
    assistant.recommended_actions.length ? `Recommended actions:\n- ${assistant.recommended_actions.join('\n- ')}` : '',
    assistant.priority_reasoning.length ? `Priority reasoning:\n- ${assistant.priority_reasoning.join('\n- ')}` : '',
    assistant.likely_causes.length ? `Likely causes:\n- ${assistant.likely_causes.join('\n- ')}` : '',
    assistant.troubleshooting_steps.length ? `Troubleshooting steps:\n- ${assistant.troubleshooting_steps.join('\n- ')}` : '',
    assistant.maintenance_tips.length ? `Maintenance tips:\n- ${assistant.maintenance_tips.join('\n- ')}` : '',
    assistant.required_tools_or_parts.length ? `Required tools or parts:\n- ${assistant.required_tools_or_parts.join('\n- ')}` : '',
    assistant.escalation_recommendation ? `Escalation recommendation: ${assistant.escalation_recommendation}` : '',
  ].filter(Boolean);
  return sections.join('\n\n');
}

export function AssistantMessageCard({ message }: { message: AssistantUiMessage }) {
  const { toast } = useToast();
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl border p-3 ${
          isUser
            ? 'border-[var(--border-subtle)] bg-[var(--surface-2)]'
            : 'assistant-panel-surface border-[var(--assistant-accent-soft)]'
        }`}
      >
        <div className="mb-2 inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {isUser ? <UserCircle2 className="h-4 w-4" /> : <Bot className="h-4 w-4 text-[var(--assistant-accent)]" />}
          {isUser ? 'You' : ASSISTANT_NAME}
        </div>

        {message.assistant ? (
          <div className="space-y-3 text-sm">
            {message.assistant.title && <p className="font-semibold">{message.assistant.title}</p>}
            <p>{message.assistant.summary || message.content}</p>

            {message.assistant.key_findings.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Key findings</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.key_findings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {message.assistant.recommended_actions.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Recommended actions</p>
                <ol className="list-decimal space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.recommended_actions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {message.assistant.priority_reasoning.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Priority reasoning</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.priority_reasoning.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {message.assistant.likely_causes.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Likely causes</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.likely_causes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {message.assistant.troubleshooting_steps.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Troubleshooting steps</p>
                <ol className="list-decimal space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.troubleshooting_steps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {message.assistant.maintenance_tips.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Maintenance tips</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.maintenance_tips.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {message.assistant.required_tools_or_parts.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Required tools / parts</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {message.assistant.required_tools_or_parts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {message.assistant.escalation_required && (
              <div className="assistant-warning rounded-xl p-3">
                <p className="assistant-warning-strong mb-1 inline-flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Escalation Recommended
                </p>
                <p className="text-sm">
                  {message.assistant.escalation_recommendation || 'Escalate to a qualified biomedical engineer or vendor.'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={BASIS_BADGE_VARIANT[message.assistant.answer_basis] ?? 'default'}>
                Basis: {message.assistant.answer_basis.replace(/_/g, ' ')}
              </Badge>
              <Badge variant={CONFIDENCE_BADGE_VARIANT[message.assistant.confidence] ?? 'warning'}>
                Confidence: {message.assistant.confidence}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(buildCopyText(message.assistant as AssistantContent));
                  toast('success', 'Assistant response copied');
                }}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy
              </Button>
            </div>

            {message.assistant.follow_up_suggestions.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Suggested follow-ups</p>
                <div className="flex flex-wrap gap-2">
                  {message.assistant.follow_up_suggestions.map((item) => (
                    <Badge key={item} variant="default">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm">{message.content}</p>
        )}
      </div>
    </div>
  );
}
