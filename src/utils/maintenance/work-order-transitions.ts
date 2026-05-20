// R18: pure mapping from a requested work-order status transition to the
// capability the caller must hold. Lives outside maintenance.actions.ts so it
// can be unit-tested without pulling in the entire 'use server' module.

import type { Capability } from '@/lib/rbac';

export function requiredCapabilityForWorkOrderTransition(
  requestedStatus: string | undefined,
): Capability | null {
  switch (requestedStatus) {
    case 'in_progress':
      return 'work_order.start';
    case 'completed':
      return 'work_order.complete';
    case 'on_hold':
      return 'work_order.hold';
    case 'open':
    case 'assigned':
    case 'canceled':
      // Open/assigned/canceled transitions map to assignment authority. A
      // cancellation should not be doable by someone who only has
      // work_order.add_event.
      return 'work_order.assign';
    case undefined:
      // No status change (generic edit) — gate on add_event as the baseline
      // execution capability.
      return 'work_order.add_event';
    default:
      return null;
  }
}
