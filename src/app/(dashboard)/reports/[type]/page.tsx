'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import * as reportsService from '@/services/reports.service';
import * as settingsService from '@/services/settings.service';
import type { ReportFilters } from '@/services/reports.service';

type Row = Record<string, unknown>;

interface ReportConfig {
  title: string;
  description: string;
  filterDefs: string[];
  fetchData: (filters: ReportFilters) => Promise<{ data: unknown[] | null; error: unknown }>;
  columns: { key: string; header: string; sortable?: boolean; render?: (row: Row) => React.ReactNode }[];
}

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const resultVariant: Record<string, 'success' | 'error' | 'warning'> = {
  pass: 'success', fail: 'error', adjusted: 'warning',
};

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  pending: 'warning', approved: 'info', scheduled: 'purple', in_progress: 'purple',
  completed: 'success', rejected: 'error', canceled: 'default', overdue: 'error',
  open: 'warning', assigned: 'info', on_hold: 'default', skipped: 'default',
  active: 'success', inactive: 'default', disposed: 'error', in_storage: 'info',
  functional: 'success', needs_repair: 'warning', non_functional: 'error',
  under_maintenance: 'purple', decommissioned: 'default',
};

function getReportConfig(type: string): ReportConfig | null {
  switch (type) {
    case 'equipment':
      return {
        title: 'Equipment Report',
        description: 'Complete listing of all equipment assets',
        filterDefs: ['department', 'category', 'status'],
        fetchData: reportsService.getEquipmentReport,
        columns: [
          { key: 'asset_code', header: 'Asset Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'serial_number', header: 'Serial #' },
          {
            key: 'department',
            header: 'Department',
            render: (row: Row) => {
              const dept = row.departments as { name: string } | null;
              return dept?.name || '—';
            },
          },
          {
            key: 'category',
            header: 'Category',
            render: (row: Row) => {
              const cat = row.equipment_categories as { name: string } | null;
              return cat?.name || '—';
            },
          },
          {
            key: 'condition',
            header: 'Condition',
            render: (row: Row) => (
              <Badge variant={statusVariant[row.condition as string] || 'default'}>
                {formatLabel(row.condition as string)}
              </Badge>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: Row) => (
              <Badge variant={statusVariant[row.status as string] || 'default'}>
                {formatLabel(row.status as string)}
              </Badge>
            ),
          },
          {
            key: 'purchase_cost',
            header: 'Purchase Cost',
            render: (row: Row) =>
              row.purchase_cost != null ? `$${(row.purchase_cost as number).toLocaleString()}` : '—',
          },
        ],
      };

    case 'maintenance':
      return {
        title: 'Maintenance History Report',
        description: 'All maintenance events and repair history',
        filterDefs: ['date_range'],
        fetchData: reportsService.getMaintenanceReport,
        columns: [
          {
            key: 'asset',
            header: 'Asset',
            render: (row: Row) => {
              const asset = row.equipment_assets as { asset_code: string; name: string } | null;
              return asset ? `${asset.asset_code} — ${asset.name}` : '—';
            },
          },
          {
            key: 'event_type',
            header: 'Type',
            render: (row: Row) => (
              <Badge variant="info">{formatLabel(row.event_type as string)}</Badge>
            ),
          },
          {
            key: 'failure_date',
            header: 'Failure Date',
            sortable: true,
            render: (row: Row) =>
              row.failure_date ? new Date(row.failure_date as string).toLocaleDateString() : '—',
          },
          {
            key: 'repair_duration_hours',
            header: 'Repair Hours',
            render: (row: Row) =>
              row.repair_duration_hours != null ? `${row.repair_duration_hours}h` : '—',
          },
          { key: 'action_taken', header: 'Action Taken' },
          {
            key: 'service_cost',
            header: 'Cost',
            render: (row: Row) =>
              row.service_cost != null ? `$${(row.service_cost as number).toFixed(2)}` : '—',
          },
          {
            key: 'completion_date',
            header: 'Completed',
            sortable: true,
            render: (row: Row) =>
              row.completion_date ? new Date(row.completion_date as string).toLocaleDateString() : '—',
          },
        ],
      };

    case 'pm':
      return {
        title: 'PM Completion Report',
        description: 'Preventive maintenance schedule and completion status',
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getPMReport,
        columns: [
          {
            key: 'asset',
            header: 'Asset',
            render: (row: Row) => {
              const asset = row.equipment_assets as { asset_code: string; name: string } | null;
              return asset ? `${asset.asset_code} — ${asset.name}` : '—';
            },
          },
          {
            key: 'plan',
            header: 'PM Plan',
            render: (row: Row) => {
              const plan = row.pm_plans as { name: string } | null;
              return plan?.name || '—';
            },
          },
          {
            key: 'scheduled_date',
            header: 'Scheduled Date',
            sortable: true,
            render: (row: Row) => new Date(row.scheduled_date as string).toLocaleDateString(),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: Row) => (
              <Badge variant={statusVariant[row.status as string] || 'default'}>
                {formatLabel(row.status as string)}
              </Badge>
            ),
          },
          {
            key: 'assigned_to',
            header: 'Assigned To',
            render: (row: Row) => {
              const profile = row.profiles as { full_name: string } | null;
              return profile?.full_name || '—';
            },
          },
        ],
      };

    case 'calibration':
      return {
        title: 'Calibration Report',
        description: 'Calibration records and results for all equipment',
        filterDefs: ['date_range'],
        fetchData: reportsService.getCalibrationReport,
        columns: [
          {
            key: 'asset',
            header: 'Asset',
            render: (row: Row) => {
              const asset = row.equipment_assets as { asset_code: string; name: string } | null;
              return asset ? `${asset.asset_code} — ${asset.name}` : '—';
            },
          },
          {
            key: 'type',
            header: 'Type',
            render: (row: Row) => {
              const type = row.calibration_types as { name: string } | null;
              return type?.name || '—';
            },
          },
          {
            key: 'calibration_date',
            header: 'Date',
            sortable: true,
            render: (row: Row) => new Date(row.calibration_date as string).toLocaleDateString(),
          },
          {
            key: 'result',
            header: 'Result',
            render: (row: Row) => (
              <Badge variant={resultVariant[row.result as string] || 'default'}>
                {formatLabel(row.result as string)}
              </Badge>
            ),
          },
          {
            key: 'next_due_date',
            header: 'Next Due',
            sortable: true,
            render: (row: Row) =>
              row.next_due_date ? new Date(row.next_due_date as string).toLocaleDateString() : '—',
          },
          { key: 'calibrated_by', header: 'Calibrated By' },
        ],
      };

    case 'training':
      return {
        title: 'Training Report',
        description: 'Training sessions and attendance records',
        filterDefs: ['category', 'date_range'],
        fetchData: reportsService.getTrainingReport,
        columns: [
          { key: 'title', header: 'Session', sortable: true },
          { key: 'trainer', header: 'Trainer' },
          {
            key: 'training_date',
            header: 'Date',
            sortable: true,
            render: (row: Row) => new Date(row.training_date as string).toLocaleDateString(),
          },
          {
            key: 'duration_hours',
            header: 'Duration',
            render: (row: Row) =>
              row.duration_hours ? `${row.duration_hours}h` : '—',
          },
          {
            key: 'attendees',
            header: 'Attendees',
            render: (row: Row) => {
              const records = row.staff_training_records as unknown[];
              return Array.isArray(records) ? records.length : 0;
            },
          },
          { key: 'location', header: 'Location' },
        ],
      };

    case 'spare-parts':
      return {
        title: 'Spare Parts Usage Report',
        description: 'Inventory levels and consumption analysis',
        filterDefs: ['category'],
        fetchData: reportsService.getSparePartsReport,
        columns: [
          { key: 'part_code', header: 'Part Code', sortable: true },
          { key: 'name', header: 'Name', sortable: true },
          { key: 'category', header: 'Category' },
          { key: 'current_stock', header: 'Stock', sortable: true },
          { key: 'reorder_level', header: 'Reorder Level' },
          {
            key: 'unit_cost',
            header: 'Unit Cost',
            render: (row: Row) =>
              row.unit_cost != null ? `$${(row.unit_cost as number).toFixed(2)}` : '—',
          },
          {
            key: 'stock_value',
            header: 'Stock Value',
            render: (row: Row) => {
              const stock = row.current_stock as number;
              const cost = row.unit_cost as number | null;
              return cost != null ? `$${(stock * cost).toFixed(2)}` : '—';
            },
          },
        ],
      };

    case 'disposal':
      return {
        title: 'Disposal Report',
        description: 'Equipment disposal requests and completed disposals',
        filterDefs: ['status', 'date_range'],
        fetchData: reportsService.getDisposalReport,
        columns: [
          { key: 'request_number', header: 'Request #', sortable: true },
          {
            key: 'asset',
            header: 'Asset',
            render: (row: Row) => {
              const asset = row.equipment_assets as { asset_code: string; name: string } | null;
              return asset ? `${asset.asset_code} — ${asset.name}` : '—';
            },
          },
          {
            key: 'disposal_method_proposed',
            header: 'Method',
            render: (row: Row) =>
              row.disposal_method_proposed ? formatLabel(row.disposal_method_proposed as string) : '—',
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: Row) => (
              <Badge variant={statusVariant[row.status as string] || 'default'}>
                {formatLabel(row.status as string)}
              </Badge>
            ),
          },
          {
            key: 'disposal_value',
            header: 'Value',
            render: (row: Row) => {
              const disposed = row.disposed_assets as { disposal_value: number }[] | null;
              const val = disposed?.[0]?.disposal_value;
              return val != null ? `$${val.toFixed(2)}` : '—';
            },
          },
          {
            key: 'created_at',
            header: 'Date',
            sortable: true,
            render: (row: Row) => new Date(row.created_at as string).toLocaleDateString(),
          },
        ],
      };

    default:
      return null;
  }
}

