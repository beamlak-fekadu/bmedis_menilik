import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatContextRefs, ChatModuleContext, UserChatProfile } from '@/types/chatbot';
import { canReadAllOperationalCopilotContext, canReadCopilotDepartment, canUseDeveloperCopilotDiagnostics, requiresDepartmentScope } from '../copilot-rbac';
import { copilotRoutes } from '../route-link-builder';
import { getCopilotTelemetrySummary, getCopilotUsageSummary } from '../usage-service';
import { getCopilotToolDefinition } from './tool-registry';
import type { CopilotToolExecutionParams, CopilotToolName, CopilotToolResult } from './tool-types';

function baseResult(name: CopilotToolName, patch: Partial<CopilotToolResult>): CopilotToolResult {
  return {
    ok: patch.ok ?? true,
    toolName: name,
    data: patch.data ?? null,
    evidenceSignals: patch.evidenceSignals ?? [],
    sourceTables: patch.sourceTables ?? [],
    routeLinks: patch.routeLinks ?? [],
    warnings: patch.warnings ?? [],
    deniedReason: patch.deniedReason,
    staleDataWarning: patch.staleDataWarning,
  };
}

function roleAllowed(profile: UserChatProfile, name: CopilotToolName) {
  const def = getCopilotToolDefinition(name);
  if (profile.roleNames.includes('developer')) return true;
  return def.allowedRoles.some((role) => profile.roleNames.includes(role));
}

function missingRequiredContext(name: CopilotToolName, refs?: ChatContextRefs, moduleContext?: ChatModuleContext) {
  const def = getCopilotToolDefinition(name);
  const missing = def.requiredContext.filter((key) => {
    if (key === 'equipmentId') return !refs?.equipmentId;
    if (key === 'workOrderId') return !refs?.workOrderId;
    if (key === 'departmentId') return !refs?.departmentId;
    if (key === 'reportType') return !moduleContext?.reportType;
    if (key === 'qrToken') return !moduleContext?.qrToken;
    return false;
  });
  return missing;
}

function pageContextData(moduleContext?: ChatModuleContext) {
  return {
    moduleLabel: moduleContext?.moduleLabel ?? null,
    pageLabel: moduleContext?.pageLabel ?? null,
    route: moduleContext?.route ?? moduleContext?.pathname ?? null,
    activeTab: moduleContext?.activeTab ?? null,
    searchQuery: moduleContext?.searchQuery ?? null,
    selectedRecordType: moduleContext?.selectedRecordType ?? null,
    selectedRecordId: moduleContext?.selectedRecordId ?? null,
    selectedRecordLabel: moduleContext?.selectedRecordLabel ?? null,
    reportType: moduleContext?.reportType ?? null,
    offlineStatus: moduleContext?.offlineStatus ?? null,
    queueStatus: moduleContext?.queueStatus ?? null,
    visibleCounts: moduleContext?.visibleCounts ?? null,
    pageSummary: moduleContext?.pageSummary ?? null,
    pageDataHints: moduleContext?.pageDataHints ?? [],
    availableEvidenceLinks: moduleContext?.availableEvidenceLinks ?? [],
  };
}

function canReadSelectedOperationalRecord(profile: UserChatProfile, departmentId: string | null | undefined) {
  if (canReadCopilotDepartment(profile, departmentId)) return true;
  const roles = new Set(profile.roleNames);
  return roles.has('technician') || roles.has('store_user') || roles.has('viewer');
}

function criticalityRank(value: unknown) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'critical') return 5;
  if (normalized === 'high') return 4;
  if (normalized === 'medium') return 3;
  if (normalized === 'low') return 2;
  return 1;
}

function conditionRank(value: unknown) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'non_functional') return 5;
  if (normalized === 'needs_repair') return 4;
  if (normalized === 'under_maintenance') return 3;
  if (normalized === 'partially_functional') return 2;
  return 1;
}

