'use client';

import { LogOut, Menu, Search, User } from 'lucide-react';
import { APP_NAME_SHORT, HOSPITAL_NAME } from '@/constants';
import Dropdown from '@/components/ui/Dropdown';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher';
import { formatRoleName } from '@/utils/roles';
import SyncStatusIndicator from '@/components/offline/SyncStatusIndicator';
import NotificationBell from '@/components/notifications/NotificationBell';

interface TopbarProps {
  userName?: string;
  userRole?: string;
  userJobTitle?: string | null;
  userRoles?: string[];
  onMenuToggle?: () => void;
  onLogout?: () => void;
}

export default function Topbar({
  userName = 'User',
  userRole = '',
  userJobTitle,
  userRoles = [],
  onMenuToggle,
  onLogout,
}: TopbarProps) {
  // Top-right secondary line shows the user's job title (e.g. "Radiologist",
  // "ICU Head", "Clinical Engineer"). Job titles are FREE TEXT in
  // profiles.job_title and are display-only — they do not control
  // authorization. If a profile has no job_title we fall back to the
  // formatted database role (e.g. "BME Head") so raw lowercase role names
  // like "bme_head" never appear in the Topbar.
  const subtitle = userJobTitle?.trim() ? userJobTitle : formatRoleName(userRole);
  return (
    <header className="panel-surface-muted flex h-16 min-w-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-1)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[var(--text-subtle)]">
            {HOSPITAL_NAME}
          </p>
          <h2 className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">
            {APP_NAME_SHORT}
          </h2>
        </div>
      </div>

      <div className="hidden min-w-[260px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-muted)] backdrop-blur lg:flex lg:min-w-[360px]">
        <Search className="h-4 w-4" />
        <span className="truncate">Search equipment, requests, work orders...</span>
        <span className="ml-auto rounded border border-[var(--border-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-subtle)]">
          ⌘K
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <SyncStatusIndicator userRoles={userRoles} />
        <AssistantLauncher />
        <ThemeToggle />
        <NotificationBell />

        <Dropdown
          trigger={
            <button
              aria-label={`Account: ${userName}`}
              className="flex max-w-[40vw] items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-1)] sm:max-w-none sm:px-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--brand-gradient)' }}>
                <User className="h-4 w-4" />
              </div>
              <div className="hidden min-w-0 text-left md:block">
                <p className="truncate font-medium">{userName}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
              </div>
            </button>
          }
          items={[
            { label: 'Sign Out', onClick: () => onLogout?.(), icon: <LogOut className="h-4 w-4" />, destructive: true },
          ]}
        />
      </div>
    </header>
  );
}
