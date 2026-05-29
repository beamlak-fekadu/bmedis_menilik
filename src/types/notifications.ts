// Notification subsystem types.
//
// In-app notifications are the source of truth for BMEDIS. Telegram is only
// an external delivery channel. These types describe the engine inputs and
// outputs; database shapes mirror migration 00055.

export const NOTIFICATION_PRIORITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number];

export const NOTIFICATION_CATEGORIES = [
  'critical',
  'task',
  'request',
  'compliance',
  'stock',
  'procurement',
  'replacement',
  'offline',
  'qr',
  'system',
  'management',
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export const NOTIFICATION_STATUSES = ['unread', 'read', 'reviewed', 'dismissed'] as const;
export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];

export const NOTIFICATION_EVENT_PROCESSING_STATUSES = [
  'pending',
  'processed',
  'failed',
  'skipped',
] as const;
export type NotificationEventProcessingStatus =
  typeof NOTIFICATION_EVENT_PROCESSING_STATUSES[number];

export type NotificationEventType =
  // Maintenance / Work
  | 'maintenance_request.created'
  | 'maintenance_request.status_changed'
  | 'work_order.created'
  | 'work_order.assigned'
  | 'work_order.status_changed'
  | 'work_order.on_hold'
  | 'work_order.completed'
  | 'work_order.aging_or_overdue'
  | 'work_order.part_requested'
  | 'work_order.part_issued'
  // PM / Calibration
  | 'pm.overdue'
  | 'pm.assigned'
  | 'pm.completed'
  | 'calibration.overdue'
  | 'calibration.failed_or_adjusted'
  | 'calibration.request_created'
  | 'calibration.request_status_changed'
  // Stock / Procurement
  | 'spare_part.stockout'
  | 'spare_part.low_stock'
  // R9 Phase 5: stock crossed the reorder threshold UPWARD after a receipt.
  // Lets Store User clear the previously-surfaced low-stock signal without
  // requiring a stale scheduled scan.
  | 'spare_part.restocked'
  | 'work_order.stock_blocked'
  | 'procurement.delayed'
  | 'procurement.delivered'
  // R21 Phase 4: separate event for the Store-User-actionable "now record
  // the receipt" step. Distinct from 'procurement.delivered' so dashboards
  // and reports can count pending-receipt work separately from already-
  // delivered procurement.
  | 'procurement.delivered_pending_receipt'
  | 'reorder.requested'
  // Replacement / Risk
  | 'replacement.review_candidate'
  | 'replacement.strong_candidate'
  | 'risk.critical_asset_risk'
  // Department / Management
  | 'department.readiness_risk'
  | 'department.critical_asset_down'
  // Offline / QR / System
  | 'offline_sync.conflict'
  | 'offline_sync.failed'
  | 'qr.label_needs_replacement'
  | 'qr.revoked_scanned'
  | 'copilot.provider_failure'
  | 'notification.rule_failed'
  // Test
  | 'system.test_notification';

export interface NotificationEventInput {
  event_type: NotificationEventType;
  source_table?: string | null;
  source_id?: string | null;
  asset_id?: string | null;
  department_id?: string | null;
  priority: NotificationPriority;
  payload?: Record<string, unknown>;
  dedupe_key?: string | null;
}

export interface NotificationEventRow {
  id: string;
  event_type: NotificationEventType | string;
  source_table: string | null;
  source_id: string | null;
  asset_id: string | null;
  department_id: string | null;
  priority: NotificationPriority;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
  processing_status: NotificationEventProcessingStatus;
  processed_at: string | null;
  processing_error: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  recipient_profile_id: string;
  recipient_role: string | null;
  title: string;
  message: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  source_type: string | null;
  source_id: string | null;
  event_id: string | null;
  asset_id: string | null;
  department_id: string | null;
  action_href: string | null;
  action_label: string | null;
  status: NotificationStatus;
  dedupe_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  reviewed_at: string | null;
  dismissed_at: string | null;
}

