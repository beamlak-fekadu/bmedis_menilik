'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Role } from '@/types/domain';
import {
  getOfflineSessionSnapshotForAuthUser,
  saveOfflineSessionSnapshot,
  type OfflineSessionSnapshot,
} from '@/lib/offline/session-snapshot';

interface UserProfile extends Profile {
  roles: Role[];
  roleNames: string[];
  primaryRole: string;
  fromOfflineSnapshot?: boolean;
  offlineVerifiedAt?: string | null;
}

function roleFromName(name: string): Role {
  return {
    id: `offline-${name}`,
    name: name as Role['name'],
    description: 'Restored from last verified offline session snapshot',
    permissions: [],
    created_at: '',
    updated_at: '',
  };
}

function profileFromSnapshot(snapshot: OfflineSessionSnapshot): UserProfile {
  const roles = snapshot.roleNames.map(roleFromName);
  return {
    id: snapshot.profileId,
    user_id: snapshot.authUserId,
    full_name: snapshot.fullName,
    email: snapshot.email,
    phone: null,
    department_id: snapshot.departmentId,
    avatar_url: null,
    job_title: snapshot.jobTitle,
    is_active: true,
    created_at: '',
    updated_at: snapshot.verifiedAt,
    roles,
    roleNames: snapshot.roleNames,
    primaryRole: snapshot.primaryRole,
    fromOfflineSnapshot: true,
    offlineVerifiedAt: snapshot.verifiedAt,
  };
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
    const authUserId = userId;

    async function fetchProfile() {
      const snapshot = getOfflineSessionSnapshotForAuthUser(authUserId);
      if (snapshot && typeof navigator !== 'undefined' && !navigator.onLine) {
        setProfile(profileFromSnapshot(snapshot));
        setLoading(false);
        return;
      }

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUserId)
          .single();

        if (!profileData) {
          const fallback = getOfflineSessionSnapshotForAuthUser(authUserId);
          if (fallback) setProfile(profileFromSnapshot(fallback));
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
        const rolePriority = [
          'developer',
          'admin',
          'bme_head',
          'technician',
          'department_head',
          'store_user',
          'department_user',
          'viewer',
        ];
        const primaryRole = rolePriority.find((r) => roleNames.includes(r as Role['name'])) || roleNames[0] || 'viewer';

        saveOfflineSessionSnapshot({
          authUserId,
          profileId: (profileData as { id: string }).id,
          fullName: (profileData as { full_name?: string | null }).full_name ?? null,
          email: (profileData as { email?: string | null }).email ?? null,
          jobTitle: (profileData as { job_title?: string | null }).job_title ?? null,
          departmentId: (profileData as { department_id?: string | null }).department_id ?? null,
          roleNames,
          primaryRole,
        });

        setProfile({
          ...(profileData as unknown as Profile),
          roles,
          roleNames,
          primaryRole,
          fromOfflineSnapshot: false,
          offlineVerifiedAt: new Date().toISOString(),
        });
        setLoading(false);
      } catch (error) {
        const fallback = getOfflineSessionSnapshotForAuthUser(authUserId);
        if (fallback) {
          setProfile(profileFromSnapshot(fallback));
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[useProfile] Profile fetch failed and no offline snapshot is available', error);
        }
        setLoading(false);
      }
    }

    void fetchProfile();
  }, [userId, supabase]);

  return { profile, loading };
}
