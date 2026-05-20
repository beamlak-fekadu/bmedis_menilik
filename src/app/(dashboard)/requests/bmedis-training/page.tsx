import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';
import { Badge, PageHeader } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { fetchDepartmentName } from '@/utils/department/department-metrics';
import BmedisTrainingRequestForm, { type BmedisTrainingRequestDefaults } from './_components/BmedisTrainingRequestForm';

type ProfileRecord = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  department_id?: string | null;
  roleNames?: string[];
};

function roleTitle(roleNames: string[] = []) {
  if (roleNames.includes('bme_head')) return 'BME Head';
  if (roleNames.includes('admin')) return 'Administrator';
  if (roleNames.includes('developer')) return 'Developer';
  return 'BME Head';
}

export default async function BmedisTrainingRequestPage() {
  const profile = await requireRole(['bme_head', 'admin']);
  const profileRecord = profile as ProfileRecord;
  const supabase = await createClient();
  const departmentName = await fetchDepartmentName(supabase, profileRecord.department_id ?? null).catch(() => null);
  const defaults: BmedisTrainingRequestDefaults = {
    requester_name: profileRecord.full_name ?? '',
    requester_email: profileRecord.email ?? '',
    requester_phone: profileRecord.phone ?? '',
    department_name: departmentName ?? '',
    role_title: roleTitle(profileRecord.roleNames),
  };

  return (
    <div className="space-y-6">
      <AssistantPageContextBridge
        moduleLabel="Requests"
        pageLabel="BMEDIS System Training Request"
        selectedRecordType="request"
        pageSummary="BME Head request page for coordinating BMEDIS system training with the support team."
        availableEvidenceLinks={[{ label: 'Requests Hub', href: '/requests', type: 'module' }]}
        quickPrompts={['What should I include in the training request?', 'Summarize this training coordination need.']}
      />
      <PageHeader
        title="Request BMEDIS System Training"
        description="Send a coordination request to the BMEDIS support team for system onboarding, refresher training, or workflow coaching."
        breadcrumbs={[
          { label: 'Requests', href: '/requests' },
          { label: 'BMEDIS System Training' },
        ]}
        actions={<Badge variant="info">BME Head</Badge>}
      />
      <BmedisTrainingRequestForm defaults={defaults} />
    </div>
  );
}