export interface CreateNotificationInput {
  recipient_profile_id: string;
  recipient_role?: string | null;
  title: string;
  message: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  source_type?: string | null;
  source_id?: string | null;
  event_id?: string | null;
  asset_id?: string | null;
  department_id?: string | null;
  action_href?: string | null;
  action_label?: string | null;
  dedupe_key?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationRuleLogRow {
  id: string;
  event_id: string | null;
  rule_name: string;
  status: NotificationRuleLogStatus;
  recipient_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type NotificationRuleLogStatus =
  | 'matched'
  | 'skipped'
  | 'failed'
  | 'no_recipients'
  | 'no_rule';

export interface NotificationDeliveryRow {
  id: string;
  notification_id: string | null;
  channel: 'telegram' | 'telegram_monitor';
  recipient_profile_id: string | null;
  recipient_role: string | null;
  delivery_target: string | null;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  skip_reason: string | null;
  error_message: string | null;
  provider_message_id: string | null;
  attempt_count: number;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TelegramConnectionRow {
  id: string;
  profile_id: string;
  telegram_chat_id: string;
  telegram_username: string | null;
  verified_at: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipientProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  user_id?: string | null;
  is_active?: boolean | null;
  primaryRole: string;
  roleNames: string[];
}

export interface NotificationProcessRuleLog {
  id?: string | null;
  event_id: string | null;
  rule_name: string;
  status: NotificationRuleLogStatus;
  recipient_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface NotificationDeliverySummary {
  inAppCreated: number;
  telegramSent: number;
  telegramSkipped: number;
  telegramFailed: number;
  monitorSent: number;
  monitorSkipped: number;
  monitorFailed: number;
}

export interface NotificationProcessResult {
  ok: boolean;
  eventId?: string;
  eventType: string;
  notificationCount: number;
  recipientsResolved: number;
  ruleLogs: NotificationProcessRuleLog[];
  delivery: NotificationDeliverySummary;
  warnings: string[];
  errors: string[];
}

export interface NotificationSummary {
  unread_total: number;
  unread_critical: number;
  unread_by_category: Partial<Record<NotificationCategory, number>>;
  latest_unread_at: string | null;
}

export interface NotificationDiagnostics {
  events_today: number;
  events_failed_today: number;
  events_pending: number;
  notifications_today: number;
  notifications_unread_total: number;
  notifications_unread_critical: number;
  rule_failures_today: number;
  deliveries_today: number;
  deliveries_sent_today: number;
  deliveries_skipped_today: number;
  deliveries_failed_today: number;
  monitor_deliveries_today: number;
  telegram_enabled: boolean;
  telegram_bot_token_present: boolean;
  telegram_monitor_enabled: boolean;
  telegram_monitor_chat_id_present: boolean;
  telegram_monitor_chat_id_masked: string | null;
  recent_events: NotificationEventRow[];
  recent_rule_failures: NotificationRuleLogRow[];
  recent_rule_logs: NotificationRuleLogRow[];
  recent_notifications: NotificationRow[];
  recent_deliveries: NotificationDeliveryRow[];
  recent_zero_recipient_event: NotificationEventRow | null;
  recent_in_app_insert_failure: NotificationEventRow | null;
  recent_telegram_issue: NotificationDeliveryRow | null;
  instant_delivery_health: 'healthy' | 'warning' | 'critical';
  instant_delivery_message: string;
  latest_event_to_notification_ms: number | null;
  latest_notification_to_delivery_ms: number | null;
  role_recipient_counts: Array<{
    role: string;
    active_profiles: number;
    auth_linked_profiles: number;
    telegram_connected_profiles: number;
  }>;
  recipient_profiles: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    user_id: string | null;
    department_id: string | null;
    is_active: boolean | null;
    roleNames: string[];
    telegramConnected: boolean;
  }>;
}
