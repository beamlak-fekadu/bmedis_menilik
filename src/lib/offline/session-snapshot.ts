import type { OfflineActionType } from '@/types/offline';
import type { RoleName } from '@/types/roles';
import { getOfflinePermissionsForRoles } from './offline-permissions';

export const OFFLINE_SESSION_SNAPSHOT_KEY = 'bmedis.offline.session_snapshot.v1';

export type OfflineSessionSnapshot = {
  authUserId: string;
  profileId: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  departmentId: string | null;
  roleNames: string[];
  primaryRole: string;
  offlineAllowedActions: OfflineActionType[];
  verifiedAt: string;
};

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSnapshotMap(): Record<string, OfflineSessionSnapshot> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(OFFLINE_SESSION_SNAPSHOT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, OfflineSessionSnapshot>
      : {};
  } catch {
    return {};
  }
}

function writeSnapshotMap(value: Record<string, OfflineSessionSnapshot>) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(OFFLINE_SESSION_SNAPSHOT_KEY, JSON.stringify(value));
}

export function saveOfflineSessionSnapshot(input: {
  authUserId: string;
  profileId: string;
  fullName: string | null;
  email: string | null;
  jobTitle?: string | null;
  departmentId?: string | null;
  roleNames: string[];
  primaryRole: string;
}) {
  if (!canUseLocalStorage()) return null;
  const permissions = getOfflinePermissionsForRoles(input.roleNames as RoleName[]);
  const snapshot: OfflineSessionSnapshot = {
    authUserId: input.authUserId,
    profileId: input.profileId,
    fullName: input.fullName?.trim() || input.email?.trim() || 'BMEDIS user',
    email: input.email?.trim() || '',
    jobTitle: input.jobTitle ?? null,
    departmentId: input.departmentId ?? null,
    roleNames: input.roleNames,
    primaryRole: input.primaryRole,
    offlineAllowedActions: permissions.futureAllowedActions,
    verifiedAt: new Date().toISOString(),
  };
  const snapshots = readSnapshotMap();
  snapshots[input.authUserId] = snapshot;
  writeSnapshotMap(snapshots);
  return snapshot;
}

export function getOfflineSessionSnapshotForAuthUser(authUserId: string | null | undefined) {
  if (!authUserId) return null;
  return readSnapshotMap()[authUserId] ?? null;
}

export function getMostRecentOfflineSessionSnapshot() {
  const snapshots = Object.values(readSnapshotMap());
  return snapshots.sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0] ?? null;
}

export function clearOfflineSessionSnapshot(authUserId?: string | null) {
  if (!canUseLocalStorage()) return;
  if (!authUserId) {
    window.localStorage.removeItem(OFFLINE_SESSION_SNAPSHOT_KEY);
    return;
  }
  const snapshots = readSnapshotMap();
  delete snapshots[authUserId];
  writeSnapshotMap(snapshots);
}

export function formatOfflineVerifiedAt(value: string | null | undefined) {
  if (!value) return 'an unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'an unknown time';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOfflineRole(value: string | null | undefined) {
  if (!value) return 'User';
  if (value === 'bme_head') return 'BME Head';
  if (value === 'department_head') return 'Department Head';
  if (value === 'department_user') return 'Department User';
  if (value === 'store_user') return 'Store User';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
