import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { hasCapability, type Capability } from '@/lib/rbac';

export async function getServerUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getServerProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(name)')
    .eq('user_id', profile.id);

  const roleNames = (userRoles || [])
    .map((ur: Record<string, unknown>) => {
      const roles = ur.roles as { name: string } | null;
      return roles?.name;
    })
    .filter(Boolean) as string[];

  return { ...profile, roleNames };
}

export async function requireAuth() {
  const user = await getServerUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const profile = await getServerProfile();
  if (!profile) redirect('/login');
  const hasRole = profile.roleNames.includes('developer') || profile.roleNames.some((r: string) => allowedRoles.includes(r));
  if (!hasRole) redirect('/');
  return profile;
}

// R23: capability-based server gate. Use in server components / server actions
// to enforce the same capability matrix the client shell uses. Prefer this
// over requireRole(['admin', 'bme_head', ...]) for new code — it stays in sync
// with src/lib/rbac.ts as the capability matrix evolves.
export async function requireCapability(capability: Capability) {
  const profile = await getServerProfile();
  if (!profile) redirect('/login');
  if (!hasCapability(profile.roleNames, capability)) redirect('/');
  return profile;
}
