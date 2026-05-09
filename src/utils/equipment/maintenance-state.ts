export type MaintenanceState =
  | 'no_issue'
  | 'no_request'
  | 'request_pending'
  | 'wo_open'
  | 'wo_assigned'
  | 'wo_in_progress'
  | 'wo_on_hold';

export interface OpenRequestInfo {
  id: string;
  status: string;
  urgency: string;
}

export interface OpenWorkOrderInfo {
  id: string;
  status: string;
  assigned_to: string | null;
}

export function getMaintenanceState(
  condition: string | null | undefined,
  openRequest: OpenRequestInfo | undefined,
  openWO: OpenWorkOrderInfo | undefined,
): MaintenanceState {
  if (openWO) {
    if (openWO.status === 'on_hold') return 'wo_on_hold';
    if (openWO.status === 'in_progress') return 'wo_in_progress';
    if (openWO.status === 'assigned') return 'wo_assigned';
    return 'wo_open';
  }
  if (openRequest) return 'request_pending';
  const FAULTED = ['needs_repair', 'non_functional', 'under_maintenance'];
  if (condition && FAULTED.includes(condition)) return 'no_request';
  return 'no_issue';
}

export function formatMaintenanceState(state: MaintenanceState): string {
  switch (state) {
    case 'no_issue': return 'No issue';
    case 'no_request': return 'No request';
    case 'request_pending': return 'Request pending';
    case 'wo_open': return 'Work order open';
    case 'wo_assigned': return 'Assigned';
    case 'wo_in_progress': return 'In progress';
    case 'wo_on_hold': return 'On hold';
  }
}

export function getMaintenanceStateBadgeClass(state: MaintenanceState): string {
  switch (state) {
    case 'no_issue': return 'bg-slate-500/15 text-slate-400';
    case 'no_request': return 'bg-rose-500/15 text-rose-300';
    case 'request_pending': return 'bg-amber-500/15 text-amber-300';
    case 'wo_open': return 'bg-blue-500/15 text-blue-300';
    case 'wo_assigned': return 'bg-cyan-500/15 text-cyan-300';
    case 'wo_in_progress': return 'bg-indigo-500/15 text-indigo-300';
    case 'wo_on_hold': return 'bg-orange-500/15 text-orange-300';
  }
}
