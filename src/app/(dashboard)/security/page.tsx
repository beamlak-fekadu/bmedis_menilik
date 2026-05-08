import Link from 'next/link';
import { Lock, ShieldCheck, Users2 } from 'lucide-react';
import { PageHeader, Card, Badge, Button } from '@/components/ui';
import { requireRole } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

const RLS_TABLES = [
  'equipment_assets',
  'maintenance_requests',
  'work_orders',
  'recommendation_flags',
  'triage_action_queue',
  'profiles',
  'audit_logs',
  'chat_sessions',
  'chat_messages',
];

export default async function SecurityPage() {
  await requireRole(['developer', 'admin']);
  const supabase = await createClient();
  const [rolesRes, auditRes] = await Promise.all([
    supabase.from('roles').select('id, name, description, user_roles(id)').order('name'),
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, created_at')
      .in('entity_type', ['profiles', 'user_roles', 'roles', 'settings', 'departments'])
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const roles = (rolesRes.data ?? []) as Array<{ id: string; name: string; description: string | null; user_roles?: unknown[] }>;
  const auditRows = (auditRes.data ?? []) as Array<{ id: string; action: string; entity_type: string; created_at: string }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security and Access Control"
        description="Role-based access, user control, and permission governance."
        actions={<Badge variant="purple">Admin Only</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="space-y-2">
            <ShieldCheck className="h-5 w-5 text-violet-300" />
            <p className="font-semibold text-[var(--foreground)]">Roles & Permissions</p>
            <p className="text-sm text-[var(--text-muted)]">{roles.length} roles configured with server-action enforcement on operational writes.</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <Users2 className="h-5 w-5 text-cyan-300" />
            <p className="font-semibold text-[var(--foreground)]">Assigned Users</p>
            <p className="text-sm text-[var(--text-muted)]">
              {roles.reduce((sum, role) => sum + (role.user_roles?.length ?? 0), 0)} role assignments across active profiles.
            </p>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <Lock className="h-5 w-5 text-amber-300" />
            <p className="font-semibold text-[var(--foreground)]">Audit Readiness</p>
            <p className="text-sm text-[var(--text-muted)]">{auditRows.length} recent user, role, or settings events available for review.</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="space-y-3">
            <p className="font-semibold text-[var(--foreground)]">Role Assignment Summary</p>
            <div className="divide-y divide-[var(--border-subtle)]">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{role.name.replace(/_/g, ' ')}</p>
                    <p className="text-[var(--text-muted)]">{role.description ?? 'No description'}</p>
                  </div>
                  <Badge variant="info">{role.user_roles?.length ?? 0} users</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="space-y-3">
            <p className="font-semibold text-[var(--foreground)]">RLS Posture</p>
            <p className="text-sm text-[var(--text-muted)]">The app assumes Row Level Security remains enabled on these operational tables:</p>
            <div className="flex flex-wrap gap-2">
              {RLS_TABLES.map((table) => <Badge key={table} variant="default">{table}</Badge>)}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-3">
          <p className="font-semibold text-[var(--foreground)]">Recent Access Governance Events</p>
          {auditRows.length > 0 ? (
            <div className="divide-y divide-[var(--border-subtle)]">
              {auditRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[var(--foreground)]">{row.action} on {row.entity_type}</span>
                  <span className="text-[var(--text-muted)]">{new Date(row.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No recent governance audit events found.</p>
          )}
        </div>
      </Card>

      <Link href="/users">
        <Button>Open Users & Roles</Button>
      </Link>
    </div>
  );
}
