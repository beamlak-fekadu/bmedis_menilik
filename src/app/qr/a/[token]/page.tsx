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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    // R16: a revoked QR scan is a security/label-integrity event. Emit to
    // Developer/Admin/BME Head so they see the attempted scan. The
    // notification engine handles dedupe by (recipient + event + source_id)
    // with a 10-minute cooldown, so a refreshing scanner does not spam.
    // Source_id is the QR token itself — we do NOT include asset_id in
    // the payload because the public-facing branch must not leak which
    // asset the token belonged to. The masked token is enough for an
    // admin to look up the scan in audit / equipment_qr_scans.
    try {
      const { emitNotificationEvent } = await import('@/services/notifications/notification-engine');
      const maskedToken = token.length > 8
        ? `${token.slice(0, 4)}…${token.slice(-4)}`
        : token;
      await emitNotificationEvent({
        event_type: 'qr.revoked_scanned',
        source_table: 'equipment_qr_scans',
        source_id: token, // dedupe key — same revoked token from same scanner only fires once per window
        priority: 'high',
        payload: {
          masked_token: maskedToken,
          replaced_at: resolution.replacedAt ?? null,
          scanner_profile_id: user?.id ?? null,
          // Honest "we don't know which asset" — UI must not pretend otherwise.
          asset_id: null,
        },
      });
    } catch (e) {
      console.error('[notifications] qr.revoked_scanned emit failed:', e);
    }

    return <QrInvalidState variant="revoked" authenticated={!!user} />;
  }

  const profile = await getServerProfile();
  if (!profile) {
    return <QrLoginRequired returnTo={`/qr/a/${token}`} />;
  }

  const asset = resolution.asset;
  const chatDepartmentId =
    asset.department_id && UUID_RE.test(asset.department_id) ? asset.department_id : undefined;
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

  // R31: fire-and-forget scan log. Never block rendering, never crash on
  // failure. logQrScan() (Phase 6 service) DOES dedup open_qr_landing
  // page-render scans for the same asset/profile within
  // QR_SCAN_DEDUP_WINDOW_MINUTES (default 5 min). The dedup is best-effort;
  // a failed dedup probe still writes the scan rather than blocking it.
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
        contextRefs={{ equipmentId: asset.id, departmentId: chatDepartmentId }}
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
