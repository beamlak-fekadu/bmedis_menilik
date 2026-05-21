import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runGlobalSearch, type GlobalSearchProfile } from '@/services/global-search.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, department_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: profileError?.message ?? 'Profile not found' }, { status: 403 });
  }

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', (profile as { id: string }).id);

  const roleNames = ((roleRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => ((row.roles as { name?: string } | null)?.name ?? null))
    .filter(Boolean) as string[];

  try {
    const groups = await runGlobalSearch(supabase as never, {
      id: (profile as { id: string }).id,
      department_id: (profile as { department_id: string | null }).department_id ?? null,
      roleNames,
    } satisfies GlobalSearchProfile, q);
    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    console.error('[global-search]', message);
    return NextResponse.json({ error: 'Search could not load results', detail: message }, { status: 500 });
  }
}
