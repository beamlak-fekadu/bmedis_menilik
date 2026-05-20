// R23: server-side capability gate for the report detail route.
// Every report type lives under this single dynamic page. The capability gate
// enforces `reports.view` server-side (denied for users without the matrix
// entry — currently no role lacks it, but a future role addition stays safe).
// Specific privileged report types (audit, QR scan evidence, offline sync
// evidence) still have their own dedicated server pages with stricter guards.

import { requireCapability } from '@/lib/auth/helpers';
import ReportTypeClient from './ReportTypeClient';

export default async function ReportTypePage() {
  await requireCapability('reports.view');
  return <ReportTypeClient />;
}
