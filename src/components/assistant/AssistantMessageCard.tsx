'use client';

import Link from 'next/link';
import { AlertTriangle, Bot, ClipboardCopy, ExternalLink, UserCircle2 } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import type { AssistantUiMessage } from './AssistantProvider';
import type { AssistantContent } from '@/types/chatbot';
import { useToast } from '@/components/ui/Toast';
import { ASSISTANT_NAME } from '@/constants';
import { buildAssistantCopyText, displayableAssistantSummary } from './assistant-ui-display';
import { normalizeAssistantPayloadForUi } from '@/services/chatbot/chat-response-normalizer';
import { CopilotActionCard } from './CopilotActionCard';

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

export function AssistantMessageCard({ message }: { message: AssistantUiMessage }) {
  const { toast } = useToast();
  const isUser = message.role === 'user';
  const assistant = message.assistant ? normalizeAssistantPayloadForUi(message.assistant, message.content) : undefined;

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

        {assistant ? (
          <div className="space-y-3 text-sm">
            {assistant.title && <p className="font-semibold">{assistant.title}</p>}
            {(message.intent || message.capability || message.fallbackReason) && (
              <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                {message.intent ? (
                  <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5">Intent: {message.intent}</span>
                ) : null}
                {message.capability ? (
                  <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5">{message.capability}</span>
                ) : null}
                {message.fallbackReason ? (
                  <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5">Fallback: {message.fallbackReason}</span>
                ) : null}
              </div>
            )}
            <p>
              {displayableAssistantSummary(assistant.summary) ||
                message.content?.trim() ||
                'The assistant could not return text. Please retry or escalate via standard channels.'}
            </p>

            {assistant.intelligence_mode && (
              <Badge variant="info" className="text-xs capitalize">
                Mode: {assistant.intelligence_mode.replace(/_/g, ' ')}
              </Badge>
            )}

            {(assistant.proactive_signals?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 font-semibold">Operational signals</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.proactive_signals ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.key_findings ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Key findings</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.key_findings ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.evidence_used ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Evidence used</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.evidence_used ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.links ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Links</p>
                <div className="flex flex-wrap gap-2">
                  {(assistant.links ?? []).map((link) => (
                    <Link
                      key={`${link.href}-${link.label}`}
                      href={link.href}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--foreground)] hover:border-[var(--assistant-accent-soft)]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {(assistant.recommended_actions ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Recommended actions</p>
                <ol className="list-decimal space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.recommended_actions ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {(assistant.priority_reasoning ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Priority reasoning</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.priority_reasoning ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.likely_causes ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Likely causes</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.likely_causes ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.troubleshooting_steps ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Troubleshooting steps</p>
                <ol className="list-decimal space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.troubleshooting_steps ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {(assistant.maintenance_tips ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Maintenance tips</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.maintenance_tips ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.required_tools_or_parts ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Required tools / parts</p>
                <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                  {(assistant.required_tools_or_parts ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {assistant.escalation_required && (
              <div className="assistant-warning rounded-xl p-3">
                <p className="assistant-warning-strong mb-1 inline-flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Escalation Recommended
                </p>
                <p className="text-sm">
                  {assistant.escalation_recommendation || 'Escalate to a qualified biomedical engineer or vendor.'}
                </p>
              </div>
            )}

            {(assistant.action_drafts ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="mb-1 font-semibold">Suggested actions</p>
                {(assistant.action_drafts ?? []).map((draft) => (
                  <CopilotActionCard key={draft.id} draft={draft} messageId={message.id} />
                ))}
              </div>
            )}

            {((assistant.limitations ?? []).length > 0 || assistant.data_freshness || (assistant.source_tables ?? []).length > 0) && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-2 text-xs text-[var(--text-muted)]">
                {assistant.data_freshness && <p>Freshness: {assistant.data_freshness}</p>}
                {(assistant.source_tables ?? []).length > 0 && <p>Sources: {(assistant.source_tables ?? []).join(', ')}</p>}
                {(assistant.limitations ?? []).length > 0 && <p>Limits: {(assistant.limitations ?? []).join('; ')}</p>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge
                variant={BASIS_BADGE_VARIANT[assistant.answer_basis ?? 'insufficient_data'] ?? 'default'}
              >
                Basis: {(assistant.answer_basis ?? 'insufficient_data').replace(/_/g, ' ')}
              </Badge>
              <Badge variant={CONFIDENCE_BADGE_VARIANT[assistant.confidence ?? 'low'] ?? 'warning'}>
                Confidence: {assistant.confidence ?? 'low'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(buildAssistantCopyText(assistant as AssistantContent));
                  toast('success', 'Assistant response copied');
                }}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy
              </Button>
            </div>

            {(assistant.follow_up_suggestions ?? []).length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Suggested follow-ups</p>
                <div className="flex flex-wrap gap-2">
                  {(assistant.follow_up_suggestions ?? []).map((item) => (
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