function exportToCSV(data: Row[], columns: ReportConfig['columns'], filename: string) {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (val == null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ReportTypePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const reportType = params.type as string;

  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ value: string; label: string }[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const config = useMemo(() => getReportConfig(reportType), [reportType]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [deptRes, catRes] = await Promise.all([
        settingsService.getAll('departments'),
        settingsService.getAll('equipment_categories'),
      ]);
      setDepartments(
        (deptRes.data || []).map((d: Record<string, unknown>) => ({
          value: d.id as string,
          label: d.name as string,
        }))
      );
      setCategoriesList(
        (catRes.data || []).map((c: Record<string, unknown>) => ({
          value: c.id as string,
          label: c.name as string,
        }))
      );
    } catch {
      // Non-critical; filters just won't be populated
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const filters: ReportFilters = {};
      if (filterValues.department_id) filters.department_id = filterValues.department_id;
      if (filterValues.category_id) filters.category_id = filterValues.category_id;
      if (filterValues.status) filters.status = filterValues.status;
      if (filterValues.date_from) filters.date_from = filterValues.date_from;
      if (filterValues.date_to) filters.date_to = filterValues.date_to;

      const { data: result, error } = await config.fetchData(filters);
      if (error) throw error;
      setData((result || []) as Row[]);
    } catch {
      toast('error', 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [config, filterValues, toast]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);
  useEffect(() => { loadData(); }, [loadData]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Report type not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/reports')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
      </div>
    );
  }

  const pmStatusOptions = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'in_progress', label: 'In Progress' },
  ];

  const disposalStatusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'completed', label: 'Completed' },
  ];

  const equipmentStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'disposed', label: 'Disposed' },
    { value: 'in_storage', label: 'In Storage' },
  ];

  const filterDefs = config.filterDefs.flatMap((f) => {
    switch (f) {
      case 'department':
        return [{ key: 'department_id', label: 'Department', options: departments }];
      case 'category':
        return [{ key: 'category_id', label: 'Category', options: categoriesList }];
      case 'status':
        return [{
          key: 'status',
          label: 'Status',
          options: reportType === 'pm' ? pmStatusOptions
            : reportType === 'disposal' ? disposalStatusOptions
            : reportType === 'equipment' ? equipmentStatusOptions
            : [],
        }];
      case 'date_range':
        return [];
      default:
        return [];
    }
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterReset = () => {
    setFilterValues({});
  };

  const handleExport = () => {
    exportToCSV(data, config.columns, reportType);
    toast('success', 'Report exported as CSV');
  };

  const handlePrint = () => {
    window.print();
  };

  const showDateFilters = config.filterDefs.includes('date_range');

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: config.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="mb-6 space-y-4">
        {(filterDefs.length > 0 || showDateFilters) && (
          <div className="flex flex-wrap items-end gap-4">
            {filterDefs.length > 0 && (
              <FilterBar
                filters={filterDefs}
                values={filterValues}
                onChange={handleFilterChange}
                onReset={handleFilterReset}
              />
            )}
            {showDateFilters && (
              <div className="flex items-end gap-3">
                <div className="w-44">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
                  <input
                    type="date"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    value={filterValues.date_from || ''}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  />
                </div>
                <div className="w-44">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
                  <input
                    type="date"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    value={filterValues.date_to || ''}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? 'Loading...' : `${data.length} record${data.length !== 1 ? 's' : ''} found`}
        </div>
      </div>

      <DataTable
        columns={config.columns}
        data={data}
        loading={loading}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        emptyMessage="No data found for the selected filters"
      />
    </div>
  );
}
