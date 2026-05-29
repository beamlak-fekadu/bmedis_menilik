import { isOverduePMTask } from './semantics';

type MaybeArray<T> = T | T[] | null | undefined;

type DepartmentJoin = {
  id?: string | null;
  name?: string | null;
};

type AssetJoin = {
  id?: string | null;
  department_id?: string | null;
  departments?: MaybeArray<DepartmentJoin>;
};

export type DepartmentPMScheduleRow = {
  id?: string | null;
  asset_id?: string | null;
  scheduled_date?: string | null;
  status?: string | null;
  equipment_assets?: MaybeArray<AssetJoin>;
};

export type DepartmentPMCompliance = {
  department_id: string;
  department_name: string;
  scheduled: number;
  completed: number;
  overdue: number;
  skippedDeferred: number;
  percentage: number | null;
};

function firstRelation<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function computeDepartmentPMCompliance(
  schedules: DepartmentPMScheduleRow[],
): DepartmentPMCompliance[] {
  const byDept = new Map<string, DepartmentPMCompliance>();

  for (const row of schedules) {
    const asset = firstRelation(row.equipment_assets);
    const department = firstRelation(asset?.departments);
    const departmentId = department?.id ?? asset?.department_id ?? 'unknown';
    const departmentName = department?.name ?? 'Unknown';
    const dept = byDept.get(departmentId) ?? {
      department_id: departmentId,
      department_name: departmentName,
      scheduled: 0,
      completed: 0,
      overdue: 0,
      skippedDeferred: 0,
      percentage: null,
    };
    const status = String(row.status ?? '').toLowerCase();
    const scheduledDate = row.scheduled_date ?? '';

    dept.scheduled += 1;
    if (status === 'completed') dept.completed += 1;
    if (scheduledDate && isOverduePMTask({ status, scheduled_date: scheduledDate })) {
      dept.overdue += 1;
    }
    if (status === 'skipped' || status === 'deferred') {
      dept.skippedDeferred += 1;
    }

    byDept.set(departmentId, dept);
  }

  for (const dept of byDept.values()) {
    dept.percentage = dept.scheduled > 0 ? (dept.completed / dept.scheduled) * 100 : null;
  }

  return Array.from(byDept.values()).sort((a, b) => a.department_name.localeCompare(b.department_name));
}
