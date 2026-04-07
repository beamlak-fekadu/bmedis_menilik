import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/types/database';

const PROFILE_SELECT = `
  id, user_id, full_name, email, phone, department_id,
  avatar_url, job_title, is_active, created_at, updated_at,
  departments(id, name, code),
  user_roles(id, role_id, assigned_at, roles(id, name, description, permissions))
`;

const PROFILE_SIMPLE_SELECT = `
  id, user_id, full_name, email, phone, department_id,
  avatar_url, job_title, is_active, created_at, updated_at
`;

export async function getProfiles() {
  const supabase = createClient();
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('is_active', true)
    .order('full_name', { ascending: true });
}

export async function getProfileById(id: string) {
  const supabase = createClient();
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', id)
    .single();
}

export async function updateProfile(id: string, data: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'department' | 'roles'>>) {
  const supabase = createClient();
  return supabase
    .from('profiles')
    .update(data)
    .eq('id', id)
    .select(PROFILE_SIMPLE_SELECT)
    .single();
}

export async function getRoles() {
  const supabase = createClient();
  return supabase
    .from('roles')
    .select('id, name, description, permissions, created_at, updated_at')
    .order('name', { ascending: true });
}

export async function assignRole(userId: string, roleId: string) {
  const supabase = createClient();
  return supabase
    .from('user_roles')
    .insert({ user_id: userId, role_id: roleId } as Omit<UserRole, 'id' | 'assigned_at' | 'assigned_by'>)
    .select('id, user_id, role_id, assigned_at')
    .single();
}

export async function removeRole(userId: string, roleId: string) {
  const supabase = createClient();
  return supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId);
}
