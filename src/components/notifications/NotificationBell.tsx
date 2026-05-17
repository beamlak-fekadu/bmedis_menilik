'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Inbox, X } from 'lucide-react';
import {
  getMyNotificationsAction,
  getMyNotificationSummaryAction,
  markAllNotificationsReadAction,
  markNotificationStatusAction,
} from '@/actions/notifications.actions';
import type {
  NotificationPriority,
  NotificationRow,
  NotificationSummary,
} from '@/types/notifications';

const POLL_INTERVAL_MS = 45_000;

function priorityClass(priority: NotificationPriority): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/15 text-red-500';
    case 'high':
      return 'bg-orange-500/15 text-orange-500';
    case 'medium':
      return 'bg-amber-500/15 text-amber-500';
    case 'low':
      return 'bg-blue-500/15 text-blue-500';
    case 'info':
    default:
      return 'bg-slate-500/15 text-slate-400';
  }
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [summary, setSummary] = useState<NotificationSummary>({
    unread_total: 0,
    unread_critical: 0,
    unread_by_category: {},
    latest_unread_at: null,
  });
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadSummary = useCallback(async () => {
    const res = await getMyNotificationSummaryAction();
    if (res.success && res.data) setSummary(res.data as NotificationSummary);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyNotificationsAction({ limit: 8 });
      if (res.success && res.data) {
        setNotifications(res.data as NotificationRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    const interval = setInterval(() => {
      void loadSummary();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadSummary]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      await markNotificationStatusAction(id, 'read');
      await Promise.all([loadList(), loadSummary()]);
    },
    [loadList, loadSummary],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      await markNotificationStatusAction(id, 'dismissed');
      await Promise.all([loadList(), loadSummary()]);
    },
    [loadList, loadSummary],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsReadAction();
    await Promise.all([loadList(), loadSummary()]);
  }, [loadList, loadSummary]);

  const unreadCount = summary.unread_total;
  const hasCritical = summary.unread_critical > 0;
  const ariaLabel = unreadCount > 0
    ? `Notifications: ${unreadCount} unread${hasCritical ? `, ${summary.unread_critical} critical` : ''}`
    : 'Notifications';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              hasCritical ? 'bg-red-500' : 'bg-[var(--brand)]'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {hasCritical && (
          <span className="absolute inset-0 rounded-lg ring-2 ring-red-500/30 ring-offset-0" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications drawer"
          className="panel-surface-solid absolute right-0 top-11 z-50 w-[min(92vw,380px)] rounded-xl border border-[var(--border-subtle)] shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Notifications</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {unreadCount > 0
                  ? `${unreadCount} unread${hasCritical ? `, ${summary.unread_critical} critical` : ''}`
                  : 'You are all caught up.'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]"
                  aria-label="Mark all read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                <Inbox className="h-5 w-5" />
                No notifications yet.
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0 ${
                  n.status === 'unread' ? 'bg-[var(--brand-soft)]/40' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-medium ${priorityClass(n.priority)}`}
                    aria-label={`Priority ${n.priority}`}
                  >
                    {n.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]" title={n.title}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--text-muted)]">
                      {n.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {n.action_href && (
                        <Link
                          href={n.action_href}
                          onClick={() => {
                            setOpen(false);
                            void handleMarkRead(n.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
                        >
                          {n.action_label ?? 'Open'}
                        </Link>
                      )}
                      {n.status === 'unread' && (
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(n.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]"
                        >
                          <Check className="h-3 w-3" />
                          Read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDismiss(n.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-right">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-[var(--brand)] hover:underline"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
