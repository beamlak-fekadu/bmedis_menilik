// Deep-link helpers for notifications.
//
// Every notification points to the most specific in-app route possible —
// the exact record (work order, request, schedule, drilldown) when an id is
// present, and a useful filtered page when only context is known.

import type { NotificationEventType } from '@/types/notifications';

export interface NotificationLinkContext {
  source_id?: string | null;
  asset_id?: string | null;
  department_id?: string | null;
  payload?: Record<string, unknown>;
}

export interface NotificationLink {
  href: string;
  label: string;
}

function pickPayloadString(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function buildNotificationLink(
  eventType: NotificationEventType,
  ctx: NotificationLinkContext,
): NotificationLink | null {
  const sourceId = ctx.source_id ?? null;
  const assetId = ctx.asset_id ?? null;
  const departmentId = ctx.department_id ?? null;
  const payload = ctx.payload;

  switch (eventType) {
    case 'maintenance_request.created':
    case 'maintenance_request.status_changed':
      if (sourceId) {
        return { href: `/maintenance/requests/${sourceId}`, label: 'Open Request' };
      }
      return { href: '/maintenance', label: 'Open Maintenance' };

    case 'work_order.created':
    case 'work_order.assigned':
    case 'work_order.status_changed':
    case 'work_order.on_hold':
    case 'work_order.completed':
    case 'work_order.aging_or_overdue':
      if (sourceId) {
        return { href: `/maintenance/work-orders/${sourceId}`, label: 'Open Work Order' };
      }
      return { href: '/work-orders', label: 'Open Work Orders' };

    case 'pm.overdue':
    case 'pm.assigned':
    case 'pm.completed': {
      if (sourceId) {
        return { href: `/pm/schedules/${sourceId}`, label: 'Open PM Task' };
      }
      if (assetId) {
        return { href: `/pm?asset_id=${assetId}`, label: 'Open PM' };
      }
      return { href: '/pm', label: 'Open PM' };
    }

    case 'calibration.overdue':
    case 'calibration.failed_or_adjusted':
    case 'calibration.request_created':
    case 'calibration.request_status_changed': {
      const requestId = pickPayloadString(payload, 'request_id');
      const recordId = pickPayloadString(payload, 'record_id');
      if (eventType === 'calibration.failed_or_adjusted' && recordId) {
        return { href: `/calibration/records/${recordId}`, label: 'Open Calibration Record' };
      }
      if (requestId) {
        return { href: `/calibration/requests/${requestId}`, label: 'Open Calibration Request' };
      }
      if (recordId) {
        return { href: `/calibration/records/${recordId}`, label: 'Open Calibration Record' };
      }
      // NOTIF-02 fallback: use sourceId to differentiate request vs record.
      // calibration_requests source_table sends `calibration_requests`;
      // calibration_records sends `calibration_records`. We rely on event
      // type as a heuristic: request_* events route to /calibration/requests.
      if (sourceId) {
        if (
          eventType === 'calibration.request_status_changed' ||
          eventType === 'calibration.request_created'
        ) {
          return { href: `/calibration/requests/${sourceId}`, label: 'Open Calibration Request' };
        }
        if (eventType === 'calibration.failed_or_adjusted') {
          return { href: `/calibration/records/${sourceId}`, label: 'Open Calibration Record' };
        }
      }
      if (assetId) {
        return { href: `/calibration?asset_id=${assetId}`, label: 'Open Calibration' };
      }
      return { href: '/calibration', label: 'Open Calibration' };
    }

    case 'spare_part.stockout': {
      const partId = pickPayloadString(payload, 'part_id');
      if (partId) {
        return { href: `/spare-parts?partId=${partId}`, label: 'Open Part' };
      }
      return { href: '/spare-parts?tab=stockout', label: 'Open Stockout' };
    }

    case 'spare_part.low_stock': {
      const partId = pickPayloadString(payload, 'part_id');
      if (partId) {
        return { href: `/spare-parts?partId=${partId}`, label: 'Open Part' };
      }
      return { href: '/spare-parts?tab=low_stock', label: 'Open Low Stock' };
    }

    case 'spare_part.restocked': {
      // R9: confirmation event. Store user can open the part page to see
      // the new stock level. Informational only — no separate filter tab.
      const partId = pickPayloadString(payload, 'part_id');
      if (partId) {
        return { href: `/spare-parts?partId=${partId}`, label: 'Open Part' };
      }
      return { href: '/spare-parts', label: 'Open Stock' };
    }

    case 'work_order.stock_blocked': {
      if (sourceId) {
        return { href: `/maintenance/work-orders/${sourceId}`, label: 'Open Blocked Work Order' };
      }
      if (assetId) {
        return { href: `/spare-parts?tab=blockers&asset_id=${assetId}`, label: 'Open Blocker' };
      }
      return { href: '/spare-parts?tab=blockers', label: 'Open Stock Blockers' };
    }

    case 'procurement.delayed':
    case 'procurement.delivered': {
      if (sourceId) {
        return { href: `/command/drilldown/procurement/${sourceId}`, label: 'Open Procurement' };
      }
      return { href: '/procurement', label: 'Open Procurement' };
    }

    case 'procurement.delivered_pending_receipt': {
      // R21: deep-link straight to /spare-parts with the receipt modal
      // prefilled. procurement_id is carried so the resulting
      // stock_receipts row picks up the linkage via the record_stock_receipt
      // RPC's p_procurement_id arg.
      if (sourceId) {
        const payloadHref = pickPayloadString(payload, 'stock_receipt_prefill_href');
        if (payloadHref?.startsWith('/spare-parts?action=record-receipt')) {
          return { href: payloadHref, label: 'Record Stock Receipt' };
        }
        const params = new URLSearchParams({
          action: 'record-receipt',
          procurement_id: sourceId,
          source: 'procurement-delivery',
        });
        const partId = pickPayloadString(payload, 'spare_part_id') ?? pickPayloadString(payload, 'part_id');
        const quantity = payload?.requested_quantity;
        if (partId) params.set('partId', partId);
        if (typeof quantity === 'number' && quantity > 0) params.set('quantity', String(quantity));
        return {
          href: `/spare-parts?${params.toString()}`,
          label: 'Record Stock Receipt',
        };
      }
      return { href: '/spare-parts', label: 'Open Stock' };
    }

    case 'reorder.requested': {
      if (sourceId) {
        return { href: `/command/drilldown/procurement/${sourceId}`, label: 'Open Procurement' };
      }
      return { href: '/procurement', label: 'Open Procurement' };
    }

    case 'replacement.review_candidate':
    case 'replacement.strong_candidate': {
      if (assetId) {
        return {
          href: `/command/drilldown/replacement/${assetId}`,
          label: 'Open Replacement Evidence',
        };
      }
      return { href: '/replacement', label: 'Open Replacement' };
    }

    case 'risk.critical_asset_risk': {
      if (assetId) {
        return { href: `/equipment/${assetId}`, label: 'Open Asset' };
      }
      return { href: '/command', label: 'Open Command Center' };
    }

    case 'department.readiness_risk':
    case 'department.critical_asset_down': {
      if (departmentId) {
        return {
          href: `/command?department_id=${departmentId}`,
          label: 'Open Department',
        };
      }
      return { href: '/command', label: 'Open Command Center' };
    }

    case 'offline_sync.conflict':
    case 'offline_sync.failed':
      return { href: '/offline-sync', label: 'Open Sync Review' };

    case 'qr.label_needs_replacement': {
      if (assetId) {
        return { href: `/equipment/${assetId}?tab=qr`, label: 'Open Asset QR' };
      }
      return { href: '/equipment/qr-coverage', label: 'Open QR Coverage' };
    }

    case 'qr.revoked_scanned': {
      if (assetId) {
        return { href: `/equipment/${assetId}?tab=qr`, label: 'Open Asset QR' };
      }
      return { href: '/equipment/qr-coverage', label: 'Open QR Coverage' };
    }

    case 'copilot.provider_failure':
    case 'notification.rule_failed':
      return { href: '/developer-lab', label: 'Open Developer Lab' };

    case 'system.test_notification':
      return { href: '/notifications', label: 'Open Notifications' };

    default:
      return null;
  }
}
