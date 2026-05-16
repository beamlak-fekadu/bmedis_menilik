import { createClient } from '@/lib/supabase/server';
import { getCopilotTelemetrySummary, getCopilotUsageSummary } from '@/services/chatbot/usage-service';
import CopilotDiagnosticsClient from './CopilotDiagnosticsClient';

export default async function CopilotDiagnosticsSection({ profileId, roleNames }: { profileId: string; roleNames: string[] }) {
  const supabase = await createClient();
  const [summary, telemetry] = await Promise.all([
    getCopilotUsageSummary(supabase, { profileId, roleNames }),
    getCopilotTelemetrySummary(supabase),
  ]);

  return <CopilotDiagnosticsClient initialSummary={summary} initialTelemetry={telemetry} />;
}

