'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader, Button, DataTable, FilterBar, Spinner } from '@/components/ui';
import { ConditionBadge } from '@/components/ui/StatusBadge';
import { getEquipmentList, type EquipmentFilters } from '@/services/equipment.service';
import { getAll } from '@/services/settings.service';
import { ROUTES } from '@/constants';
import type { EquipmentCondition, EquipmentStatus } from '@/types/database';

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

export default function InventoryPage() {
  const router = useRouter();
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
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

    const { data: equipment } = await getEquipmentList(activeFilters);
    setData((equipment as unknown as EquipmentRow[]) ?? []);
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
        title="Equipment Inventory"
        description="Manage and track all hospital equipment assets"
        actions={
          <Link href={ROUTES.INVENTORY_NEW}>
            <Button>
              <Plus className="h-4 w-4" />
              Register Equipment
            </Button>
          </Link>
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
        onRowClick={(row) => router.push(`${ROUTES.INVENTORY}/${row.id}`)}
        loading={loading}
        emptyMessage="No equipment found. Adjust your filters or register new equipment."
      />
    </div>
  );
}
