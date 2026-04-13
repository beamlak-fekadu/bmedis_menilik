'use client';

import Link from 'next/link';
import { Lock, ShieldCheck, Users2 } from 'lucide-react';
import { PageHeader, Card, Badge, Button } from '@/components/ui';

export default function SecurityPage() {
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
            <p className="text-sm text-[var(--text-muted)]">Manage permissions and role visibility across all modules.</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <Users2 className="h-5 w-5 text-cyan-300" />
            <p className="font-semibold text-[var(--foreground)]">User Access</p>
            <p className="text-sm text-[var(--text-muted)]">Activate/deactivate users and assign operational responsibilities.</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <Lock className="h-5 w-5 text-amber-300" />
            <p className="font-semibold text-[var(--foreground)]">Audit Readiness</p>
            <p className="text-sm text-[var(--text-muted)]">Track role changes and access governance for compliance.</p>
          </div>
        </Card>
      </div>
      <Link href="/users">
        <Button>Open Users & Roles</Button>
      </Link>
    </div>
  );
}
