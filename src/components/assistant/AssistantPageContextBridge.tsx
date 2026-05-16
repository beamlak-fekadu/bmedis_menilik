'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ChatContextRefs, ChatModuleContext } from '@/types/chatbot';
import { useAssistantContext, type AssistantRegisteredPageContext } from './AssistantProvider';

export interface AssistantPageContextBridgeProps extends ChatModuleContext {
  contextRefs?: ChatContextRefs;
  quickPrompts?: string[];
}

function stableKey(context: AssistantRegisteredPageContext) {
  return JSON.stringify({
    moduleLabel: context.moduleLabel,
    pageLabel: context.pageLabel,
    route: context.route,
    pathname: context.pathname,
    activeTab: context.activeTab,
    searchQuery: context.searchQuery,
    selectedRecordType: context.selectedRecordType,
    selectedRecordId: context.selectedRecordId,
    selectedRecordLabel: context.selectedRecordLabel,
    reportType: context.reportType,
    qrToken: context.qrToken,
    offlineStatus: context.offlineStatus,
    queueStatus: context.queueStatus,
    currentFilters: context.currentFilters,
    visibleCounts: context.visibleCounts,
    pageSummary: context.pageSummary,
    pageDataHints: context.pageDataHints,
    availableEvidenceLinks: context.availableEvidenceLinks,
    contextRefs: context.contextRefs,
    quickPrompts: context.quickPrompts,
  });
}

export function AssistantPageContextBridge(props: AssistantPageContextBridgeProps) {
  const pathname = usePathname();
  const { setPageContext, clearPageContext } = useAssistantContext();
  const context = useMemo<AssistantRegisteredPageContext>(() => ({
    ...props,
    pathname: props.pathname ?? pathname,
    route: props.route ?? pathname,
  }), [props, pathname]);
  const key = useMemo(() => stableKey(context), [context]);

  useEffect(() => {
    setPageContext(context);
    return () => clearPageContext();
  }, [setPageContext, clearPageContext, key, context]);

  return null;
}

export default AssistantPageContextBridge;
