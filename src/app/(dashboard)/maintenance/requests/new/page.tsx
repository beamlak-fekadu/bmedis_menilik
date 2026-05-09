'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { getEquipmentList } from '@/services/equipment.service';
import { createMaintenanceRequestAction } from '@/actions/maintenance.actions';
import type { EquipmentAsset, Urgency } from '@/types/database';
import { maintenanceRequestSchema } from '@/utils/validation/operations';

// Reported condition options stored in maintenance_requests.reported_condition (migration 00038).
// functional_issue = equipment operates but issue observed (no condition sync to equipment_assets).
// needs_repair / non_functional = condition synced to equipment_assets.condition.
const REPORTED_CONDITION_OPTIONS = [
  { value: 'functional_issue', label: 'Functional (issue observed)' },
  { value: 'needs_repair', label: 'Needs repair' },
  { value: 'non_functional', label: 'Non-functional' },
];

export default function NewMaintenanceRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => {
    const source = searchParams.get('source') ?? '';
    const type = searchParams.get('type');
    const urgency = searchParams.get('urgency') as Urgency | null;
    // reportedCondition from URL may be an equipment condition value ('needs_repair', 'non_functional').
    // Map 'functional' → 'functional_issue' for the DB enum; leave others as-is.
    const rawReportedCond = searchParams.get('reportedCondition') ?? '';
    const VALID_REPORTED = ['functional_issue', 'needs_repair', 'non_functional'];
    const reported_condition = rawReportedCond === 'functional'
      ? 'functional_issue'
      : VALID_REPORTED.includes(rawReportedCond) ? rawReportedCond : '';
    return {
      asset_id: searchParams.get('assetId') ?? searchParams.get('asset_id') ?? '',
      urgency: urgency && ['low', 'medium', 'high', 'critical'].includes(urgency) ? urgency : 'medium' as Urgency,
      fault_description: searchParams.get('description') ?? '',
      reported_condition,
      source,
      notes: source === 'command-center' || source === 'equipment'
        ? ['Source: ' + (source === 'equipment' ? 'Equipment page' : 'Command Center'), type ? `Request type: ${type}` : null].filter(Boolean).join('\n')
        : '',
    };
  });

  useEffect(() => {
    async function load() {
      const { data } = await getEquipmentList();
      setAssets((data ?? []) as unknown as EquipmentAsset[]);
    }
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = maintenanceRequestSchema.safeParse(form);
    if (!parsed.success) {
      toast('warning', parsed.error.issues[0]?.message ?? 'Invalid request details');
      return;
    }

    const selectedAsset = assets.find((item) => item.id === form.asset_id);
    if (!selectedAsset?.department_id) {
      toast('error', 'Selected asset does not have a department');
      return;
    }

    setSubmitting(true);
    const result = await createMaintenanceRequestAction({
      asset_id: form.asset_id,
      requested_by: null,
      department_id: selectedAsset.department_id,
      fault_description: parsed.data.fault_description.trim(),
      urgency: parsed.data.urgency,
      status: 'pending',
      notes: parsed.data.notes?.trim() || null,
      reported_condition: form.reported_condition || null,
      reported_condition_source: form.source || 'manual',
    });
    setSubmitting(false);

    if (!result.success) {
      toast('error', result.error ?? 'Failed to create maintenance request');
      return;
    }

    toast('success', 'Maintenance request created');
    router.push(`/maintenance/requests/${(result.data as { id: string }).id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Maintenance Request"
        description="Submit a corrective maintenance request for equipment support."
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
          <form className="space-y-4" onSubmit={onSubmit}>
            <Select
              label="Equipment Asset *"
              placeholder="Select asset"
              value={form.asset_id}
              onChange={(e) => setForm((prev) => ({ ...prev, asset_id: e.target.value }))}
              options={assets.map((asset) => ({
                value: asset.id,
                label: `${asset.asset_code} - ${asset.name}`,
              }))}
            />
            <Select
              label="Reported Equipment Condition *"
              placeholder="Select current condition"
              value={form.reported_condition}
              onChange={(e) => setForm((prev) => ({ ...prev, reported_condition: e.target.value }))}
              options={REPORTED_CONDITION_OPTIONS}
            />
            <Select
              label="Urgency"
              value={form.urgency}
              onChange={(e) => setForm((prev) => ({ ...prev, urgency: e.target.value as Urgency }))}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <Textarea
              label="Fault Description *"
              value={form.fault_description}
              onChange={(e) => setForm((prev) => ({ ...prev, fault_description: e.target.value }))}
              placeholder="Describe the issue observed with this equipment."
            />
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional context for maintenance team."
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
