'use client';

import type { ReactNode } from 'react';
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { AssistantProvider } from '@/components/assistant/AssistantProvider';

// QR routes live outside the (dashboard) route group, so they do not inherit
// the dashboard's AssistantProvider. The authenticated QR landing page uses
// AssistantPageContextBridge for Copilot page-awareness, which calls
// useAssistantContext() and would throw without a provider above it.
//
// This shell provides the existing AssistantProvider plus the existing
// launcher/panel only — no DashboardLayout, sidebar, or topbar. QR remains
// outside the dashboard shell. The QR token itself never grants permissions;
// auth + role on the server still decide what is rendered.
export function QrLandingClientShell({ children }: { children: ReactNode }) {
  return (
    <AssistantProvider>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[81]">
        <AssistantLauncher />
      </div>
      <AssistantPanel />
    </AssistantProvider>
  );
}

export default QrLandingClientShell;
