import { Badge, PageHeader } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import RequestsHubClient from './_components/RequestsHubClient';
import { fetchRequestsHubData } from './_lib/requests-hub-data';

export default async function RequestsHubPage() {
  const profile = await requireRole(['developer', 'admin', 'bme_head', 'technician', 'department_head', 'department_user', 'store_user', 'viewer']);
  const data = await fetchRequestsHubData(profile);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests Hub"
        description="Central intake and tracking for maintenance, calibration, procurement, training, disposal, installation, and specification requests."
        actions={<Badge variant="info">Role-based visibility enabled</Badge>}
      />
      <RequestsHubClient data={data} />
    </div>
  );
}
