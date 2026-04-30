'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Role } from '@/types/database';

interface UserProfile extends Profile {
  roles: Role[];
  roleNames: string[];
  primaryRole: string;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) {
      const timer = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(timer);
    }

    async function fetchProfile() {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profileData) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[useProfile] No profile matched current auth user_id. If this is a seeded demo account, link profiles.user_id to auth.users.id using supabase/seed/99_link_auth_users.sql.'
          );
        }
        setLoading(false);
        return;
      }

      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('role_id, roles(*)')
        .eq('user_id', profileData.id);

      const roles = (userRolesData || []).map((ur: Record<string, unknown>) => ur.roles as unknown as Role).filter(Boolean);
      const roleNames = roles.map((r) => r.name);
      const rolePriority = ['admin', 'technician', 'store_user', 'department_user', 'viewer'];
      const primaryRole = rolePriority.find((r) => roleNames.includes(r as Role['name'])) || roleNames[0] || 'viewer';

      setProfile({ ...(profileData as unknown as Profile), roles, roleNames, primaryRole });
      setLoading(false);
    }

    void fetchProfile();
  }, [userId, supabase]);

  return { profile, loading };
}
