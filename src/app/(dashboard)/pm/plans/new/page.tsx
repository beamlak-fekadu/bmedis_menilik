'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { getEquipmentList } from '@/services/equipment.service';
import { createPMPlanAction } from '@/actions/pm.actions';
import { getAll } from '@/services/settings.service';
import type { EquipmentAsset, PMTemplate } from '@/types/domain';
import { pmPlanSchema } from '@/utils/validation/operations';

export default function NewPMPlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [templates, setTemplates] = useState<PMTemplate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    asset_id: '',
    template_id: '',
    name: '',
    frequency_days: '90',
    next_due_date: '',
  });

  useEffect(() => {
    async function load() {
      const [assetRes, templateRes] = await Promise.all([getEquipmentList(), getAll('pm_templates')]);
      setAssets((assetRes.data ?? []) as unknown as EquipmentAsset[]);
      setTemplates((templateRes.data ?? []) as unknown as PMTemplate[]);
    }
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = pmPlanSchema.safeParse(form);
    if (!parsed.success) {
      toast('warning', parsed.error.issues[0]?.message ?? 'Invalid plan data');
      return;
    }
    setSubmitting(true);
    const result = await createPMPlanAction({
      asset_id: parsed.data.asset_id,
      template_id: parsed.data.template_id || null,
      name: parsed.data.name.trim(),
      frequency_days: parsed.data.frequency_days,
      next_due_date: parsed.data.next_due_date || null,
      last_completed_date: null,
      is_active: true,
      created_by: null,
    });
    setSubmitting(false);

    if (!result.success) {
      toast('error', result.error ?? 'Failed to create PM plan');
      return;
    }
    toast('success', 'PM plan created');
    router.push('/pm');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New PM Plan"
        description="Create preventive maintenance plans with schedule frequency and template linkage."
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <Select
              label="Asset *"
              value={form.asset_id}
              onChange={(e) => setForm((prev) => ({ ...prev, asset_id: e.target.value }))}
              options={assets.map((asset) => ({ value: asset.id, label: `${asset.asset_code} - ${asset.name}` }))}
            />
            <Select
              label="Template"
              value={form.template_id}
              onChange={(e) => setForm((prev) => ({ ...prev, template_id: e.target.value }))}
              options={[{ value: '', label: 'No Template' }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
            />
            <Input
              label="Plan Name *"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Quarterly electrical safety checks"
            />
            <Input
              label="Frequency (days)"
              type="number"
              value={form.frequency_days}
              onChange={(e) => setForm((prev) => ({ ...prev, frequency_days: e.target.value }))}
            />
            <Input
              label="Next Due Date"
              type="date"
              value={form.next_due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, next_due_date: e.target.value }))}
            />
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" loading={submitting}>
                <Save className="h-4 w-4" />
                Create PM Plan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
