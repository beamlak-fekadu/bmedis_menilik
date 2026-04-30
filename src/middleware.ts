import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Redirect deprecated routes to their new canonical destinations.
const DEPRECATED_REDIRECTS: Array<{ from: string; to: string; exact?: boolean }> = [
  { from: '/decision-support', to: '/command' },
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
