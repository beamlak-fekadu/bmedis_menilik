import { createClient } from '@/lib/supabase/server';
import type { RoleName } from '@/types/roles';

export type RequestHubType =
  | 'maintenance'
  | 'calibration'
  | 'training'
  | 'procurement'
  | 'disposal'
  | 'installation'
  | 'specification';

export type RequestHubStatus =
  | 'submitted'
  | 'pending'
  | 'approved'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface RequestHubRow {
  id: string;
  requestNumber: string;
  type: RequestHubType;
  typeLabel: string;
  title: string;
  assetId: string | null;
  assetName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  submittedById: string | null;
  submittedBy: string | null;
  status: string;
  normalizedStatus: RequestHubStatus;
  statusLabel: string;
  owner: string;
  assignee: string | null;
  createdAt: string | null;
  exactHref: string;
  nextActionLabel: string;
  nextActionHref: string;
  canMutate: boolean;
  canView: boolean;
  sourceTable: string;
  note?: string;
}

export interface RequestCategoryCard {
  type: RequestHubType;
  label: string;
  total: number;
  open: number;
  owner: string;
  note: string;
  configured: boolean;
  countLabel: string;
}

export interface RequestWorkflowCard extends RequestCategoryCard {
  description: string;
  mainActionLabel: string;
  mainActionHref: string;
  secondaryActionLabel: string;
  secondaryActionHref: string;
  canOpenWorkflow: boolean;
  pendingActionLabel: string;
  canCreate: boolean;
  replacementCandidateCount?: number;
}

export interface RequestHubScope {
  roleNames: string[];
  primaryRole: string;
  profileId: string;
  departmentId: string | null;
  departmentName: string | null;
  canMutate: boolean;
  canSeeAll: boolean;
  scopeLabel: string;
  quickFilters: Array<{ id: string; label: string }>;
}

export interface RequestsHubData {
  categoryCards: RequestCategoryCard[];
  workflowCards: RequestWorkflowCard[];
  unifiedRequests: RequestHubRow[];
  roleScope: RequestHubScope;
}

type ProfileLike = {
  id: string;
  department_id: string | null;
  roleNames?: string[];
};

type RawRow = Record<string, unknown>;

const TYPE_LABELS: Record<RequestHubType, string> = {
  maintenance: 'Corrective Maintenance',
  calibration: 'Calibration',
  training: 'Training',
  procurement: 'Procurement',
  disposal: 'Disposal',
  installation: 'Installation',
  specification: 'Specification',
};

const OWNER_LABELS: Record<RequestHubType, string> = {
  maintenance: 'BME Head',
  calibration: 'BME Head / Technician',
  training: 'BME Head / Department Head',
  procurement: 'BME Head / Store',
  disposal: 'BME Head',
  installation: 'BME Head / Technician',
  specification: 'BME Head / Documents',
};

const TYPE_CREATE_ROUTES: Record<RequestHubType, string> = {
  maintenance: '/maintenance/requests/new?type=corrective&source=requests-hub',
  calibration: '/calibration?action=new-request&source=requests-hub',
  training: '/training?action=new-request&source=requests-hub',
  procurement: '/procurement/requests/new?source=requests-hub',
  disposal: '/disposal?action=new-request&source=requests-hub',
  installation: '/installation/requests/new?source=requests-hub',
  specification: '/documents/specification-requests/new?source=requests-hub',
};

const TYPE_WORKFLOW_ROUTES: Record<RequestHubType, string> = {
  maintenance: '/maintenance?tab=requests&source=requests-hub',
  calibration: '/calibration?tab=requests&source=requests-hub',
  training: '/training?tab=requests&source=requests-hub',
  procurement: '/procurement?source=requests-hub',
  disposal: '/disposal?tab=requests&source=requests-hub',
  installation: '/installation?tab=requests',
  specification: '/documents?tab=specification-requests',
};

