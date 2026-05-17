// /alerts is preserved purely as a fallback redirect target. The middleware in
// src/middleware.ts already 301-redirects /alerts → /notifications before this
// page handler runs; this client-side fallback exists in case a deployment
// caches a route stub or the user lands here without middleware. The legacy
// recommendation_flags table is still useful internally as a notification
// trigger source, but it is no longer rendered here.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

export default function LegacyAlertsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/notifications');
  }, [router]);
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-5 w-5 text-[var(--brand)]" />
        <p className="text-lg font-semibold text-[var(--foreground)]">Alerts moved to Notifications</p>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        The Alerts page has been consolidated into the unified Notification Center.
        You are being redirected now.
      </p>
      <Link
        href="/notifications"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Open Notifications
      </Link>
    </div>
  );
}
