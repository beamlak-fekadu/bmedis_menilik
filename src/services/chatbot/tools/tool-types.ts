import type { ChatContextRefs, ChatModuleContext, UserChatProfile } from '@/types/chatbot';
import type { RoleName } from '@/types/roles';
import type { CopilotRouteLink } from '../route-link-builder';

export type CopilotToolAccess = 'read' | 'draft' | 'write';
export type CopilotToolCategory =
  | 'context'
  | 'equipment'
  | 'maintenance'
  | 'department'
  | 'pm'
  | 'calibration'
  | 'inventory'
  | 'procurement'
  | 'training'
  | 'disposal'
  | 'replacement'
  | 'command'
  | 'alerts'
  | 'notifications'
  | 'qr'
  | 'offline'
  | 'reports'
  | 'developer'
  | 'usage';

export type CopilotToolName =
  | 'read_current_user_context'
  | 'read_current_page_context'
  | 'read_equipment_status'
  | 'read_equipment_history'
  | 'read_work_order_status'
  | 'read_request_status'
  | 'read_department_readiness'
  | 'read_pm_compliance'
  | 'read_calibration_status'
  | 'read_stock_blockers'
  | 'read_procurement_pipeline'
  | 'read_training_status'
  | 'read_disposal_status'
  | 'read_replacement_risk'
  | 'read_command_center_snapshot'
  | 'read_alerts_summary'
  | 'read_qr_asset_context'
  | 'read_qr_scan_evidence'
  | 'read_offline_sync_summary'
  | 'read_report_snapshot'
  | 'read_copilot_telemetry_summary'
  | 'read_gemini_usage_summary'
  | 'read_tool_trace'
  | 'read_routing_trace'
  | 'read_provider_trace'
  | 'read_parser_failures'
  | 'read_copilot_usage_events'
  | 'run_gemini_smoke_test'
  // Phase 2 — high-value record-level tools
  | 'read_maintenance_request_status'
  | 'read_pm_schedule_evidence'
  | 'read_calibration_request_evidence'
  | 'read_calibration_record_evidence'
  | 'read_report_data'
  | 'read_notification_delivery_status'
  | 'read_telegram_eligibility'
  | 'read_notification_rule_logs'
  | 'read_qr_coverage_status'
  | 'read_validation_readiness';

export interface CopilotToolDefinition {
  name: CopilotToolName;
  description: string;
  category: CopilotToolCategory;
  access: CopilotToolAccess;
  allowedRoles: RoleName[];
  requiredContext: Array<'equipmentId' | 'workOrderId' | 'departmentId' | 'requestId' | 'reportType' | 'qrToken'>;
  dataSources: string[];
  maxRows: number;
  returns: string;
  failureBehavior: string;
  evidenceLabels: string[];
}

export interface CopilotToolExecutionParams {
  profile: UserChatProfile;
  contextRefs?: ChatContextRefs;
  moduleContext?: ChatModuleContext;
  route?: string | null;
}

export interface CopilotToolResult {
  ok: boolean;
  toolName: CopilotToolName;
  data: unknown;
  evidenceSignals: string[];
  sourceTables: string[];
  routeLinks: CopilotRouteLink[];
  warnings: string[];
  deniedReason?: string;
  staleDataWarning?: string;
}
