// QR scan landing route (Phase 3).
//
// Public route — middleware allows /qr without auth so this server component
// can decide what to render. The contract is:
//   - Invalid token format       → QrInvalidState variant="invalid"
//   - Token validated, no asset  → QrInvalidState variant="not_found"
//   - Token found but revoked    → QrInvalidState variant="revoked"
//   - Token + asset OK, no auth  → QrLoginRequired with returnTo
//   - Token + asset OK + auth    → QrAssetLandingPage (role-aware)
//
// QR is identity only. The auth session + role decide what is actually shown
// on the landing page; the token never grants permissions.

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getServerProfile } from '@/lib/auth/helpers';
import { resolveQrLandingAsset, logQrScan } from '@/services/qr.service';
import { getQrRoleContext } from '@/services/qr-context.service';
import AssistantPageContextBridge from '@/components/assistant/AssistantPageContextBridge';
import QrInvalidState from './QrInvalidState';
import QrLoginRequired from './QrLoginRequired';
import QrAssetLandingPage from './QrAssetLandingPage';
import QrLandingClientShell from './QrLandingClientShell';

type RouteParams = Promise<{ token: string }>;

// Always render fresh — scans should reflect live asset state, and we record
// a scan row per successful authenticated resolution.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function QrLandingRoute({ params }: { params: RouteParams }) {
  const { token } = await params;

  const supabase = await createClient();
  const resolution = await resolveQrLandingAsset(token, supabase as never);

  if (resolution.status === 'invalid') {
    const { data: { user } } = await supabase.auth.getUser();
    return <QrInvalidState variant="invalid" authenticated={!!user} />;
  }

  if (resolution.status === 'not_found') {
    const { data: { user } } = await supabase.auth.getUser();
    return <QrInvalidState variant="not_found" authenticated={!!user} />;
  }

  if (resolution.status === 'revoked') {
    const { data: { user } } = await supabase.auth.getUser();
    return <QrInvalidState variant="revoked" authenticated={!!user} />;
  }

  const profile = await getServerProfile();
  if (!profile) {
    return <QrLoginRequired returnTo={`/qr/a/${token}`} />;
  }

  const asset = resolution.asset;
  const profileContext = {
    id: profile.id as string,
    full_name: (profile.full_name as string | null) ?? null,
    email: (profile.email as string | null) ?? null,
    job_title: (profile.job_title as string | null) ?? null,
    department_id: (profile.department_id as string | null) ?? null,
    roleNames: profile.roleNames ?? [],
  };
  const context = await getQrRoleContext({
    asset,
    profile: profileContext,
    client: supabase as never,
  });

  // Fire-and-forget scan log. Never block rendering, never crash on failure.
  // Refreshing the page intentionally writes another row in Phase 3 — Phase 6
  // will introduce dedup/throttling once the scan log UI is built.
  try {
    const hdrs = await headers();
    const userAgent = hdrs.get('user-agent');
    const primary = profile.roleNames?.[0] ?? null;
    await logQrScan(
      {
        assetId: asset.id,
        scannedBy: profile.id,
        roleName: profile.roleNames?.join(',') || primary,
        scanSource: 'web',
        onlineStatus: 'online',
        userAgent: userAgent ?? null,
        actionTaken: 'open_qr_landing',
        metadata: { route: 'qr.landing.v2', roleCategory: context.roleCategory },
      },
      supabase as never,
    );
  } catch (err) {
    console.error('[qr.landing] scan log failed', err);
  }

  return (
    <QrLandingClientShell>
      <AssistantPageContextBridge
        moduleLabel="QR Field Scan"
        pageLabel={`${asset.asset_code} · ${asset.name}`}
        contextRefs={{ equipmentId: asset.id, departmentId: asset.department_id ?? undefined }}
        selectedRecordType="equipment"
        selectedRecordId={asset.id}
        selectedRecordLabel={`${asset.asset_code} · ${asset.name}`}
        qrToken={token}
        offlineStatus="online"
        roleHints={[context.roleCategory]}
        pageSummary="Authenticated QR field scan page with role-tailored asset context, work status, PM/calibration, parts blockers, scan evidence, and QR lifecycle hints."
        visibleCounts={{
          openRequests: context.requests.open.length,
          openWorkOrders: context.workOrders.open.length,
          overduePm: context.pm.overdue.length,
          activePm: context.pm.active.length,
          calibrationDueState: context.calibration.state,
          qrLabelStatus: asset.qr_label_status,
        }}
        availableEvidenceLinks={[{ label: 'QR page', href: `/qr/a/${token}`, type: 'qr' }, { label: 'Equipment', href: `/equipment/${asset.id}`, type: 'equipment' }]}
        quickPrompts={['Summarize this asset before inspection.', 'What should I know before inspecting this?', 'What safe first-line checks should I do?']}
      />
      <QrAssetLandingPage
        asset={asset}
        profile={profileContext}
        context={context}
      />
    </QrLandingClientShell>
  );
}
