export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bmerms-ui-theme';
export const THEME_COOKIE_KEY = 'bmerms-ui-theme';
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const DEFAULT_SERVER_THEME: ResolvedTheme = 'dark';

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function getServerThemeFromPreference(preference: ThemePreference | undefined): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return DEFAULT_SERVER_THEME;
}
