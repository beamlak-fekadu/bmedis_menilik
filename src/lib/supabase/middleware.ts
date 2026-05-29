import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_RETURN_PARAM,
  DEFAULT_AUTH_RETURN_PATH,
  currentPathWithSearch,
  getSafeReturnPathFromSearchParams,
} from '@/lib/auth/return-path';

// `/qr` is public so unauthenticated scans render the friendly login-required
// landing page (src/app/qr/a/[token]) instead of bouncing through /login.
// The route itself only reveals asset details after authentication +
// role/department checks; the unauthenticated branch shows no asset data.
const PUBLIC_PATHS = [
  '/login',
  '/reset-password',
  '/auth/callback',
  '/qr',
  '/offline',
  '/sw.js',
  '/manifest.webmanifest',
  '/offline-health.txt',
  '/api/telegram',
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    const returnTo = currentPathWithSearch(request.nextUrl.pathname, request.nextUrl.search);
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set(AUTH_RETURN_PARAM, returnTo);
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/reset-password')) {
    const url = request.nextUrl.clone();
    const candidate = getSafeReturnPathFromSearchParams(
      request.nextUrl.searchParams,
      DEFAULT_AUTH_RETURN_PATH,
    ) ?? DEFAULT_AUTH_RETURN_PATH;
    const queryStart = candidate.indexOf('?');
    url.pathname = queryStart >= 0 ? candidate.slice(0, queryStart) : candidate;
    url.search = queryStart >= 0 ? candidate.slice(queryStart) : '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
