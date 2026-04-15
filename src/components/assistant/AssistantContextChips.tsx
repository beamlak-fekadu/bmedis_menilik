'use client';

import { Badge, Button } from '@/components/ui';
import type { ChatContextRefs } from '@/types/chatbot';

interface AssistantContextChipsProps {
  moduleLabel: string;
  contextRefs?: ChatContextRefs;
  onClear: () => void;
}

export function AssistantContextChips({ moduleLabel, contextRefs, onClear }: AssistantContextChipsProps) {
  const hasRefs = Boolean(contextRefs?.equipmentId || contextRefs?.workOrderId || contextRefs?.departmentId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Module: {moduleLabel}</Badge>
        {contextRefs?.equipmentId && <Badge variant="purple">Equipment linked</Badge>}
        {contextRefs?.workOrderId && <Badge variant="purple">Work order linked</Badge>}
        {contextRefs?.departmentId && <Badge variant="purple">Department linked</Badge>}
      </div>
      {hasRefs && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear linked context
        </Button>
      )}
    </div>
  );
}
