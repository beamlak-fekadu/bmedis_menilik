'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader, Button, DataTable, FilterBar, Spinner } from '@/components/ui';
import { ConditionBadge } from '@/components/ui/StatusBadge';
import { getEquipmentList, type EquipmentFilters } from '@/services/equipment.service';
import { getAll } from '@/services/settings.service';
import { getRiskScores } from '@/services/analytics.service';
import { ROUTES } from '@/constants';
import { useRole } from '@/hooks/useRole';
import type { EquipmentCondition, EquipmentStatus } from '@/types/database';

function rpnBandLabel(rpn: number): string {
  if (rpn <= 100) return 'Low';
  if (rpn <= 200) return 'Medium';
  if (rpn <= 500) return 'High';
  return 'Critical';
}

function rpnBandClass(rpn: number): string {
  if (rpn <= 100) return 'bg-emerald-500/15 text-emerald-300';
  if (rpn <= 200) return 'bg-amber-500/15 text-amber-300';
  if (rpn <= 500) return 'bg-orange-500/15 text-orange-300';
  return 'bg-rose-500/15 text-rose-300';
}

interface EquipmentRow {
  id: string;
  asset_code: string;
  name: string;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  installation_date: string | null;
  departments: { id: string; name: string } | null;
  equipment_categories: { id: string; name: string } | null;
  manufacturers: { id: string; name: string } | null;
  [key: string]: unknown;
}

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

export default function EquipmentListPage() {
  const router = useRouter();
  const { canManageEquipment } = useRole();
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskByAsset, setRiskByAsset] = useState<Map<string, number>>(new Map());
  const [departments, setDepartments] = useState<RefOption[]>([]);
  const [categories, setCategories] = useState<RefOption[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({
    department_id: '',
    category_id: '',
    condition: '',
    status: '',
  });

  const loadReferenceData = useCallback(async () => {
    const [deptRes, catRes] = await Promise.all([
      getAll('departments'),
      getAll('equipment_categories'),
    ]);
    if (deptRes.data) {
      setDepartments(deptRes.data.map((d: { id: string; name: string }) => ({ value: d.id, label: d.name })));
    }
    if (catRes.data) {
      setCategories(catRes.data.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })));
    }
  }, []);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    const activeFilters: EquipmentFilters = {};
    if (filters.department_id) activeFilters.department_id = filters.department_id;
    if (filters.category_id) activeFilters.category_id = filters.category_id;
    if (filters.condition) activeFilters.condition = filters.condition;
    if (filters.status) activeFilters.status = filters.status;

    const [{ data: equipment }, riskRes] = await Promise.all([
      getEquipmentList(activeFilters),
      getRiskScores(),
    ]);
    setData((equipment as unknown as EquipmentRow[]) ?? []);

    const map = new Map<string, number>();
    for (const row of (riskRes.data as Array<{ asset_id: string; rpn: number }> | null) ?? []) {
      if (!map.has(row.asset_id)) map.set(row.asset_id, row.rpn);
    }
    setRiskByAsset(map);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReferenceData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadReferenceData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEquipment();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEquipment]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterReset = () => {
    setFilters({ department_id: '', category_id: '', condition: '', status: '' });
  };

  const columns = [
    { key: 'asset_code', header: 'Asset Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'department_name',
      header: 'Department',
      sortable: true,
      render: (row: EquipmentRow) => row.departments?.name ?? '—',
    },
    {
      key: 'category_name',
      header: 'Category',
      sortable: true,
      render: (row: EquipmentRow) => row.equipment_categories?.name ?? '—',
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (row: EquipmentRow) => <ConditionBadge condition={row.condition} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: EquipmentRow) =>
        row.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    {
      key: 'manufacturer_name',
      header: 'Manufacturer',
      render: (row: EquipmentRow) => row.manufacturers?.name ?? '—',
    },
    {
      key: 'installation_date',
      header: 'Installation Date',
      sortable: true,
      render: (row: EquipmentRow) =>
        row.installation_date
          ? new Date(row.installation_date).toLocaleDateString()
          : '—',
    },
    {
      key: 'rpn_band',
      header: 'Risk Band',
      render: (row: EquipmentRow) => {
        const rpn = riskByAsset.get(row.id);
        if (rpn == null) return <span className="text-xs text-gray-400">Not assessed</span>;
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rpnBandClass(rpn)}`}>
            {rpnBandLabel(rpn)} ({rpn})
          </span>
        );
      },
    },
  ];

  if (loading && data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Equipment"
        description="Manage and track all hospital equipment assets"
        actions={
          canManageEquipment ? (
            <Link href={ROUTES.EQUIPMENT_NEW}>
              <Button>
                <Plus className="h-4 w-4" />
                Register Equipment
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-6">
        <FilterBar
          filters={[
            { key: 'department_id', label: 'Department', options: departments },
            { key: 'category_id', label: 'Category', options: categories },
            { key: 'condition', label: 'Condition', options: CONDITION_OPTIONS },
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          ]}
          values={filters}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
        />
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by name, asset code, or serial number..."
        onRowClick={(row) => router.push(`${ROUTES.EQUIPMENT}/${row.id}`)}
        loading={loading}
        emptyMessage="No equipment found. Adjust your filters or register new equipment."
      />
    </div>
  );
}
