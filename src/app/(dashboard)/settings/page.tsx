// R23: server-side capability gate.
// The Settings hub aggregates user/role management, security & access,
// reference data, and import/export. Even though the dashboard client shell
// already shows "Access restricted" for unauthorized roles, the server page
// loaded its data first. This thin server wrapper enforces nav.settings before
// the client bundle is hydrated.

import { requireCapability } from '@/lib/auth/helpers';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  await requireCapability('nav.settings');
  return <SettingsClient />;
}
