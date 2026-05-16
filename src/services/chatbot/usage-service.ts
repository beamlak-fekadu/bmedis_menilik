import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilityId, UserChatProfile } from '@/types/chatbot';
import { canInspectCopilotTelemetry } from './copilot-rbac';
import { estimateTokensFromChars, getCopilotUsageLimits, type UsageSource } from './usage-limits';

type ProviderStatus = 'success' | 'fallback' | 'failure';

export interface CopilotUsageSnapshot {
  requestsToday: number;
  tokensToday: number;
  usageSource: 'provider_reported' | 'estimated' | 'mixed' | 'none';
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  warning: string | null;
  hardLimited: boolean;
}

export interface CopilotUsageSummary extends CopilotUsageSnapshot {
  model: string;
  providerConfigured: boolean;
  providerFailuresToday: number;
  fallbackEventsToday: number;
  parserRecoveryEventsToday: number;
  deterministicFallbackEventsToday: number;
  blockedRequestsToday: number;
  topCapabilities: Array<{ capability: string; count: number }>;
  roleUsage: Array<{ role: string; count: number }>;
  recentEvents: Array<{
    created_at: string;
    provider: string;
    model: string | null;
    capability: string | null;
    provider_status: string;
    usage_source: string;
    estimated_tokens: number | null;
    total_tokens: number | null;
    fallback_reason: string | null;
  }>;
  recentProviderErrors: Array<{ created_at: string; fallback_reason: string | null; metadata: Record<string, unknown> | null }>;
  actionDraftsExecutedToday: number;
  actionDraftsByKindToday: Array<{ kind: string; count: number }>;
}

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function usageSourceFromRows(rows: Array<{ usage_source?: string | null }>): CopilotUsageSnapshot['usageSource'] {
  const sources = new Set(rows.map((row) => row.usage_source).filter(Boolean));
  if (sources.size === 0) return 'none';
  if (sources.size > 1) return 'mixed';
  const source = Array.from(sources)[0];
  return source === 'provider_reported' ? 'provider_reported' : 'estimated';
}

export function extractProviderUsage(metadata: Record<string, unknown> | null | undefined) {
  const usage = metadata?.usage;
  if (!usage || typeof usage !== 'object') return {};
  return usage as {
    promptChars?: number;
    completionChars?: number;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    estimatedTokens?: number | null;
    usageSource?: UsageSource;
  };
}

