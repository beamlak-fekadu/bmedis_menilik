import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/helpers';

export default async function RootPage() {
  const user = await getServerUser();
  if (user) redirect('/dashboard/analytical');
  redirect('/login');
}
