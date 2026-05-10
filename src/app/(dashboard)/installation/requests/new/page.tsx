'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Select, Textarea, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { getEquipmentList } from '@/services/equipment.service';
import { createClient } from '@/lib/supabase/client';
import { createInstallationRequestAction } from '@/actions/installation.actions';
import type { EquipmentAsset } from '@/types/domain';

type SelectRow = { id: string; label: string };

export default function NewInstallationRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [departments, setDepartments] = useState<SelectRow[]>([]);
  const [procurementRequests, setProcurementRequests] = useState<SelectRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    asset_id: searchParams.get('assetId') ?? '',
    procurement_request_id: searchParams.get('procurementRequestId') ?? '',
    department_id: searchParams.get('departmentId') ?? '',
    equipment_name: searchParams.get('equipmentName') ?? '',
    asset_code_hint: searchParams.get('assetCode') ?? '',
    vendor: searchParams.get('vendor') ?? '',
    received_date: '',
    requested_installation_date: '',
    target_go_live_date: '',
    installation_reason: searchParams.get('description') ?? '',
    commissioning_required: true,
    user_training_required: false,
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
    if (!form.installation_reason.trim()) {
      toast('warning', 'Installation reason is required');
      return;
    }
    if (!form.asset_id && !form.equipment_name.trim()) {
      toast('warning', 'Select a registered asset or enter the equipment name');
      return;
    }
    setSubmitting(true);
    const result = await createInstallationRequestAction({
      asset_id: form.asset_id || null,
      procurement_request_id: form.procurement_request_id || null,
      department_id: form.department_id || null,
      equipment_name: form.equipment_name || null,
      asset_code_hint: form.asset_code_hint || null,
      vendor: form.vendor || null,
      received_date: form.received_date || null,
      requested_installation_date: form.requested_installation_date || null,
      target_go_live_date: form.target_go_live_date || null,
      installation_reason: form.installation_reason.trim(),
      commissioning_required: form.commissioning_required,
      user_training_required: form.user_training_required,
      priority: form.priority,
      notes: form.notes || null,
      source: form.source,
    });
    setSubmitting(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to create installation request');
      return;
    }
    toast('success', 'Installation request submitted');
    const id = (result.data as { id: string }).id;
    router.push(`/installation/requests/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Installation Request"
        description="Request installation and commissioning support for newly received or procured equipment."
        breadcrumbs={[
          { label: 'Installation', href: '/installation' },
          { label: 'New Request' },
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
            <div className="rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-4 py-3 text-sm text-[var(--text-muted)]">
              Select a registered asset below, or enter the equipment name if the asset is not yet in the register.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Registered Asset (if available)"
                placeholder="Select asset or leave blank"
                value={form.asset_id}
                onChange={(e) => setForm((p) => ({ ...p, asset_id: e.target.value }))}
                options={assets.map((a) => ({ value: a.id, label: `${a.asset_code} — ${a.name}` }))}
              />
              <Input
                label="Equipment Name (if not yet registered)"
                value={form.equipment_name}
                onChange={(e) => setForm((p) => ({ ...p, equipment_name: e.target.value }))}
                placeholder="e.g. Infusion Pump XR-3000"
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
              <Input
                label="Asset Code Hint"
                value={form.asset_code_hint}
                onChange={(e) => setForm((p) => ({ ...p, asset_code_hint: e.target.value }))}
                placeholder="If asset code is known"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Vendor / Supplier"
                value={form.vendor}
                onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
                placeholder="Vendor name"
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

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Received Date"
                type="date"
                value={form.received_date}
                onChange={(e) => setForm((p) => ({ ...p, received_date: e.target.value }))}
              />
              <Input
                label="Requested Installation Date"
                type="date"
                value={form.requested_installation_date}
                onChange={(e) => setForm((p) => ({ ...p, requested_installation_date: e.target.value }))}
              />
              <Input
                label="Target Go-Live Date"
                type="date"
                value={form.target_go_live_date}
                onChange={(e) => setForm((p) => ({ ...p, target_go_live_date: e.target.value }))}
              />
            </div>

            <Textarea
              label="Installation Reason / Context *"
              value={form.installation_reason}
              onChange={(e) => setForm((p) => ({ ...p, installation_reason: e.target.value }))}
              placeholder="Describe why installation is needed and any relevant context (new procurement, donation, transfer, etc.)."
            />

            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.commissioning_required}
                  onChange={(e) => setForm((p) => ({ ...p, commissioning_required: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--surface-3)]"
                />
                Commissioning required
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.user_training_required}
                  onChange={(e) => setForm((p) => ({ ...p, user_training_required: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--surface-3)]"
                />
                User training required
              </label>
            </div>

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