const WORKFLOW_DESCRIPTIONS: Record<RequestHubType, string> = {
  maintenance: 'Submit and follow corrective maintenance issues for equipment faults.',
  calibration: 'Request calibration support, review status, and move approved work into the calibration workflow.',
  training: 'Request equipment operation, safety, calibration, or refresher training support.',
  procurement: 'Track procurement requests from request through approval, order, transit, and delivery.',
  disposal: 'Track formal disposal requests and connect replacement candidates to disposal decisions.',
  installation: 'Follow installation through review, scheduling, commissioning, training, and go-live evidence.',
  specification: 'Request technical specifications, standards, or document support for procurement and replacement planning.',
};

const MUTATION_ROLES_BY_TYPE: Record<RequestHubType, RoleName[]> = {
  maintenance: ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user'],
  calibration: ['developer', 'admin', 'bme_head', 'technician'],
  training: ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user'],
  procurement: ['developer', 'admin', 'bme_head', 'store_user', 'technician'],
  disposal: ['developer', 'admin', 'bme_head', 'technician'],
  installation: ['developer', 'admin', 'bme_head', 'technician'],
  specification: ['developer', 'admin', 'bme_head', 'technician'],
};

const READ_TYPES_BY_ROLE: Partial<Record<RoleName, RequestHubType[]>> = {
  developer: ['maintenance', 'calibration', 'training', 'procurement', 'disposal', 'installation', 'specification'],
  admin: ['maintenance', 'calibration', 'training', 'procurement', 'disposal', 'installation', 'specification'],
  bme_head: ['maintenance', 'calibration', 'training', 'procurement', 'disposal', 'installation', 'specification'],
  technician: ['maintenance', 'calibration', 'training', 'disposal', 'installation', 'specification'],
  department_head: ['maintenance', 'calibration', 'training', 'installation', 'specification'],
  department_user: ['maintenance', 'calibration', 'training', 'specification'],
  store_user: ['procurement', 'installation', 'specification'],
  viewer: ['maintenance', 'calibration', 'training', 'procurement', 'disposal', 'installation', 'specification'],
};

const WORKFLOW_ROLES_BY_TYPE: Record<RequestHubType, RoleName[]> = {
  maintenance: ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user'],
  calibration: ['developer', 'admin', 'bme_head', 'technician'],
  training: ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user'],
  procurement: ['developer', 'admin', 'bme_head', 'technician', 'store_user'],
  disposal: ['developer', 'admin', 'bme_head', 'technician'],
  installation: ['developer', 'admin', 'bme_head', 'technician'],
  specification: ['developer', 'admin', 'bme_head', 'technician'],
};

function roleHas(roleNames: string[], allowed: RoleName[]) {
  return roleNames.includes('developer') || allowed.some((role) => roleNames.includes(role));
}

function canReadType(roleNames: string[], type: RequestHubType) {
  return roleNames.some((role) => (READ_TYPES_BY_ROLE[role as RoleName] ?? []).includes(type));
}

function canMutateType(roleNames: string[], type: RequestHubType) {
  return !roleNames.includes('viewer') && roleHas(roleNames, MUTATION_ROLES_BY_TYPE[type]);
}

function normalizeStatus(status: unknown): RequestHubStatus {
  const value = String(status ?? '').toLowerCase();
  if (value === 'requested') return 'submitted';
  if (value === 'open') return 'pending';
  if (value === 'scheduled') return 'assigned';
  if (value === 'ordered' || value === 'in_transit' || value === 'commissioning') return 'in_progress';
  if (value === 'delivered' || value === 'disposed') return 'completed';
  if (value === 'canceled' || value === 'cancelled') return 'cancelled';
  if (['submitted', 'pending', 'approved', 'assigned', 'in_progress', 'on_hold', 'completed', 'rejected'].includes(value)) {
    return value as RequestHubStatus;
  }
  return 'pending';
}

