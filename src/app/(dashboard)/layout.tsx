'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageLoader } from '@/components/ui/Spinner';
import { ToastProvider } from '@/components/ui/Toast';
import { AssistantProvider } from '@/components/assistant/AssistantProvider';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  return (
    <ToastProvider>
      <AssistantProvider>
        <DashboardLayout
          userName={profile?.full_name || user.email || 'User'}
          userRole={profile?.primaryRole || 'user'}
          userRoles={profile?.roleNames || ['viewer']}
          onLogout={handleLogout}
        >
          {children}
        </DashboardLayout>
      </AssistantProvider>
    </ToastProvider>
  );
}
