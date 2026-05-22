import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFLINE_SESSION_SNAPSHOT_KEY,
  clearOfflineSessionSnapshot,
  getOfflineSessionSnapshotForAuthUser,
  saveOfflineSessionSnapshot,
} from '@/lib/offline/session-snapshot';

function installLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
  });
  return store;
}

test('offline session snapshot stores last verified profile and role without credentials', () => {
  const store = installLocalStorage();
  const snapshot = saveOfflineSessionSnapshot({
    authUserId: 'auth-1',
    profileId: 'profile-1',
    fullName: 'Hanna Gebremedhin',
    email: 'hanna@example.test',
    jobTitle: 'Technician',
    departmentId: 'icu',
    roleNames: ['technician'],
    primaryRole: 'technician',
  });

  assert.equal(snapshot?.profileId, 'profile-1');
  assert.equal(snapshot?.primaryRole, 'technician');
  assert.ok(snapshot?.offlineAllowedActions.includes('work_order.complete'));

  const raw = store.get(OFFLINE_SESSION_SNAPSHOT_KEY) ?? '';
  assert.doesNotMatch(raw, /password|service_role|secret/i);

  const restored = getOfflineSessionSnapshotForAuthUser('auth-1');
  assert.equal(restored?.fullName, 'Hanna Gebremedhin');
  assert.equal(restored?.departmentId, 'icu');

  clearOfflineSessionSnapshot('auth-1');
  assert.equal(getOfflineSessionSnapshotForAuthUser('auth-1'), null);
});
