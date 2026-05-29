import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AUTH_RETURN_PATH,
  currentPathWithSearch,
  getSafeReturnPathFromSearchParams,
  loginPathForReturnTo,
  safeReturnPath,
} from '@/lib/auth/return-path';

test('safeReturnPath accepts same-origin relative paths with query strings', () => {
  assert.equal(safeReturnPath('/equipment/asset-1?tab=qr'), '/equipment/asset-1?tab=qr');
  assert.equal(currentPathWithSearch('/equipment/asset-1', '?tab=qr'), '/equipment/asset-1?tab=qr');
});

test('safeReturnPath rejects external and protocol-relative redirects', () => {
  for (const value of ['https://evil.com', '//evil.com', '/\\evil', '/equipment\\evil', ' /equipment/asset-1']) {
    assert.equal(safeReturnPath(value, DEFAULT_AUTH_RETURN_PATH), DEFAULT_AUTH_RETURN_PATH);
  }
});

test('returnTo wins over next and login link encodes the safe path', () => {
  const params = new URLSearchParams({
    next: '/command',
    returnTo: '/equipment/asset-1?tab=qr&from=scan',
  });
  assert.equal(getSafeReturnPathFromSearchParams(params, DEFAULT_AUTH_RETURN_PATH), '/equipment/asset-1?tab=qr&from=scan');
  assert.equal(
    loginPathForReturnTo('/equipment/asset-1?tab=qr&from=scan'),
    '/login?returnTo=%2Fequipment%2Fasset-1%3Ftab%3Dqr%26from%3Dscan',
  );
});