async function readEquipmentStatus(supabase: SupabaseClient, profile: UserChatProfile, refs?: ChatContextRefs) {
  const equipmentId = refs?.equipmentId;
  const selectColumns = `
    id, asset_code, name, condition, status, department_id,
    installation_date, warranty_expiry, service_contract_expiry,
    qr_label_status,
    departments(name),
    equipment_models(name),
    manufacturers(name),
    equipment_categories(name, criticality_level)
  `;

  if (equipmentId) {
    const { data } = await supabase
      .from('equipment_assets')
      .select(selectColumns)
      .eq('id', equipmentId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return null;
    if (!canReadSelectedOperationalRecord(profile, data.department_id as string | null)) return 'denied';
    return data as Record<string, unknown>;
  }

  let query = supabase
    .from('equipment_assets')
    .select(selectColumns)
    .is('deleted_at', null)
    .limit(40);

  if (requiresDepartmentScope(profile)) {
    query = profile.departmentId ? query.eq('department_id', profile.departmentId) : query.eq('department_id', EMPTY_UUID);
  }

  const { data } = await query;
  const visibleRows = ((data ?? []) as Record<string, unknown>[])
    .filter((row) => canReadSelectedOperationalRecord(profile, row.department_id as string | null))
    .sort((a, b) => {
      const categoryA = a.equipment_categories as { criticality_level?: unknown } | null;
      const categoryB = b.equipment_categories as { criticality_level?: unknown } | null;
      return (
        criticalityRank(categoryB?.criticality_level) - criticalityRank(categoryA?.criticality_level) ||
        conditionRank(b.condition) - conditionRank(a.condition) ||
        String(a.asset_code ?? '').localeCompare(String(b.asset_code ?? ''))
      );
    });

  const selected = visibleRows[0];
  if (!selected) return null;
  return {
    ...selected,
    selection_reason: 'Selected as a visible high-criticality equipment example because no specific asset was attached.',
    recentMaintenanceEvents: await readRecentMaintenanceEvents(supabase, String(selected.id)),
  };
}

async function readWorkOrderStatus(supabase: SupabaseClient, profile: UserChatProfile, refs?: ChatContextRefs) {
  const workOrderId = refs?.workOrderId;
  if (!workOrderId) return null;
  const { data } = await supabase
    .from('work_orders')
    .select('id, work_order_number, status, priority, work_type, assigned_to, asset_id, created_at, equipment_assets(id, asset_code, name, department_id)')
    .eq('id', workOrderId)
    .maybeSingle();
  const row = (data ?? null) as Record<string, unknown> | null;
  const departmentId = (row?.equipment_assets as { department_id?: string } | null)?.department_id;
  if (row && !canReadSelectedOperationalRecord(profile, departmentId)) return 'denied';
  return row;
}

async function readRecentMaintenanceEvents(supabase: SupabaseClient, refsOrAssetId?: ChatContextRefs | string) {
  const equipmentId = typeof refsOrAssetId === 'string' ? refsOrAssetId : refsOrAssetId?.equipmentId;
  if (!equipmentId) return [];
  const { data } = await supabase
    .from('maintenance_events')
    .select('id, event_type, failure_date, completion_date, action_taken, notes')
    .eq('asset_id', equipmentId)
    .order('created_at', { ascending: false })
    .limit(8);
  return (data ?? []) as Record<string, unknown>[];
}

async function readOfflineSummary(supabase: SupabaseClient, profile: UserChatProfile, moduleContext?: ChatModuleContext) {
  let query = supabase
    .from('offline_sync_events')
    .select('id, action_type, sync_status, reported_status, resolution_status, conflict_type, conflict_reason, created_at, source_route, asset_id')
    .order('created_at', { ascending: false })
    .limit(20);
  if (!canReadAllOperationalCopilotContext(profile) && profile.profileId) {
    query = query.eq('actor_user_id', profile.profileId);
  }
  const { data } = await query;
  return {
    pageQueueStatus: moduleContext?.queueStatus ?? null,
    rows: (data ?? []) as Record<string, unknown>[],
    scope: profile.roleNames.includes('developer') || profile.roleNames.includes('admin') || profile.roleNames.includes('bme_head') ? 'operational' : 'own-or-visible',
  };
}

async function readQrScanEvidence(supabase: SupabaseClient, refs?: ChatContextRefs) {
  let query = supabase
    .from('equipment_qr_scans')
    .select('id, asset_id, scan_source, online_status, action_taken, scanned_at, scanner_role')
    .order('scanned_at', { ascending: false })
    .limit(10);
  if (refs?.equipmentId) query = query.eq('asset_id', refs.equipmentId);
  const { data } = await query;
  return (data ?? []) as Record<string, unknown>[];
}

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

function isPrivilegedOperationalProfile(profile: UserChatProfile) {
  return profile.roleNames.some((role) => ['developer', 'admin', 'bme_head', 'viewer'].includes(role));
}

async function scopedAssetIdsForTool(supabase: SupabaseClient, profile: UserChatProfile) {
  if (!requiresDepartmentScope(profile)) return null;
  if (!profile.departmentId) return [];
  const { data } = await supabase
    .from('equipment_assets')
    .select('id')
    .eq('department_id', profile.departmentId)
    .is('deleted_at', null)
    .limit(1000);
  return (data ?? []).map((row) => String(row.id)).filter(Boolean);
}

function applyAssetScope<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  assetIds: string[] | null
) {
  if (!assetIds) return query;
  return query.in('asset_id', assetIds.length ? assetIds : [EMPTY_UUID]);
}

