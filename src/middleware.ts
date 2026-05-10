import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Redirect deprecated routes to their new canonical destinations.
const DEPRECATED_REDIRECTS: Array<{ from: string; to: string; exact?: boolean; search?: string }> = [
  { from: '/decision-support', to: '/command' },
  { from: '/decision-support-health', to: '/developer-lab', exact: true },
  { from: '/command/health', to: '/developer-lab', exact: true },
  { from: '/helpdesk', to: '/requests', exact: true },
  { from: '/users', to: '/settings', exact: true, search: '?tab=staff-access' },
  { from: '/security', to: '/settings', exact: true, search: '?tab=security-access' },
  { from: '/dashboard/analytical', to: '/command', exact: true },
  { from: '/dashboard/work-orders', to: '/work-orders', exact: true },
  { from: '/dashboard', to: '/command', exact: true },
  { from: '/analytics/reliability', to: '/command', exact: true },
  { from: '/analytics/risk', to: '/command', exact: true },
  { from: '/analytics/pmc', to: '/pm', exact: true },
  { from: '/analytics/performance', to: '/command', exact: true },
  { from: '/analytics', to: '/command', exact: true },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const rule of DEPRECATED_REDIRECTS) {
    const matches = rule.exact ? pathname === rule.from : pathname.startsWith(rule.from);
    if (matches) {
      const url = request.nextUrl.clone();
      url.pathname = rule.to;
      if (rule.search) url.search = rule.search;
      return NextResponse.redirect(url, { status: 301 });
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
