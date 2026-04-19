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
  const shortRef = (value: string) => `${value.slice(0, 8)}...`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Module: {moduleLabel}</Badge>
        {contextRefs?.equipmentId && <Badge variant="purple">Equipment: {shortRef(contextRefs.equipmentId)}</Badge>}
        {contextRefs?.workOrderId && <Badge variant="purple">Work order: {shortRef(contextRefs.workOrderId)}</Badge>}
        {contextRefs?.departmentId && <Badge variant="purple">Department: {shortRef(contextRefs.departmentId)}</Badge>}
      </div>
      {hasRefs && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear linked context
        </Button>
      )}
    </div>
  );
}