async function readPmCompliance(supabase: SupabaseClient, profile: UserChatProfile, refs?: ChatContextRefs) {
  let overdueQuery = supabase
    .from('v_overdue_pm')
    .select('id, asset_id, asset_code, asset_name, plan_name, scheduled_date, status, days_overdue, department_id, department_name, criticality_level')
    .order('days_overdue', { ascending: false })
    .limit(12);

  let complianceQuery = supabase
    .from('pm_compliance_metrics')
    .select('asset_id, department_id, pmc_percentage, scheduled_count, completed_count, computed_at')
    .order('computed_at', { ascending: false })
    .limit(8);

  if (refs?.equipmentId) {
    overdueQuery = overdueQuery.eq('asset_id', refs.equipmentId);
    complianceQuery = complianceQuery.eq('asset_id', refs.equipmentId);
  } else if (requiresDepartmentScope(profile)) {
    overdueQuery = profile.departmentId ? overdueQuery.eq('department_id', profile.departmentId) : overdueQuery.eq('department_id', EMPTY_UUID);
    complianceQuery = profile.departmentId ? complianceQuery.eq('department_id', profile.departmentId) : complianceQuery.eq('department_id', EMPTY_UUID);
  }

  const [overdueRes, complianceRes] = await Promise.all([overdueQuery, complianceQuery]);
  return {
    overdue: (overdueRes.data ?? []) as Record<string, unknown>[],
    compliance: (complianceRes.data ?? []) as Record<string, unknown>[],
  };
}

async function readCalibrationStatus(supabase: SupabaseClient, profile: UserChatProfile, refs?: ChatContextRefs) {
  const scopedAssetIds = await scopedAssetIdsForTool(supabase, profile);
  let dueQuery = supabase
    .from('v_calibration_due')
    .select('id, asset_id, asset_code, asset_name, calibration_date, next_due_date, days_until_due, result, calibration_type, department_name')
    .order('next_due_date', { ascending: true })
    .limit(12);
  let latestQuery = supabase
    .from('calibration_records')
    .select('id, asset_id, calibration_date, next_due_date, result, certificate_number')
    .order('calibration_date', { ascending: false })
    .limit(8);

  if (refs?.equipmentId) {
    dueQuery = dueQuery.eq('asset_id', refs.equipmentId);
    latestQuery = latestQuery.eq('asset_id', refs.equipmentId);
  } else {
    dueQuery = applyAssetScope(dueQuery, scopedAssetIds);
    latestQuery = applyAssetScope(latestQuery, scopedAssetIds);
  }

  const [dueRes, latestRes] = await Promise.all([dueQuery, latestQuery]);
  return {
    dueSoonOrOverdue: (dueRes.data ?? []) as Record<string, unknown>[],
    latestRecords: (latestRes.data ?? []) as Record<string, unknown>[],
  };
}