export async function logCopilotUsageEvent(params: {
  supabase: SupabaseClient;
  profile: UserChatProfile;
  sessionId: string;
  provider: string;
  model: string;
  capability: CapabilityId;
  route?: string | null;
  promptChars: number;
  completionChars: number;
  providerStatus: ProviderStatus;
  fallbackReason?: string | null;
  latencyMs?: number | null;
  providerMetadata?: Record<string, unknown> | null;
}) {
  const usage = extractProviderUsage(params.providerMetadata);
  const promptTokens = usage.promptTokens ?? null;
  const completionTokens = usage.completionTokens ?? null;
  const totalTokens = usage.totalTokens ?? (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
  const estimatedTokens = totalTokens == null
    ? estimateTokensFromChars(params.promptChars + params.completionChars)
    : null;
  const usageSource: UsageSource = totalTokens == null ? 'estimated' : 'provider_reported';

  try {
    await params.supabase.from('copilot_usage_events').insert({
      profile_id: params.profile.profileId,
      user_id: params.profile.userId ?? null,
      session_id: params.sessionId,
      provider: params.provider,
      model: params.model,
      capability: params.capability,
      role_names: params.profile.roleNames,
      route: params.route ?? null,
      prompt_chars: params.promptChars,
      completion_chars: params.completionChars,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_tokens: estimatedTokens,
      usage_source: usageSource,
      provider_status: params.providerStatus,
      fallback_reason: params.fallbackReason ?? null,
      latency_ms: params.latencyMs ?? null,
      metadata: params.providerMetadata ?? null,
    });
  } catch (error) {
    console.warn('[chatbot][usage] insert skipped', { message: error instanceof Error ? error.message : String(error) });
  }
}

export async function getOwnCopilotUsageSnapshot(
  supabase: SupabaseClient,
  profileId: string
): Promise<CopilotUsageSnapshot> {
  const limits = getCopilotUsageLimits();
  const { data, error } = await supabase
    .from('copilot_usage_events')
    .select('usage_source, total_tokens, estimated_tokens')
    .eq('profile_id', profileId)
    .gte('created_at', startOfTodayIso())
    .limit(5000);

  if (error) {
    return {
      requestsToday: 0,
      tokensToday: 0,
      usageSource: 'none',
      dailyRequestLimit: limits.dailyRequestLimitPerUser,
      dailyTokenLimit: limits.dailyTokenLimitPerUser,
      warning: null,
      hardLimited: false,
    };
  }

  const rows = (data ?? []) as Array<{ usage_source?: string | null; total_tokens?: number | null; estimated_tokens?: number | null }>;
  const tokensToday = rows.reduce((sum, row) => sum + Number(row.total_tokens ?? row.estimated_tokens ?? 0), 0);
  const requestNear = limits.dailyRequestLimitPerUser != null && rows.length >= Math.floor(limits.dailyRequestLimitPerUser * limits.softWarningPercent);
  const tokenNear = limits.dailyTokenLimitPerUser != null && tokensToday >= Math.floor(limits.dailyTokenLimitPerUser * limits.softWarningPercent);
  const hardLimited = Boolean(
    limits.hardLimitEnabled &&
      ((limits.dailyRequestLimitPerUser != null && rows.length >= limits.dailyRequestLimitPerUser) ||
        (limits.dailyTokenLimitPerUser != null && tokensToday >= limits.dailyTokenLimitPerUser))
  );

  return {
    requestsToday: rows.length,
    tokensToday,
    usageSource: usageSourceFromRows(rows),
    dailyRequestLimit: limits.dailyRequestLimitPerUser,
    dailyTokenLimit: limits.dailyTokenLimitPerUser,
    warning: hardLimited ? 'AI usage limit reached' : requestNear || tokenNear ? 'Usage near daily limit' : null,
    hardLimited,
  };
}

export async function getCopilotUsageSummary(
  supabase: SupabaseClient,
  profile: Pick<UserChatProfile, 'profileId' | 'roleNames'>
): Promise<CopilotUsageSummary> {
  const own = await getOwnCopilotUsageSnapshot(supabase, profile.profileId);
  const canInspect = canInspectCopilotTelemetry(profile);
  const baseQuery = supabase
    .from('copilot_usage_events')
    .select('created_at, provider, model, capability, role_names, usage_source, provider_status, fallback_reason, total_tokens, estimated_tokens, metadata')
    .gte('created_at', startOfTodayIso())
    .order('created_at', { ascending: false })
    .limit(canInspect ? 500 : 50);
  const { data: usageRows, error: usageError } = canInspect ? await baseQuery : await baseQuery.eq('profile_id', profile.profileId);
  if (usageError) {
    return {
      ...own,
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      providerConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      providerFailuresToday: 0,
      fallbackEventsToday: 0,
      parserRecoveryEventsToday: 0,
      deterministicFallbackEventsToday: 0,
      blockedRequestsToday: 0,
      topCapabilities: [],
      roleUsage: [],
      recentEvents: [],
      recentProviderErrors: [],
      actionDraftsExecutedToday: 0,
      actionDraftsByKindToday: [],
    };
  }
  const rows = (usageRows ?? []) as Array<Record<string, unknown>>;

  const { data: telemetryRows } = canInspect
    ? await supabase
        .from('chat_telemetry_events')
        .select('blocked, parsing_recovery_used, capability, role_names, metadata, created_at')
        .gte('created_at', startOfTodayIso())
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] };
  const telemetry = (telemetryRows ?? []) as Array<Record<string, unknown>>;

  const capabilityCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  for (const row of rows) {
    const capability = String(row.capability ?? 'unknown');
    capabilityCounts.set(capability, (capabilityCounts.get(capability) ?? 0) + 1);
    const roleNames = Array.isArray(row.role_names) ? row.role_names : [];
    for (const role of roleNames) {
      const roleName = String(role);
      roleCounts.set(roleName, (roleCounts.get(roleName) ?? 0) + 1);
    }
  }

  // Phase 3: copilot-assisted action drafts executed today (from audit_logs).
  let actionDraftsExecutedToday = 0;
  const draftKindCounts = new Map<string, number>();
  if (canInspect) {
    const { data: auditRows } = await supabase
      .from('audit_logs')
      .select('action, created_at')
      .gte('created_at', startOfTodayIso())
      .like('action', 'copilot.draft.executed.%')
      .limit(500);
    const audits = (auditRows ?? []) as Array<{ action?: string | null }>;
    actionDraftsExecutedToday = audits.length;
    for (const row of audits) {
      const action = String(row.action ?? '');
      const kind = action.replace('copilot.draft.executed.', '') || 'unknown';
      draftKindCounts.set(kind, (draftKindCounts.get(kind) ?? 0) + 1);
    }
  } else {
    const { data: auditRows } = await supabase
      .from('audit_logs')
      .select('action, created_at')
      .gte('created_at', startOfTodayIso())
      .eq('user_id', profile.profileId)
      .like('action', 'copilot.draft.executed.%')
      .limit(200);
    const audits = (auditRows ?? []) as Array<{ action?: string | null }>;
    actionDraftsExecutedToday = audits.length;
    for (const row of audits) {
      const action = String(row.action ?? '');
      const kind = action.replace('copilot.draft.executed.', '') || 'unknown';
      draftKindCounts.set(kind, (draftKindCounts.get(kind) ?? 0) + 1);
    }
  }

  const providerFailuresToday = rows.filter((row) => row.provider_status === 'failure').length;
  const fallbackEventsToday = rows.filter((row) => row.provider_status === 'fallback').length;
  const parserRecoveryEventsToday = telemetry.filter((row) => row.parsing_recovery_used === true).length;
  const deterministicFallbackEventsToday = telemetry.filter((row) => {
    const metadata = row.metadata as { providerMetadata?: { deterministicContextFallbackUsed?: boolean } } | null;
    return metadata?.providerMetadata?.deterministicContextFallbackUsed === true;
  }).length;

  return {
    ...own,
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    providerConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    providerFailuresToday,
    fallbackEventsToday,
    parserRecoveryEventsToday,
    deterministicFallbackEventsToday,
    blockedRequestsToday: telemetry.filter((row) => row.blocked === true).length,
    topCapabilities: Array.from(capabilityCounts.entries()).map(([capability, count]) => ({ capability, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    roleUsage: Array.from(roleCounts.entries()).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
    recentEvents: rows.slice(0, 20).map((row) => ({
      created_at: String(row.created_at ?? ''),
      provider: String(row.provider ?? 'gemini'),
      model: typeof row.model === 'string' ? row.model : null,
      capability: typeof row.capability === 'string' ? row.capability : null,
      provider_status: String(row.provider_status ?? 'success'),
      usage_source: String(row.usage_source ?? 'estimated'),
      estimated_tokens: typeof row.estimated_tokens === 'number' ? row.estimated_tokens : null,
      total_tokens: typeof row.total_tokens === 'number' ? row.total_tokens : null,
      fallback_reason: typeof row.fallback_reason === 'string' ? row.fallback_reason : null,
    })),
    recentProviderErrors: rows
      .filter((row) => row.provider_status === 'failure' || row.provider_status === 'fallback')
      .slice(0, 10)
      .map((row) => ({
        created_at: String(row.created_at ?? ''),
        fallback_reason: typeof row.fallback_reason === 'string' ? row.fallback_reason : null,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      })),
    actionDraftsExecutedToday,
    actionDraftsByKindToday: Array.from(draftKindCounts.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

export async function getCopilotTelemetrySummary(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('chat_telemetry_events')
    .select('created_at, capability, confidence_score, confidence_label, blocked, fallback_reason, parsing_recovery_used, metadata')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as Array<Record<string, unknown>>;
}
