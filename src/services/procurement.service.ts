import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from './audit.service';

export interface ProcurementPipelineRow {
  id: string;
  request_number: string;
  title: string;
  status: string;
  priority: string;
  justification?: string | null;
  requested_by: string | null;
  department_id: string | null;
  expected_delivery_date: string | null;
  spare_part_id?: string | null;
  requested_quantity?: number | null;
  created_at: string;
}

export async function getProcurementPipeline() {
  const supabase = createClient();
  return supabase
    .from('procurement_requests')
    .select('id, request_number, title, justification, status, priority, requested_by, department_id, expected_delivery_date, spare_part_id, requested_quantity, created_at, spare_parts(id, part_code, name, current_stock, reorder_level)')
    .order('created_at', { ascending: false });
}

export async function createProcurementRequest(payload: {
  title: string;
  justification: string;
  status?: string;
  priority?: string;
  requested_by?: string | null;
  department_id?: string | null;
  expected_delivery_date?: string | null;
  spare_part_id?: string | null;
  requested_quantity?: number | null;
}) {
  const supabase = createClient();
  const requestNumber = `PR-${Date.now().toString(36).toUpperCase()}`;
  const result = await supabase
    .from('procurement_requests')
    .insert({
      request_number: requestNumber,
      title: payload.title,
      justification: payload.justification,
      status: payload.status ?? 'requested',
      priority: payload.priority ?? 'medium',
      requested_by: payload.requested_by ?? null,
      department_id: payload.department_id ?? null,
      expected_delivery_date: payload.expected_delivery_date ?? null,
      spare_part_id: payload.spare_part_id ?? null,
      requested_quantity: payload.requested_quantity ?? null,
    } as never)
    .select('*')
    .single();

  if (!result.error) {
    await logAuditEvent({
      action: 'procurement_request.create',
      entityType: 'procurement_requests',
      entityId: (result.data as Record<string, unknown> | null)?.id as string | null,
      newValues: (result.data as Record<string, unknown> | null) ?? null,
    });
  }

  return result;
}
