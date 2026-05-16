import { Badge, PageHeader } from '@/components/ui';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';
import { requireRole } from '@/lib/auth/helpers';
import HospitalCalendarClient from './_components/HospitalCalendarClient';
import { fetchHospitalCalendarEvents } from './_lib/calendar-data';

export default async function HospitalCalendarPage() {
  const profile = await requireRole(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']);
  const data = await fetchHospitalCalendarEvents(profile);
  const roleNames = data.scope.roleNames;
  const isViewerOnly = roleNames.length > 0
    && roleNames.includes('viewer')
    && !roleNames.some((r) => r === 'developer' || r === 'admin' || r === 'bme_head');
  const isStoreOnly = roleNames.length > 0
    && roleNames.includes('store_user')
    && !roleNames.some((r) => r === 'developer' || r === 'admin' || r === 'bme_head' || r === 'technician');
  const isDepartmentOnly = roleNames.length > 0
    && (roleNames.includes('department_head') || roleNames.includes('department_user'))
    && !roleNames.some((r) => r === 'developer' || r === 'admin' || r === 'bme_head' || r === 'technician');

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="Calendar"
        pageLabel="Hospital operations calendar"
        contextRefs={data.scope.departmentId ? { departmentId: data.scope.departmentId } : undefined}
        pageSummary="Calendar page for upcoming and overdue PM, calibration, work orders, training, installation, procurement, and lifecycle events."
        visibleCounts={{
          events: data.events.length,
          departmentScoped: isDepartmentOnly,
          storeScoped: isStoreOnly,
          readOnly: !data.scope.canMutate,
        }}
        availableEvidenceLinks={[{ label: 'Calendar', href: '/calendar', type: 'calendar' }, { label: 'Command Center', href: '/command', type: 'module' }]}
        quickPrompts={['What is coming due soon?', 'Which calendar items need attention?', 'Prepare an operations calendar summary.']}
      />
      <PageHeader
        title="Hospital Operations Calendar"
        description={
          isDepartmentOnly
            ? `Department calendar — events affecting ${data.scope.departmentName ?? 'your department'} are shown first. Other departments remain hidden by default.`
            : isStoreOnly
              ? 'Logistics calendar — procurement deliveries and stock-related events are shown first. Other event types remain visible behind filters.'
              : isViewerOnly
                ? 'Read-only management view of upcoming and overdue PM, calibration, work orders, training, installation, procurement, and lifecycle events.'
                : 'Internal calendar for biomedical engineering activities across PM, calibration, maintenance, training, installation, procurement, and lifecycle work.'
        }
        breadcrumbs={[{ label: 'Command Center', href: '/command' }, { label: 'Hospital Calendar' }]}
        actions={<Badge variant={data.scope.canMutate ? 'info' : 'default'}>{data.scope.canMutate ? 'Operational view' : 'Read-only view'}</Badge>}
      />
      <HospitalCalendarClient data={data} />
    </div>
  );
}
