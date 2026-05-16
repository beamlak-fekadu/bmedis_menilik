'use client';

import type { ReactNode } from 'react';
import { AssistantProvider } from '@/components/assistant/AssistantProvider';

// QR routes live outside the (dashboard) route group, so they do not inherit
// the dashboard's AssistantProvider. The authenticated QR landing page uses
// AssistantPageContextBridge for Copilot page-awareness, which calls
// useAssistantContext() and would throw without a provider above it.
//
// This shell provides AssistantProvider only — no DashboardLayout, sidebar,
// topbar, or AssistantLauncher. QR remains outside the dashboard shell. The
// QR token itself never grants permissions; auth + role on the server still
// decide what is rendered.
export function QrLandingClientShell({ children }: { children: ReactNode }) {
  return <AssistantProvider>{children}</AssistantProvider>;
}

export default QrLandingClientShell;
