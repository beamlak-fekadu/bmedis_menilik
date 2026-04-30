'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, X } from 'lucide-react';
import {
  PageHeader, Button, Card, CardHeader, CardTitle, CardContent,
  Input, Select, Textarea, Spinner,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { getEquipmentById, updateEquipment } from '@/services/equipment.service';
import { getAll } from '@/services/settings.service';
import { ROUTES } from '@/constants';
import type { EquipmentCondition } from '@/types/database';

interface RefOption {
  value: string;
  label: string;
}

const CONDITION_OPTIONS: RefOption[] = [
  { value: 'functional', label: 'Functional' },
  { value: 'needs_repair', label: 'Needs Repair' },
  { value: 'non_functional', label: 'Non Functional' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'decommissioned', label: 'Decommissioned' },
];

const STATUS_OPTIONS: RefOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'in_storage', label: 'In Storage' },
];

interface FormData {
  asset_code: string;
  serial_number: string;
  name: string;
  category_id: string;
  department_id: string;
  manufacturer_id: string;
  model_id: string;
  installation_date: string;
  warranty_expiry: string;
  purchase_date: string;
  purchase_cost: string;
  condition: string;
  status: string;
  source: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  asset_code: '',
  serial_number: '',
  name: '',
  category_id: '',
  department_id: '',
  manufacturer_id: '',
  model_id: '',
  installation_date: '',
  warranty_expiry: '',
  purchase_date: '',
  purchase_cost: '',
  condition: 'functional',
  status: 'active',
  source: '',
  notes: '',
};

export default function EditEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [assetName, setAssetName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [departments, setDepartments] = useState<RefOption[]>([]);
  const [categories, setCategories] = useState<RefOption[]>([]);
  const [manufacturers, setManufacturers] = useState<RefOption[]>([]);
  const [models, setModels] = useState<RefOption[]>([]);

  useEffect(() => {
    async function loadAll() {
      const [deptRes, catRes, mfrRes, modelRes, eqRes] = await Promise.all([
        getAll('departments'),
        getAll('equipment_categories'),
        getAll('manufacturers'),
        getAll('equipment_models'),
        getEquipmentById(id),
      ]);

      if (deptRes.data) setDepartments(deptRes.data.map((d: { id: string; name: string }) => ({ value: d.id, label: d.name })));
      if (catRes.data) setCategories(catRes.data.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })));
      if (mfrRes.data) setManufacturers(mfrRes.data.map((m: { id: string; name: string }) => ({ value: m.id, label: m.name })));
      if (modelRes.data) setModels(modelRes.data.map((m: { id: string; name: string }) => ({ value: m.id, label: m.name })));

      if (eqRes.data) {
        const eq = eqRes.data as Record<string, unknown>;
        setAssetName(eq.name as string);
        setForm({
          asset_code: (eq.asset_code as string) ?? '',
          serial_number: (eq.serial_number as string) ?? '',
          name: (eq.name as string) ?? '',
          category_id: (eq.category_id as string) ?? '',
          department_id: (eq.department_id as string) ?? '',
          manufacturer_id: (eq.manufacturer_id as string) ?? '',
          model_id: (eq.model_id as string) ?? '',
          installation_date: (eq.installation_date as string)?.split('T')[0] ?? '',
          warranty_expiry: (eq.warranty_expiry as string)?.split('T')[0] ?? '',
          purchase_date: (eq.purchase_date as string)?.split('T')[0] ?? '',
          purchase_cost: eq.purchase_cost != null ? String(eq.purchase_cost) : '',
          condition: (eq.condition as string) ?? 'functional',
          status: (eq.status as string) ?? 'active',
          source: (eq.source as string) ?? '',
          notes: (eq.notes as string) ?? '',
        });
      }

      setLoadingData(false);
    }
    loadAll();
  }, [id]);

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.asset_code.trim()) newErrors.asset_code = 'Asset code is required';
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.category_id) newErrors.category_id = 'Category is required';
    if (!form.department_id) newErrors.department_id = 'Department is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        asset_code: form.asset_code,
        serial_number: form.serial_number || null,
        name: form.name,
        category_id: form.category_id,
        department_id: form.department_id,
        manufacturer_id: form.manufacturer_id || null,
        model_id: form.model_id || null,
        installation_date: form.installation_date || null,
        warranty_expiry: form.warranty_expiry || null,
        condition: form.condition as EquipmentCondition,
        status: form.status as 'active' | 'inactive' | 'disposed' | 'in_storage',
        purchase_date: form.purchase_date || null,
        purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
        source: form.source || null,
        notes: form.notes || null,
      };

      const { error } = await updateEquipment(id, payload);
      if (error) throw error;

      toast('success', 'Equipment updated successfully');
      router.push(`${ROUTES.INVENTORY}/${id}`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update equipment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Edit: ${assetName}`}
        breadcrumbs={[
          { label: 'Equipment', href: ROUTES.INVENTORY },
          { label: assetName, href: `${ROUTES.INVENTORY}/${id}` },
          { label: 'Edit' },
        ]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Equipment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Asset Code *"
                value={form.asset_code}
                onChange={(e) => updateField('asset_code', e.target.value)}
                error={errors.asset_code}
              />
              <Input
                label="Serial Number"
                value={form.serial_number}
                onChange={(e) => updateField('serial_number', e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Equipment Name *"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  error={errors.name}
                />
              </div>
              <Select
                label="Category *"
                options={categories}
                placeholder="Select category"
                value={form.category_id}
                onChange={(e) => updateField('category_id', e.target.value)}
                aria-invalid={!!errors.category_id}
              />
              {errors.category_id && <p className="col-span-1 -mt-3 text-xs text-red-600">{errors.category_id}</p>}
              <Select
                label="Department *"
                options={departments}
                placeholder="Select department"
                value={form.department_id}
                onChange={(e) => updateField('department_id', e.target.value)}
                aria-invalid={!!errors.department_id}
              />
              {errors.department_id && <p className="col-span-1 -mt-3 text-xs text-red-600">{errors.department_id}</p>}
              <Select
                label="Manufacturer"
                options={manufacturers}
                placeholder="Select manufacturer"
                value={form.manufacturer_id}
                onChange={(e) => updateField('manufacturer_id', e.target.value)}
              />
              <Select
                label="Model"
                options={models}
                placeholder="Select model"
                value={form.model_id}
                onChange={(e) => updateField('model_id', e.target.value)}
              />
              <Input
                label="Installation Date"
                type="date"
                value={form.installation_date}
                onChange={(e) => updateField('installation_date', e.target.value)}
              />
              <Input
                label="Warranty Expiry"
                type="date"
                value={form.warranty_expiry}
                onChange={(e) => updateField('warranty_expiry', e.target.value)}
              />
              <Input
                label="Purchase Date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => updateField('purchase_date', e.target.value)}
              />
              <Input
                label="Purchase Cost"
                type="number"
                step="0.01"
                min="0"
                value={form.purchase_cost}
                onChange={(e) => updateField('purchase_cost', e.target.value)}
              />
              <Select
                label="Condition"
                options={CONDITION_OPTIONS}
                value={form.condition}
                onChange={(e) => updateField('condition', e.target.value)}
              />
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
              />
              <Input
                label="Source"
                value={form.source}
                onChange={(e) => updateField('source', e.target.value)}
                placeholder="e.g. Purchased, Donated"
              />
              <div /> {/* spacer for grid alignment */}
              <div className="sm:col-span-2">
                <Textarea
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Link href={`${ROUTES.INVENTORY}/${id}`}>
            <Button type="button" variant="outline">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={submitting}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
