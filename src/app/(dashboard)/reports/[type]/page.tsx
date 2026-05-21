// R23: server-side capability gate for the report detail route.
// Every report type lives under this single dynamic page. The capability gate
// enforces `reports.view` server-side (denied for users without the matrix
// entry — currently no role lacks it, but a future role addition stays safe).
// Specific privileged report types (audit, QR scan evidence, offline sync
// evidence) are also role-gated here so direct /reports/[type] navigation
// cannot bypass the reports hub visibility filters.

import { requireCapability, requireRole } from '@/lib/auth/helpers';
import ReportTypeClient from './ReportTypeClient';

const PRIVILEGED_REPORT_TYPES = new Set([
  'audit-security',
  'offline-sync-evidence',
  'qr-coverage',
  'qr-scan-evidence',
]);

export default async function ReportTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  await requireCapability('reports.view');
  if (PRIVILEGED_REPORT_TYPES.has(type)) {
    await requireRole(['admin', 'bme_head']);
  }
  return <ReportTypeClient />;
}