async function readAlertsSummary(supabase: SupabaseClient, profile: UserChatProfile) {
  const scopedAssetIds = await scopedAssetIdsForTool(supabase, profile);
  let query = supabase
    .from('recommendation_flags')
    .select('id, asset_id, severity, flag_type, message, generated_at, equipment_assets(asset_code, name, department_id, departments(name))')
    .eq('is_acknowledged', false)
    .order('generated_at', { ascending: false })
    .limit(12);
  query = applyAssetScope(query, scopedAssetIds);
  const { data } = await query;
  return (data ?? []) as Record<string, unknown>[];
}

async function readReplacementRisk(supabase: SupabaseClient, profile: UserChatProfile, refs?: ChatContextRefs) {
  const scopedAssetIds = await scopedAssetIdsForTool(supabase, profile);
  let query = supabase
    .from('replacement_priority_scores')
    .select('asset_id, replacement_priority_index, rank, justification, computed_at, equipment_assets(asset_code, name, department_id, departments(name))')
    .order('rank', { ascending: true })
    .limit(10);
  if (refs?.equipmentId) query = query.eq('asset_id', refs.equipmentId);
  else query = applyAssetScope(query, scopedAssetIds);
  const { data } = await query;
  return (data ?? []) as Record<string, unknown>[];
}

