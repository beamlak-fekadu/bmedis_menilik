import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  AUTH_RETURN_PARAM,
  DEFAULT_AUTH_RETURN_PATH,
  getSafeReturnPathFromSearchParams,
} from '@/lib/auth/return-path';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeReturnPathFromSearchParams(searchParams, DEFAULT_AUTH_RETURN_PATH) ?? DEFAULT_AUTH_RETURN_PATH;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const login = new URL('/login', origin);
  login.searchParams.set('error', 'auth_callback_error');
  login.searchParams.set(AUTH_RETURN_PARAM, next);
  return NextResponse.redirect(login);
}
