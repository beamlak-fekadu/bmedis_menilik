import { Badge, PageHeader } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import HospitalCalendarClient from './_components/HospitalCalendarClient';
import { fetchHospitalCalendarEvents } from './_lib/calendar-data';

export default async function HospitalCalendarPage() {
  const profile = await requireRole(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']);
  const data = await fetchHospitalCalendarEvents(profile);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hospital Operations Calendar"
        description="Internal calendar for biomedical engineering activities across PM, calibration, maintenance, training, installation, procurement, and lifecycle work."
        breadcrumbs={[{ label: 'Command Center', href: '/command' }, { label: 'Hospital Calendar' }]}
        actions={<Badge variant={data.scope.canMutate ? 'info' : 'default'}>{data.scope.canMutate ? 'Operational view' : 'Read-only view'}</Badge>}
      />
      <HospitalCalendarClient data={data} />
    </div>
  );
}
