export type CopilotRouteLinkType =
  | 'equipment'
  | 'work_order'
  | 'maintenance_request'
  | 'pm_schedule'
  | 'calibration_request'
  | 'calibration_record'
  | 'procurement'
  | 'replacement'
  | 'report'
  | 'offline'
  | 'qr'
  | 'developer';

export interface CopilotRouteLink {
  label: string;
  href: string;
  type: CopilotRouteLinkType | string;
}

function link(label: string, href: string, type: CopilotRouteLinkType): CopilotRouteLink {
  return { label, href, type };
}

export const copilotRoutes = {
  equipment: (id: string, label = 'Open equipment') => link(label, `/equipment/${id}`, 'equipment'),
  workOrder: (id: string, label = 'Open work order') => link(label, `/maintenance/work-orders/${id}`, 'work_order'),
  maintenanceRequest: (id: string, label = 'Open maintenance request') => link(label, `/maintenance/requests/${id}`, 'maintenance_request'),
  pmSchedule: (id: string, label = 'Open PM schedule') => link(label, `/pm/schedules/${id}`, 'pm_schedule'),
  calibrationRequest: (id: string, label = 'Open calibration request') => link(label, `/calibration/requests/${id}`, 'calibration_request'),
  calibrationRecord: (id: string, label = 'Open calibration record') => link(label, `/calibration/records/${id}`, 'calibration_record'),
  procurement: (id: string, label = 'Open procurement evidence') => link(label, `/command/drilldown/procurement/${id}`, 'procurement'),
  replacement: (assetId: string, label = 'Open replacement evidence') => link(label, `/command/drilldown/replacement/${assetId}`, 'replacement'),
  report: (type: string, label = 'Open report') => link(label, `/reports/${type}`, 'report'),
  offlineSync: (label = 'Open offline sync') => link(label, '/offline-sync', 'offline'),
  qr: (token: string, label = 'Open QR page') => link(label, `/qr/a/${token}`, 'qr'),
  qrCoverage: (label = 'Open QR coverage') => link(label, '/equipment/qr-coverage', 'qr'),
  qrScans: (label = 'Open QR scans') => link(label, '/equipment/qr-scans', 'qr'),
  developerLab: (label = 'Open Developer Lab') => link(label, '/developer-lab', 'developer'),
  notifications: (label = 'Open Notification Center') => link(label, '/notifications', 'report'),
  /** Generic request route link by intake type — falls back to module home. */
  request: (kind: 'maintenance' | 'calibration' | 'training' | 'disposal', id: string, label?: string) => {
    switch (kind) {
      case 'maintenance':
        return link(label ?? 'Open maintenance request', `/maintenance/requests/${id}`, 'maintenance_request');
      case 'calibration':
        return link(label ?? 'Open calibration request', `/calibration/requests/${id}`, 'calibration_request');
      default:
        return link(label ?? 'Open request', `/requests/${kind}/${id}`, 'maintenance_request');
    }
  },
};

