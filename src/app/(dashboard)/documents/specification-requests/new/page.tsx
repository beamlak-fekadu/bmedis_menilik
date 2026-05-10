'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Select, Textarea, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { getEquipmentList } from '@/services/equipment.service';
import { createClient } from '@/lib/supabase/client';
import { createSpecificationRequestAction } from '@/actions/documents.actions';
import type { EquipmentAsset } from '@/types/database';

type SelectRow = { id: string; label: string };

export default function NewSpecificationRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [departments, setDepartments] = useState<SelectRow[]>([]);
  const [procurementRequests, setProcurementRequests] = useState<SelectRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: searchParams.get('title') ?? '',
    purpose: searchParams.get('purpose') ?? '',
    asset_id: searchParams.get('assetId') ?? '',
    department_id: searchParams.get('departmentId') ?? '',
    procurement_request_id: searchParams.get('procurementRequestId') ?? '',
    replacement_candidate_asset_id: searchParams.get('replacementCandidateAssetId') ?? '',
    equipment_category: searchParams.get('category') ?? '',
    requested_equipment_name: searchParams.get('equipmentName') ?? '',
    required_by: '',
    priority: (searchParams.get('priority') ?? 'medium') as 'low' | 'medium' | 'high' | 'critical',
    notes: '',
    source: searchParams.get('source') ?? 'manual',
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, departmentsRes, procurementRes] = await Promise.all([
        getEquipmentList(),
        supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
        supabase.from('procurement_requests').select('id, request_number, title').order('created_at', { ascending: false }).limit(100),
      ]);
      setAssets((data ?? []) as unknown as EquipmentAsset[]);
      setDepartments((departmentsRes.data ?? []).map((row) => ({
        id: String(row.id),
        label: String(row.name ?? 'Department'),
      })));
      setProcurementRequests((procurementRes.data ?? []).map((row) => ({
        id: String(row.id),
        label: `${String(row.request_number ?? 'PR')} — ${String(row.title ?? 'Procurement request')}`,
      })));
    }
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast('warning', 'Specification title is required');
      return;
    }
    setSubmitting(true);
    const result = await createSpecificationRequestAction({
      title: form.title.trim(),
      purpose: form.purpose || null,
      asset_id: form.asset_id || null,
      department_id: form.department_id || null,
      procurement_request_id: form.procurement_request_id || null,
      replacement_candidate_asset_id: form.replacement_candidate_asset_id || null,
      equipment_category: form.equipment_category || null,
      requested_equipment_name: form.requested_equipment_name || null,
      required_by: form.required_by || null,
      priority: form.priority,
      notes: form.notes || null,
      source: form.source,
    });
    setSubmitting(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to create specification request');
      return;
    }
    toast('success', 'Specification request submitted');
    const id = (result.data as { id: string }).id;
    router.push(`/documents/specification-requests/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Specification Request"
        description="Request technical specifications, standards, or document support for procurement, replacement, or standardization."
        breadcrumbs={[
          { label: 'Documents', href: '/documents' },
          { label: 'New Specification Request' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSubmit}>
            <Input
              label="Specification Title *"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Technical specification for Infusion Pump procurement"
            />

            <Textarea
              label="Purpose / Context"
              value={form.purpose}
              onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
              placeholder="Why is this specification needed? (procurement, replacement planning, donation acceptance, standardization...)"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Related Asset (if applicable)"
                placeholder="Select asset or leave blank"
                value={form.asset_id}
                onChange={(e) => setForm((p) => ({ ...p, asset_id: e.target.value }))}
                options={assets.map((a) => ({ value: a.id, label: `${a.asset_code} — ${a.name}` }))}
              />
              <Input
                label="Equipment Category"
                value={form.equipment_category}
                onChange={(e) => setForm((p) => ({ ...p, equipment_category: e.target.value }))}
                placeholder="e.g. Infusion Pumps, Ventilators"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Department"
                placeholder="Use my department"
                value={form.department_id}
                onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))}
                options={departments.map((department) => ({ value: department.id, label: department.label }))}
              />
              <Select
                label="Procurement Request"
                placeholder="Optional link"
                value={form.procurement_request_id}
                onChange={(e) => setForm((p) => ({ ...p, procurement_request_id: e.target.value }))}
                options={procurementRequests.map((request) => ({ value: request.id, label: request.label }))}
              />
              <Select
                label="Replacement Candidate"
                placeholder="Optional asset link"
                value={form.replacement_candidate_asset_id}
                onChange={(e) => setForm((p) => ({ ...p, replacement_candidate_asset_id: e.target.value }))}
                options={assets.map((a) => ({ value: a.id, label: `${a.asset_code} — ${a.name}` }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Equipment Name (if not registered)"
                value={form.requested_equipment_name}
                onChange={(e) => setForm((p) => ({ ...p, requested_equipment_name: e.target.value }))}
                placeholder="Equipment model or type"
              />
              <Select
                label="Priority"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as typeof form.priority }))}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
            </div>

            <Input
              label="Required By Date"
              type="date"
              value={form.required_by}
              onChange={(e) => setForm((p) => ({ ...p, required_by: e.target.value }))}
            />

            <Textarea
              label="Additional Notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any additional context for the BME team."
            />

            <div className="flex justify-end">
              <Button type="submit" loading={submitting}>
                <Save className="h-4 w-4" />
                Submit Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
