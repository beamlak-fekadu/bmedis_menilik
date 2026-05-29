import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isFinalMaintenanceRequestStatus,
  isFinalWorkOrderStatus,
  isOpenMaintenanceRequestStatus,
  isOpenWorkOrderStatus,
} from '@/utils/maintenance/request-status';

test('maintenance request helper treats only active statuses as open', () => {
  for (const status of ['pending', 'approved', 'assigned', 'in_progress', 'on_hold', 'open']) {
    assert.equal(isOpenMaintenanceRequestStatus(status), true, `${status} should be open`);
  }
  for (const status of ['completed', 'canceled', 'cancelled', 'rejected', 'resolved', 'closed']) {
    assert.equal(isOpenMaintenanceRequestStatus(status), false, `${status} should not be open`);
    assert.equal(isFinalMaintenanceRequestStatus(status), true, `${status} should be final`);
  }
});

test('work order helper excludes completed/canceled/resolved aliases from active work', () => {
  for (const status of ['open', 'assigned', 'in_progress', 'on_hold']) {
    assert.equal(isOpenWorkOrderStatus(status), true, `${status} should be active`);
  }
  for (const status of ['completed', 'canceled', 'cancelled', 'rejected', 'resolved', 'closed']) {
    assert.equal(isOpenWorkOrderStatus(status), false, `${status} should not be active`);
    assert.equal(isFinalWorkOrderStatus(status), true, `${status} should be final`);
  }
});