function formatStatus(status: RequestHubStatus) {
  const labels: Record<RequestHubStatus, string> = {
    submitted: 'Submitted',
    pending: 'Pending',
    approved: 'Approved',
    assigned: 'Assigned',
    in_progress: 'In progress',
    on_hold: 'On hold',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

function formatHuman(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 'Not recorded';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function detailRoute(type: RequestHubType, id: string) {
  return `/requests/${type}/${id}`;
}

function withParams(path: string, params: Record<string, string | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

function maintenanceAction(row: RawRow, linkedWorkOrder: RawRow | undefined) {
  if (linkedWorkOrder?.id) {
    const status = String(linkedWorkOrder.status ?? '');
    const id = String(linkedWorkOrder.id);
    if (status === 'on_hold') return { label: 'Resolve Blocker', href: `/maintenance/work-orders/${id}?action=resolve-blocker` };
    if (status === 'in_progress') return { label: 'View Progress', href: `/maintenance/work-orders/${id}` };
    if (status === 'assigned') return { label: 'Open Assigned Work', href: `/maintenance/work-orders/${id}` };
    if (status === 'completed') return { label: 'View Result', href: `/maintenance/work-orders/${id}` };
    return { label: 'Open Workflow', href: `/maintenance/work-orders/${id}` };
  }

  const id = String(row.id);
  const status = normalizeStatus(row.status);
  if (status === 'approved') {
    return {
      label: 'Create Work Order',
      href: withParams('/maintenance/work-orders/new', {
        request_id: id,
        asset_id: row.asset_id as string | null,
        work_type: 'corrective',
        source: 'requests-hub',
      }),
    };
  }
  if (status === 'pending' || status === 'submitted') return { label: 'Review', href: `/maintenance/requests/${id}` };
  if (status === 'completed') return { label: 'View Result', href: `/maintenance/requests/${id}` };
  if (status === 'rejected') return { label: 'View Reason', href: `/maintenance/requests/${id}` };
  if (status === 'cancelled') return { label: 'View Record', href: `/maintenance/requests/${id}` };
  return { label: 'View Record', href: `/maintenance/requests/${id}` };
}

function defaultAction(type: RequestHubType, row: RawRow, status: RequestHubStatus) {
  const href = type === 'procurement'
    ? `/command/drilldown/procurement/${String(row.id)}`
    : detailRoute(type, String(row.id));
  if (status === 'pending' || status === 'submitted') return { label: 'Review', href };
  if (status === 'approved') return { label: 'Open Workflow', href };
  if (status === 'assigned') return { label: 'Open Assigned Work', href };
  if (status === 'in_progress') return { label: 'View Progress', href };
  if (status === 'on_hold') return { label: 'View Blocker', href };
  if (status === 'completed') return { label: 'View Result', href };
  if (status === 'rejected') return { label: 'View Reason', href };
  return { label: 'View Record', href };
}

function getRowScopeDepartment(row: RawRow, assetDepartments: Map<string, string | null>) {
  if (typeof row.department_id === 'string') return row.department_id;
  if (typeof row.asset_id === 'string') return assetDepartments.get(row.asset_id) ?? null;
  return null;
}

function isVisibleToScope(row: RequestHubRow, roleNames: string[], profileId: string, departmentId: string | null, canSeeAll: boolean) {
  if (!row.canView) return false;
  if (canSeeAll) return true;
  if (roleNames.includes('store_user')) return row.type === 'procurement' || row.type === 'installation' || row.type === 'specification';
  if (roleNames.includes('technician')) return true;
  if (row.submittedById === profileId) return true;
  if (departmentId && row.departmentId === departmentId) return true;
  return false;
}

function buildScope(profile: ProfileLike, departments: Map<string, string>): RequestHubScope {
  const roleNames = profile.roleNames?.length ? profile.roleNames : ['viewer'];
  const primaryRoleOrder = ['developer', 'admin', 'bme_head', 'technician', 'department_head', 'store_user', 'department_user', 'viewer'];
  const primaryRole = primaryRoleOrder.find((role) => roleNames.includes(role)) ?? roleNames[0] ?? 'viewer';
  const canSeeAll = roleNames.some((role) => ['developer', 'admin', 'bme_head', 'viewer'].includes(role));
  const canMutate = !roleNames.includes('viewer') && roleNames.some((role) => role !== 'viewer');
  const departmentName = profile.department_id ? departments.get(profile.department_id) ?? null : null;
  const quickFilters = canSeeAll
    ? [
        { id: 'all', label: 'All Requests' },
        { id: 'pending', label: 'Pending Review' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'completed', label: 'Completed' },
        ...(profile.department_id ? [{ id: 'my_department', label: 'My Department' }] : []),
      ]
    : [
        { id: 'mine', label: 'My Requests' },
        ...(profile.department_id ? [{ id: 'my_department', label: 'My Department' }] : []),
        { id: 'pending', label: 'Pending' },
        { id: 'completed', label: 'Completed' },
      ];

  return {
    roleNames,
    primaryRole,
    profileId: profile.id,
    departmentId: profile.department_id,
    departmentName,
    canMutate,
    canSeeAll,
    scopeLabel: canSeeAll ? 'All hospital request activity' : departmentName ? `${departmentName} scoped request activity` : 'Visible request activity',
    quickFilters,
  };
}

function buildCategoryCards(rows: RequestHubRow[], replacementCandidateCount: number, roleNames: string[]): RequestWorkflowCard[] {
  const definitions: Array<{ type: RequestHubType; configured: boolean; countLabel: string; note: string }> = [
    { type: 'maintenance', configured: true, countLabel: 'requests', note: 'Corrective request table' },
    { type: 'calibration', configured: true, countLabel: 'requests', note: 'Calibration request table' },
    { type: 'training', configured: true, countLabel: 'requests', note: 'Training request table' },
    { type: 'disposal', configured: true, countLabel: 'formal requests', note: `${replacementCandidateCount} replacement candidates are related but counted separately` },
    { type: 'procurement', configured: true, countLabel: 'requests', note: 'Procurement request pipeline' },
    { type: 'installation', configured: true, countLabel: 'requests', note: 'Installation requests (installation_requests table). Records are separate commissioning evidence.' },
    { type: 'specification', configured: true, countLabel: 'requests', note: 'Specification requests (specification_requests table). Documents are separate output evidence.' },
  ];

  return definitions.map((definition) => {
    const typedRows = rows.filter((row) => row.type === definition.type);
    const open = typedRows.filter((row) => !['completed', 'rejected', 'cancelled'].includes(row.normalizedStatus)).length;
    return {
      type: definition.type,
      label: definition.type === 'specification' ? 'Specification / Documents' : TYPE_LABELS[definition.type],
      total: definition.configured ? typedRows.length : 0,
      open: definition.configured ? open : 0,
      owner: OWNER_LABELS[definition.type],
      note: definition.note,
      configured: definition.configured,
      countLabel: definition.countLabel,
      description: WORKFLOW_DESCRIPTIONS[definition.type],
      mainActionLabel: definition.type === 'installation' ? 'New Installation Request' : definition.type === 'specification' ? 'New Specification Request' : 'New Request',
      mainActionHref: TYPE_CREATE_ROUTES[definition.type],
      secondaryActionLabel: definition.type === 'disposal' ? 'View Replacement Candidates' : 'View Workflow',
      secondaryActionHref: definition.type === 'disposal' ? '/replacement?source=requests-hub' : TYPE_WORKFLOW_ROUTES[definition.type],
      canOpenWorkflow: roleHas(roleNames, WORKFLOW_ROLES_BY_TYPE[definition.type]) || (definition.type === 'disposal' && roleNames.includes('viewer')),
      pendingActionLabel: open > 0 ? `${open} open` : definition.configured ? 'No open items' : 'Not configured',
      canCreate: canMutateType(roleNames, definition.type),
      replacementCandidateCount: definition.type === 'disposal' ? replacementCandidateCount : undefined,
    };
  });
}

export async function fetchRequestsHubData(profile: ProfileLike): Promise<RequestsHubData> {
  const supabase = await createClient();

  const [
    departmentsRes,
    profilesRes,
    assetsRes,
    maintenanceRes,
    workOrdersRes,
    calibrationRes,
    trainingRes,
    procurementRes,
    disposalRes,
    installationRes,
    specificationRes,
    replacementFlagsRes,
  ] = await Promise.all([
    supabase.from('departments').select('id, name'),
    supabase.from('profiles').select('id, full_name, email, department_id'),
    supabase.from('equipment_assets').select('id, asset_code, name, department_id'),
    supabase.from('maintenance_requests').select('id, request_number, asset_id, requested_by, department_id, fault_description, urgency, status, resolved_at, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('work_orders').select('id, work_order_number, request_id, asset_id, assigned_to, status, priority, work_type, created_at, completed_at').order('created_at', { ascending: false }),
    supabase.from('calibration_requests').select('id, request_number, asset_id, requested_by, calibration_type_id, urgency, status, notes, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('training_requests').select('id, request_number, asset_id, requested_by, department_id, training_type, description, status, notes, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('procurement_requests').select('id, request_number, title, status, priority, requested_by, department_id, expected_delivery_date, created_at').order('created_at', { ascending: false }),
    supabase.from('disposal_requests').select('id, request_number, asset_id, requested_by, reason, disposal_method_proposed, status, approved_by, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('installation_requests').select('id, request_number, asset_id, procurement_request_id, requested_by, department_id, equipment_name, vendor, status, priority, installation_reason, commissioning_required, user_training_required, target_go_live_date, assigned_to, installation_record_id, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('specification_requests').select('id, request_number, asset_id, procurement_request_id, replacement_candidate_asset_id, requested_by, department_id, title, purpose, equipment_category, requested_equipment_name, status, priority, required_by, assigned_to, linked_document_id, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('recommendation_flags').select('id').eq('flag_type', 'replacement_candidate').eq('is_acknowledged', false),
  ]);

  const departments = new Map((departmentsRes.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const people = new Map((profilesRes.data ?? []).map((row) => [String(row.id), row as RawRow]));
  const assets = new Map((assetsRes.data ?? []).map((row) => [String(row.id), row as RawRow]));
  const assetDepartments = new Map((assetsRes.data ?? []).map((row) => [String(row.id), (row.department_id as string | null) ?? null]));
  const workOrdersByRequest = new Map<string, RawRow>();
  for (const workOrder of (workOrdersRes.data ?? []) as RawRow[]) {
    if (typeof workOrder.request_id === 'string' && !workOrdersByRequest.has(workOrder.request_id)) {
      workOrdersByRequest.set(workOrder.request_id, workOrder);
    }
  }

  const roleScope = buildScope(profile, departments);

  const makeBaseRow = (
    type: RequestHubType,
    row: RawRow,
    options: {
      title: string;
      requestNumber?: string;
      status?: string;
      exactHref?: string;
      nextAction?: { label: string; href: string };
      sourceTable: string;
      assigneeId?: string | null;
      note?: string;
    },
  ): RequestHubRow => {
    const assetId = (row.asset_id as string | null) ?? null;
    const asset = assetId ? assets.get(assetId) : null;
    const departmentId = getRowScopeDepartment(row, assetDepartments);
    const person = typeof row.requested_by === 'string' ? people.get(row.requested_by) : null;
    const assignee = options.assigneeId ? people.get(options.assigneeId) : null;
    const normalizedStatus = normalizeStatus(options.status ?? row.status);
    const nextAction = options.nextAction ?? defaultAction(type, row, normalizedStatus);
    const canView = canReadType(roleScope.roleNames, type);
    return {
      id: String(row.id),
      requestNumber: options.requestNumber ?? String(row.request_number ?? row.id),
      type,
      typeLabel: TYPE_LABELS[type],
      title: options.title,
      assetId,
      assetName: asset ? `${asset.asset_code ?? ''} ${asset.name ?? ''}`.trim() : null,
      departmentId,
      departmentName: departmentId ? departments.get(departmentId) ?? null : null,
      submittedById: (row.requested_by as string | null) ?? null,
      submittedBy: person ? String(person.full_name ?? person.email ?? 'Requester') : null,
      status: String(options.status ?? row.status ?? normalizedStatus),
      normalizedStatus,
      statusLabel: formatStatus(normalizedStatus),
      owner: OWNER_LABELS[type],
      assignee: assignee ? String(assignee.full_name ?? assignee.email ?? 'Assigned') : null,
      createdAt: (row.created_at as string | null) ?? null,
      exactHref: options.exactHref ?? detailRoute(type, String(row.id)),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
      canMutate: canMutateType(roleScope.roleNames, type),
      canView,
      sourceTable: options.sourceTable,
      note: options.note,
    };
  };

  const allRows: RequestHubRow[] = [
    ...((maintenanceRes.data ?? []) as RawRow[]).map((row) => {
      const linkedWorkOrder = workOrdersByRequest.get(String(row.id));
      const action = maintenanceAction(row, linkedWorkOrder);
      return makeBaseRow('maintenance', row, {
        title: String(row.fault_description ?? 'Corrective maintenance request'),
        exactHref: linkedWorkOrder?.id ? `/maintenance/work-orders/${String(linkedWorkOrder.id)}` : `/maintenance/requests/${String(row.id)}`,
        nextAction: action,
        sourceTable: 'maintenance_requests',
        assigneeId: (linkedWorkOrder?.assigned_to as string | null) ?? null,
      });
    }),
    ...((calibrationRes.data ?? []) as RawRow[]).map((row) => makeBaseRow('calibration', row, {
      title: String(row.notes ?? 'Calibration request'),
      sourceTable: 'calibration_requests',
    })),
    ...((trainingRes.data ?? []) as RawRow[]).map((row) => makeBaseRow('training', row, {
      title: `${formatHuman(row.training_type)}${row.description ? `: ${String(row.description)}` : ''}`,
      sourceTable: 'training_requests',
    })),
    ...((procurementRes.data ?? []) as RawRow[]).map((row) => makeBaseRow('procurement', row, {
      title: String(row.title ?? 'Procurement request'),
      exactHref: `/command/drilldown/procurement/${String(row.id)}`,
      sourceTable: 'procurement_requests',
    })),
    ...((disposalRes.data ?? []) as RawRow[]).map((row) => makeBaseRow('disposal', row, {
      title: String(row.reason ?? 'Disposal request'),
      sourceTable: 'disposal_requests',
      assigneeId: (row.approved_by as string | null) ?? null,
    })),
    ...((installationRes.data ?? []) as RawRow[]).map((row) => makeBaseRow('installation', row, {
      title: String(row.installation_reason ?? row.equipment_name ?? 'Installation request'),
      exactHref: `/installation/requests/${String(row.id)}`,
      nextAction: {
        label: String(row.status) === 'submitted' ? 'Review' : String(row.status) === 'approved' ? 'Schedule' : String(row.status) === 'in_progress' ? 'View Progress' : String(row.status) === 'completed' ? 'View Record' : 'View',
        href: `/installation/requests/${String(row.id)}`,
      },
      sourceTable: 'installation_requests',
      assigneeId: (row.assigned_to as string | null) ?? null,
    })),
    ...((specificationRes.data ?? []) as RawRow[]).map((row) => makeBaseRow('specification', row, {
      title: String(row.title ?? 'Specification request'),
      exactHref: `/documents/specification-requests/${String(row.id)}`,
      nextAction: {
        label: row.linked_document_id ? 'Retrieve Document' : String(row.status) === 'submitted' ? 'Review' : String(row.status) === 'in_progress' ? 'Upload Document' : String(row.status) === 'completed' ? 'View Result' : 'View',
        href: `/documents/specification-requests/${String(row.id)}`,
      },
      sourceTable: 'specification_requests',
      assigneeId: (row.assigned_to as string | null) ?? null,
    })),
  ];

  const visibleRows = allRows
    .filter((row) => isVisibleToScope(row, roleScope.roleNames, roleScope.profileId, roleScope.departmentId, roleScope.canSeeAll))
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));

  const workflowCards = buildCategoryCards(visibleRows, replacementFlagsRes.data?.length ?? 0, roleScope.roleNames);
  return {
    categoryCards: workflowCards.map((card) => ({
      type: card.type,
      label: card.label,
      total: card.total,
      open: card.open,
      owner: card.owner,
      note: card.note,
      configured: card.configured,
      countLabel: card.countLabel,
    })),
    workflowCards,
    unifiedRequests: visibleRows,
    roleScope,
  };
}
