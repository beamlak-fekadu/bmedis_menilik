export const EQUIPMENT_CONDITION_OPTIONS = [
  { value: 'functional' as const, label: 'Functional' },
  { value: 'needs_repair' as const, label: 'Needs repair' },
  { value: 'non_functional' as const, label: 'Non-functional' },
  { value: 'under_maintenance' as const, label: 'Under maintenance' },
  { value: 'decommissioned' as const, label: 'Decommissioned' },
];

export type EquipmentConditionValue = typeof EQUIPMENT_CONDITION_OPTIONS[number]['value'];

export function formatEquipmentCondition(condition: string | null | undefined): string {
  switch (condition) {
    case 'functional': return 'Functional';
    case 'needs_repair': return 'Needs repair';
    case 'non_functional': return 'Non-functional';
    case 'under_maintenance': return 'Under maintenance';
    case 'decommissioned': return 'Decommissioned';
    default: return condition ? String(condition).replace(/_/g, ' ') : 'Unknown';
  }
}

export function getConditionBadgeClass(condition: string | null | undefined): string {
  switch (condition) {
    case 'functional': return 'bg-emerald-500/15 text-emerald-300';
    case 'needs_repair': return 'bg-amber-500/15 text-amber-300';
    case 'non_functional': return 'bg-rose-500/15 text-rose-300';
    case 'under_maintenance': return 'bg-violet-500/15 text-violet-300';
    case 'decommissioned': return 'bg-slate-500/15 text-slate-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
}

export const FAULTED_CONDITIONS = ['needs_repair', 'non_functional', 'under_maintenance'] as const;

export function isFaulted(condition: string | null | undefined): boolean {
  return FAULTED_CONDITIONS.includes(condition as typeof FAULTED_CONDITIONS[number]);
}
