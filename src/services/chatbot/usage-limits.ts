export type UsageSource = 'provider_reported' | 'estimated';

export interface CopilotUsageLimits {
  dailyRequestLimitPerUser: number | null;
  dailyTokenLimitPerUser: number | null;
  monthlyTokenLimitGlobal: number | null;
  softWarningPercent: number;
  hardLimitEnabled: boolean;
}

function readPositiveInt(name: string, fallback: number | null) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPercent(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed > 1 ? Math.min(parsed / 100, 1) : Math.min(parsed, 1);
}

export function getCopilotUsageLimits(): CopilotUsageLimits {
  return {
    dailyRequestLimitPerUser: readPositiveInt('COPILOT_DAILY_REQUEST_LIMIT_PER_USER', 100),
    dailyTokenLimitPerUser: readPositiveInt('COPILOT_DAILY_TOKEN_LIMIT_PER_USER', 100_000),
    monthlyTokenLimitGlobal: readPositiveInt('COPILOT_MONTHLY_TOKEN_LIMIT_GLOBAL', null),
    softWarningPercent: readPercent('COPILOT_SOFT_WARNING_PERCENT', 0.8),
    hardLimitEnabled: (process.env.COPILOT_HARD_LIMIT_ENABLED ?? '').toLowerCase() === 'true',
  };
}

export function estimateTokensFromChars(chars: number) {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.ceil(chars / 4);
}

export function formatApproxTokens(tokens: number) {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k`;
  return String(tokens);
}

