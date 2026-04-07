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
    if (!userId) { setLoading(false); return; }

    async function fetchProfile() {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profileData) { setLoading(false); return; }

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

    fetchProfile();
  }, [userId, supabase]);

  return { profile, loading };
}