async function readCommandCenterSnapshot(supabase: SupabaseClient, profile: UserChatProfile) {
  const scopedAssetIds = await scopedAssetIdsForTool(supabase, profile);
  let triageQuery = supabase
    .from('triage_action_queue')
    .select('id, asset_id, priority_score, recommendation, status, due_by, equipment_assets(asset_code, name, department_id, departments(name))')
    .eq('status', 'open')
    .order('priority_score', { ascending: false })
    .limit(10);
  triageQuery = applyAssetScope(triageQuery, scopedAssetIds);

  let workQuery = supabase
    .from('work_orders')
    .select('id, work_order_number, status, priority, work_type, assigned_to, asset_id, created_at, equipment_assets(asset_code, name, department_id, departments(name))')
    .in('status', ['open', 'assigned', 'in_progress', 'on_hold'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (!isPrivilegedOperationalProfile(profile)) {
    if (profile.roleNames.includes('technician')) workQuery = workQuery.eq('assigned_to', profile.profileId);
    else if (scopedAssetIds) workQuery = applyAssetScope(workQuery, scopedAssetIds);
  }

  const [triageRes, workRes, alerts] = await Promise.all([
    triageQuery,
    workQuery,
    readAlertsSummary(supabase, profile),
  ]);
  return {
    triage: (triageRes.data ?? []) as Record<string, unknown>[],
    activeWorkOrders: (workRes.data ?? []) as Record<string, unknown>[],
    alerts,
  };
}

async function readTrainingStatus(supabase: SupabaseClient, profile: UserChatProfile) {
  let query = supabase
    .from('training_requests')
    .select('id, request_number, status, training_type, department_id, asset_id, created_at')
    .in('status', ['pending', 'approved', 'scheduled'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (!isPrivilegedOperationalProfile(profile) && profile.departmentId) {
    query = query.eq('department_id', profile.departmentId);
  }
  const { data } = await query;
  return (data ?? []) as Record<string, unknown>[];
}

async function readDisposalStatus(supabase: SupabaseClient, profile: UserChatProfile) {
  const scopedAssetIds = await scopedAssetIdsForTool(supabase, profile);
  let query = supabase
    .from('disposal_requests')
    .select('id, request_number, status, reason, disposal_method_proposed, asset_id, created_at')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(10);
  query = applyAssetScope(query, scopedAssetIds);
  const { data } = await query;
  return (data ?? []) as Record<string, unknown>[];
}

export async function executeCopilotTool(
  supabase: SupabaseClient,
  name: CopilotToolName,
  params: CopilotToolExecutionParams
): Promise<CopilotToolResult> {
  const { profile, contextRefs, moduleContext } = params;
  const def = getCopilotToolDefinition(name);
  if (!roleAllowed(profile, name)) {
    return baseResult(name, {
      ok: false,
      deniedReason: `Role is not allowed to use ${name}.`,
      warnings: ['Tool access denied by copilot RBAC.'],
      sourceTables: def.dataSources,
    });
  }
  const missing = missingRequiredContext(name, contextRefs, moduleContext);
  if (missing.length > 0) {
    return baseResult(name, {
      ok: false,
      deniedReason: `Missing required context: ${missing.join(', ')}`,
      warnings: ['Page did not provide enough context for this tool.'],
      sourceTables: def.dataSources,
    });
  }

  try {
    if (name === 'read_current_user_context') {
      return baseResult(name, {
        data: {
          displayName: profile.displayName ?? null,
          roleNames: profile.roleNames,
          departmentId: profile.departmentId,
          departmentName: profile.departmentName ?? null,
        },
        evidenceSignals: ['Loaded user role and department scope.'],
        sourceTables: def.dataSources,
      });
    }

    if (name === 'read_current_page_context') {
      const context = pageContextData(moduleContext);
      return baseResult(name, {
        data: context,
        evidenceSignals: ['Loaded registered page context.'],
        sourceTables: ['moduleContext'],
        routeLinks: (moduleContext?.availableEvidenceLinks ?? []).map((item) => ({ label: item.label, href: item.href, type: item.type ?? 'page' })),
      });
    }

    if (name === 'read_equipment_status' || name === 'read_qr_asset_context') {
      const equipment = await readEquipmentStatus(supabase, profile, contextRefs);
      if (equipment === 'denied') return baseResult(name, { ok: false, deniedReason: 'Equipment is outside your role scope.', sourceTables: def.dataSources });
      const links = equipment && typeof equipment === 'object'
        ? [copilotRoutes.equipment(String(equipment.id)), ...(moduleContext?.qrToken ? [copilotRoutes.qr(moduleContext.qrToken)] : [])]
        : [];
      return baseResult(name, {
        data: equipment,
        evidenceSignals: equipment ? ['Loaded equipment/QR asset context.'] : ['No equipment context available.'],
        sourceTables: def.dataSources,
        routeLinks: links,
        warnings: equipment ? [] : ['No selected equipment was available.'],
      });
    }

    if (name === 'read_equipment_history') {
      return baseResult(name, {
        data: await readRecentMaintenanceEvents(supabase, contextRefs),
        evidenceSignals: ['Loaded recent maintenance events.'],
        sourceTables: def.dataSources,
        routeLinks: contextRefs?.equipmentId ? [copilotRoutes.equipment(contextRefs.equipmentId)] : [],
      });
    }

    if (name === 'read_work_order_status') {
      const wo = await readWorkOrderStatus(supabase, profile, contextRefs);
      if (wo === 'denied') return baseResult(name, { ok: false, deniedReason: 'Work order is outside your role scope.', sourceTables: def.dataSources });
      return baseResult(name, {
        data: wo,
        evidenceSignals: wo ? ['Loaded work order status.'] : ['No selected work order was available.'],
        sourceTables: def.dataSources,
        routeLinks: wo && typeof wo === 'object' ? [copilotRoutes.workOrder(String(wo.id))] : [],
      });
    }

    if (name === 'read_department_readiness') {
      let query = supabase
        .from('clinical_readiness_snapshots')
        .select('department_id, readiness_score, essential_total, essential_functional, snapshot_date')
        .order('snapshot_date', { ascending: false })
        .limit(def.maxRows);
      const targetDept = contextRefs?.departmentId ?? profile.departmentId;
      if (targetDept && !profile.roleNames.some((role) => ['developer', 'admin', 'bme_head', 'viewer'].includes(role))) {
        query = query.eq('department_id', targetDept);
      }
      const { data } = await query;
      return baseResult(name, {
        data: data ?? [],
        evidenceSignals: ['Loaded readiness snapshots scoped by role.'],
        sourceTables: def.dataSources,
      });
    }

    if (name === 'read_pm_compliance') {
      const data = await readPmCompliance(supabase, profile, contextRefs);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded PM compliance and overdue PM rows scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open PM', href: '/pm', type: 'pm' }],
        warnings: data.overdue.length || data.compliance.length ? [] : ['No PM rows were found in the permitted scope.'],
      });
    }

    if (name === 'read_calibration_status') {
      const data = await readCalibrationStatus(supabase, profile, contextRefs);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded calibration due and latest calibration rows scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open calibration', href: '/calibration', type: 'calibration' }],
        warnings: data.dueSoonOrOverdue.length || data.latestRecords.length ? [] : ['No calibration rows were found in the permitted scope.'],
      });
    }

    if (name === 'read_stock_blockers') {
      const { data } = await supabase
        .from('v_low_stock_parts')
        .select('id, part_code, name, current_stock, reorder_level, deficit')
        .order('deficit', { ascending: false })
        .limit(def.maxRows);
      return baseResult(name, { data: data ?? [], evidenceSignals: ['Loaded stock blocker rows.'], sourceTables: def.dataSources, routeLinks: [{ label: 'Open spare parts', href: '/spare-parts', type: 'inventory' }] });
    }

    if (name === 'read_procurement_pipeline') {
      const { data } = await supabase
        .from('procurement_requests')
        .select('id, request_number, title, status, priority, expected_delivery_date')
        .order('created_at', { ascending: false })
        .limit(def.maxRows);
      return baseResult(name, {
        data: data ?? [],
        evidenceSignals: ['Loaded procurement pipeline rows.'],
        sourceTables: def.dataSources,
        routeLinks: (data ?? []).slice(0, 3).map((row) => copilotRoutes.procurement(String(row.id), String(row.request_number ?? 'Open procurement'))),
      });
    }

    if (name === 'read_training_status') {
      const data = await readTrainingStatus(supabase, profile);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded training request rows scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open training', href: '/training', type: 'training' }],
        warnings: data.length ? [] : ['No training requests were found in the permitted scope.'],
      });
    }

    if (name === 'read_disposal_status') {
      const data = await readDisposalStatus(supabase, profile);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded disposal request rows scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open disposal', href: '/disposal', type: 'disposal' }],
        warnings: data.length ? [] : ['No disposal requests were found in the permitted scope.'],
      });
    }

    if (name === 'read_replacement_risk') {
      const data = await readReplacementRisk(supabase, profile, contextRefs);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded replacement priority rows scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open replacement priority', href: '/replacement', type: 'replacement' }],
        warnings: data.length ? [] : ['No replacement priority rows were found in the permitted scope.'],
      });
    }

    if (name === 'read_command_center_snapshot') {
      const data = await readCommandCenterSnapshot(supabase, profile);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded Command Center snapshot rows scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open Command Center', href: '/command', type: 'command' }],
        warnings: data.triage.length || data.activeWorkOrders.length || data.alerts.length ? [] : ['No command-center rows were found in the permitted scope.'],
      });
    }

    if (name === 'read_alerts_summary') {
      const data = await readAlertsSummary(supabase, profile);
      return baseResult(name, {
        data,
        evidenceSignals: ['Loaded active recommendation flags scoped by role.'],
        sourceTables: def.dataSources,
        routeLinks: [{ label: 'Open notifications', href: '/notifications', type: 'alerts' }],
        warnings: data.length ? [] : ['No active alerts were found in the permitted scope.'],
      });
    }

    if (name === 'read_qr_scan_evidence') {
      return baseResult(name, {
        data: await readQrScanEvidence(supabase, contextRefs),
        evidenceSignals: ['Loaded QR scan evidence.'],
        sourceTables: def.dataSources,
        routeLinks: [copilotRoutes.qrScans()],
      });
    }

    if (name === 'read_offline_sync_summary') {
      return baseResult(name, {
        data: await readOfflineSummary(supabase, profile, moduleContext),
        evidenceSignals: ['Loaded offline sync summary.'],
        sourceTables: def.dataSources,
        routeLinks: [copilotRoutes.offlineSync()],
        staleDataWarning: moduleContext?.offlineStatus === 'offline' ? 'Current page reports offline mode; data may be cached.' : undefined,
      });
    }

    if (name === 'read_report_snapshot') {
      return baseResult(name, {
        data: pageContextData(moduleContext),
        evidenceSignals: ['Loaded report page context.'],
        sourceTables: ['moduleContext'],
        routeLinks: moduleContext?.reportType ? [copilotRoutes.report(moduleContext.reportType)] : [],
      });
    }

    if (name === 'read_gemini_usage_summary') {
      return baseResult(name, {
        data: await getCopilotUsageSummary(supabase, profile),
        evidenceSignals: ['Loaded app-tracked Gemini usage summary.'],
        sourceTables: def.dataSources,
      });
    }

    if (name === 'read_copilot_telemetry_summary' || name === 'read_tool_trace' || name === 'read_routing_trace' || name === 'read_provider_trace' || name === 'read_parser_failures' || name === 'read_copilot_usage_events' || name === 'run_gemini_smoke_test') {
      if (!canUseDeveloperCopilotDiagnostics(profile)) {
        return baseResult(name, { ok: false, deniedReason: 'Developer diagnostics are required.', sourceTables: def.dataSources });
      }
      if (name === 'read_copilot_telemetry_summary' || name === 'read_tool_trace' || name === 'read_routing_trace' || name === 'read_provider_trace' || name === 'read_parser_failures') {
        return baseResult(name, {
          data: await getCopilotTelemetrySummary(supabase),
          evidenceSignals: ['Loaded developer telemetry summary.'],
          sourceTables: def.dataSources,
          routeLinks: [copilotRoutes.developerLab()],
        });
      }
      if (name === 'read_copilot_usage_events') {
        return baseResult(name, {
          data: await getCopilotUsageSummary(supabase, profile),
          evidenceSignals: ['Loaded developer usage events summary.'],
          sourceTables: def.dataSources,
          routeLinks: [copilotRoutes.developerLab()],
        });
      }
      return baseResult(name, {
        data: { action: 'Use runGeminiSmokeTestAction from Developer Lab. No provider request is executed inside chat tool context.' },
        evidenceSignals: ['Gemini smoke test is available as a developer action.'],
        sourceTables: def.dataSources,
        routeLinks: [copilotRoutes.developerLab()],
      });
    }

    return baseResult(name, {
      data: pageContextData(moduleContext),
      evidenceSignals: [`${name} currently returns page-aware context only.`],
      sourceTables: def.dataSources,
      routeLinks: (moduleContext?.availableEvidenceLinks ?? []).map((item) => ({ label: item.label, href: item.href, type: item.type ?? 'page' })),
      warnings: ['Detailed page-aware retrieval for this tool is planned; no records were invented.'],
    });
  } catch (error) {
    return baseResult(name, {
      ok: false,
      data: null,
      warnings: [error instanceof Error ? error.message : String(error)],
      sourceTables: def.dataSources,
    });
  }
}
