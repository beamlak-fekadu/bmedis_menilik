'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageLoader } from '@/components/ui/Spinner';
import { ToastProvider } from '@/components/ui/Toast';
import { AssistantProvider } from '@/components/assistant/AssistantProvider';
import { NAV_SECTIONS } from '@/constants';

type RoleName = 'developer' | 'admin' | 'technician' | 'department_user' | 'store_user' | 'viewer';

const EXTRA_ROUTE_RULES: Array<{ prefix: string; roles: RoleName[] }> = [
  { prefix: '/command/health', roles: ['admin'] },
  { prefix: '/users', roles: ['admin'] },
  { prefix: '/settings', roles: ['admin'] },
  { prefix: '/security', roles: ['admin'] },
  { prefix: '/equipment/new', roles: ['admin', 'technician'] },
  { prefix: '/equipment/', roles: ['admin', 'technician', 'department_user', 'store_user', 'viewer'] },
  { prefix: '/inventory/new', roles: ['admin', 'technician'] },
  { prefix: '/inventory/', roles: ['admin', 'technician', 'department_user', 'store_user', 'viewer'] },
  { prefix: '/maintenance/work-orders/new', roles: ['admin', 'technician'] },
  { prefix: '/maintenance/work-orders/', roles: ['admin', 'technician'] },
  { prefix: '/maintenance/requests/new', roles: ['admin', 'technician', 'department_user'] },
  { prefix: '/maintenance/requests/', roles: ['admin', 'technician', 'department_user'] },
  { prefix: '/pm/plans/new', roles: ['admin', 'technician'] },
  { prefix: '/pm/schedules/', roles: ['admin', 'technician'] },
  { prefix: '/requests', roles: ['admin', 'technician', 'department_user'] },
  { prefix: '/documents', roles: ['admin', 'technician'] },
  { prefix: '/installation', roles: ['admin', 'technician'] },
];

const NAV_ROUTE_RULES = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    prefix: item.href,
    roles: item.roles as unknown as RoleName[],
  }))
);

function routeMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

function allowedRolesForPath(pathname: string): RoleName[] | null {
  if ((pathname.startsWith('/equipment/') || pathname.startsWith('/inventory/')) && pathname.endsWith('/edit')) {
    return ['admin', 'technician'];
  }

  const rules = [...EXTRA_ROUTE_RULES, ...NAV_ROUTE_RULES]
    .filter((rule) => rule.prefix !== '/')
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return rules.find((rule) => routeMatches(pathname, rule.prefix))?.roles ?? null;
}

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);

  const loading = authLoading || profileLoading;

  if (loading) return <PageLoader />;

  if (!user) {
    router.push('/login');
    return <PageLoader />;
  }

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const userRoles = profile?.roleNames || ['viewer'];
  const isDeveloper = userRoles.includes('developer');
  const allowedRoles = allowedRolesForPath(pathname);
  const hasRouteAccess = isDeveloper || !allowedRoles || allowedRoles.some((role) => userRoles.includes(role));

  return (
    <ToastProvider>
      <AssistantProvider>
        <DashboardLayout
          userName={profile?.full_name || user.email || 'User'}
          userRole={profile?.primaryRole || 'user'}
          userRoles={userRoles}
          onLogout={handleLogout}
        >
          {hasRouteAccess ? (
            children
          ) : (
            <div className="mx-auto max-w-xl rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6">
              <p className="text-lg font-semibold text-[var(--foreground)]">Access restricted</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Your current role does not have permission to open this module directly.
              </p>
            </div>
          )}
        </DashboardLayout>
      </AssistantProvider>
    </ToastProvider>
  );
}
