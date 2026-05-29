// Canonical maintenance status constants.
// Used by server actions, service helpers, and UI to enforce open/final-state
// semantics consistently across requests, work orders, duplicate guards, and
// Command Center queries.

export const OPEN_MAINTENANCE_REQUEST_STATUSES = ['pending', 'approved', 'assigned', 'in_progress', 'on_hold', 'open'] as const;
export const FINAL_MAINTENANCE_REQUEST_STATUSES = ['completed', 'rejected', 'canceled', 'cancelled', 'closed', 'resolved'] as const;
export const CLOSED_MAINTENANCE_REQUEST_STATUSES = FINAL_MAINTENANCE_REQUEST_STATUSES;

export const OPEN_WORK_ORDER_STATUSES = ['open', 'assigned', 'in_progress', 'on_hold'] as const;
export const FINAL_WORK_ORDER_STATUSES = ['completed', 'canceled', 'cancelled', 'closed', 'resolved', 'rejected'] as const;

export type OpenMaintenanceRequestStatus = (typeof OPEN_MAINTENANCE_REQUEST_STATUSES)[number];
export type ClosedMaintenanceRequestStatus = (typeof CLOSED_MAINTENANCE_REQUEST_STATUSES)[number];
export type OpenWorkOrderStatus = (typeof OPEN_WORK_ORDER_STATUSES)[number];
export type FinalWorkOrderStatus = (typeof FINAL_WORK_ORDER_STATUSES)[number];

function normalizeStatus(status: string | null | undefined): string {
  return String(status ?? '').trim().toLowerCase();
}

export function isOpenMaintenanceRequestStatus(status: string | null | undefined): status is OpenMaintenanceRequestStatus {
  return (OPEN_MAINTENANCE_REQUEST_STATUSES as readonly string[]).includes(normalizeStatus(status));
}

export function isClosedMaintenanceRequestStatus(status: string | null | undefined): status is ClosedMaintenanceRequestStatus {
  return isFinalMaintenanceRequestStatus(status);
}

export function isFinalMaintenanceRequestStatus(status: string | null | undefined): status is ClosedMaintenanceRequestStatus {
  return (FINAL_MAINTENANCE_REQUEST_STATUSES as readonly string[]).includes(normalizeStatus(status));
}

export function isOpenWorkOrderStatus(status: string | null | undefined): status is OpenWorkOrderStatus {
  return (OPEN_WORK_ORDER_STATUSES as readonly string[]).includes(normalizeStatus(status));
}

export function isFinalWorkOrderStatus(status: string | null | undefined): status is FinalWorkOrderStatus {
  return (FINAL_WORK_ORDER_STATUSES as readonly string[]).includes(normalizeStatus(status));
}

// Label for display in duplicate warning messages
export function formatRequestStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    open: 'Open',
    completed: 'Completed',
    rejected: 'Rejected',
    canceled: 'Canceled',
    cancelled: 'Canceled',
    closed: 'Closed',
    resolved: 'Resolved',
  };
  return labels[status] ?? status;
}

export function formatWorkOrderStatus(status: string): string {
  const labels: Record<string, string> = {
    open: 'Open',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed',
    canceled: 'Canceled',
    cancelled: 'Canceled',
    closed: 'Closed',
    resolved: 'Resolved',
    rejected: 'Rejected',
  };
  return labels[status] ?? status;
}
